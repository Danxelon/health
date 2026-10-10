-- =============================================================================
-- Jibon Rokkha — 0002_rls.sql
-- Default-deny posture. Every table is locked, then policies grant one intent
-- each. Public reads go through curated views so that a table-level policy
-- never has to expose a sensitive column.
--
-- ORDER MATTERS: helpers first (policies reference them).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- HELPERS
-- All are SECURITY DEFINER owned by the migration role, which is the table
-- owner and therefore bypasses RLS. This is deliberate: if a profiles policy
-- called a helper that itself had to satisfy the profiles policy, we would
-- recurse forever.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin(p_user uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = p_user and role = 'admin'
  );
$$;

create or replace function public.is_doctor(p_user uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from doctors
    where user_id = p_user and verification = 'verified'
  );
$$;

create or replace function public.is_verified_doctor_row(p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from doctors
    where user_id = p_user and verification = 'verified'
  );
$$;

create or replace function public.my_upazila(p_user uuid default auth.uid())
returns int
language sql stable security definer
set search_path = public
as $$
  select home_upazila_id from profiles where id = p_user;
$$;

create or replace function public.my_district(p_user uuid default auth.uid())
returns int
language sql stable security definer
set search_path = public
as $$
  select u.district_id
  from profiles p
  join upazilas u on u.id = p.home_upazila_id
  where p.id = p_user;
$$;

grant execute on function public.is_admin(uuid)     to authenticated;
grant execute on function public.is_doctor(uuid)    to authenticated;
grant execute on function public.my_upazila(uuid)   to authenticated;
grant execute on function public.my_district(uuid)  to authenticated;

-- -----------------------------------------------------------------------------
-- ENABLE RLS EVERYWHERE
-- -----------------------------------------------------------------------------
alter table divisions              enable row level security;
alter table districts               enable row level security;
alter table upazilas                enable row level security;
alter table specialties             enable row level security;
alter table profiles                enable row level security;
alter table donors                  enable row level security;
alter table donor_availability      enable row level security;
alter table blood_requests          enable row level security;
alter table request_responses       enable row level security;
alter table contact_unlocks         enable row level security;
alter table contributions           enable row level security;
alter table doctors                 enable row level security;
alter table doctor_availability     enable row level security;
alter table consultations           enable row level security;
alter table consultation_messages   enable row level security;
alter table articles                enable row level security;
alter table article_reactions       enable row level security;
alter table complaints              enable row level security;
alter table blood_banks             enable row level security;
alter table blood_bank_stock        enable row level security;
alter table outbox                  enable row level security;
alter table audit_log               enable row level security;
alter table notification_prefs      enable row level security;
alter table app_config              enable row level security;

-- -----------------------------------------------------------------------------
-- REFERENCE DATA: readable by any authenticated user (and anon for the
-- registration form's upazila picker).
-- -----------------------------------------------------------------------------
create policy geo_divisions_read on divisions for select to anon, authenticated using (true);
create policy geo_districts_read on districts for select to anon, authenticated using (true);
create policy geo_upazilas_read  on upazilas  for select to anon, authenticated using (true);
create policy specialties_read   on specialties for select to anon, authenticated using (true);

-- -----------------------------------------------------------------------------
-- PROFILES
-- No one can read another user's profile row. Discoverability happens through
-- the donor-search RPC (which returns a projection) and the curated views below.
-- -----------------------------------------------------------------------------
create policy profiles_select_own on profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_insert_own on profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- no delete policy: account deletion is an admin/service operation

-- -----------------------------------------------------------------------------
-- DONORS: the donor's own data. There is no public donor directory, by design.
-- -----------------------------------------------------------------------------
create policy donors_select_own on donors for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy donors_insert_own on donors for insert to authenticated
  with check (user_id = auth.uid());
create policy donors_update_own on donors for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy donor_avail_select on donor_availability for select to authenticated
  using (donor_id = auth.uid() or public.is_admin());
create policy donor_avail_write on donor_availability for all to authenticated
  using (donor_id = auth.uid()) with check (donor_id = auth.uid());

-- -----------------------------------------------------------------------------
-- BLOOD REQUESTS
-- Full rows are visible only to the requestor, the matched donor, and admins.
-- Everyone else sees the redacted emergency_feed view.
-- -----------------------------------------------------------------------------
create policy blood_requests_select_involved on blood_requests for select to authenticated
  using (requestor_id = auth.uid() or matched_donor_id = auth.uid() or public.is_admin());
create policy blood_requests_insert_own on blood_requests for insert to authenticated
  with check (requestor_id = auth.uid());
create policy blood_requests_update_own on blood_requests for update to authenticated
  using (requestor_id = auth.uid() or public.is_admin())
  with check (requestor_id = auth.uid() or public.is_admin());

create policy responses_select_involved on request_responses for select to authenticated
  using (
    donor_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from blood_requests r where r.id = request_id and r.requestor_id = auth.uid())
  );
create policy responses_insert_self on request_responses for insert to authenticated
  with check (donor_id = auth.uid());
create policy responses_update_self on request_responses for update to authenticated
  using (donor_id = auth.uid() or public.is_admin())
  with check (donor_id = auth.uid() or public.is_admin());

-- Disclosure audit: the subject always sees who unlocked them.
create policy unlocks_select_related on contact_unlocks for select to authenticated
  using (subject_id = auth.uid() or unlocker_id = auth.uid() or public.is_admin());
-- inserts happen only inside the unlock_donor_contact RPC (security definer)

create policy contributions_select_related on contributions for select to authenticated
  using (
    donor_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from blood_requests r where r.id = request_id and r.requestor_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- DOCTORS: owner + admin on the base table; the public card is a view.
-- -----------------------------------------------------------------------------
create policy doctors_select_own on doctors for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy doctors_insert_own on doctors for insert to authenticated
  with check (user_id = auth.uid());
create policy doctors_update_own on doctors for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- A verified doctor's schedule is public information (patients pick slots).
create policy doctor_avail_select on doctor_availability for select to authenticated
  using (
    doctor_id = auth.uid()
    or public.is_admin()
    or public.is_verified_doctor_row(doctor_id)
  );
create policy doctor_avail_write on doctor_availability for all to authenticated
  using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());

-- -----------------------------------------------------------------------------
-- CONSULTATIONS
-- -----------------------------------------------------------------------------
create policy consultations_select_participant on consultations for select to authenticated
  using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin());
create policy consultations_insert_patient on consultations for insert to authenticated
  with check (patient_id = auth.uid());
create policy consultations_update_participant on consultations for update to authenticated
  using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin())
  with check (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin());

create policy messages_select_participant on consultation_messages for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from consultations c
      where c.id = consultation_id
        and (c.patient_id = auth.uid() or c.doctor_id = auth.uid())
    )
  );
create policy messages_insert_participant on consultation_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from consultations c
      where c.id = consultation_id
        and (c.patient_id = auth.uid() or c.doctor_id = auth.uid())
        and c.status not in ('cancelled','completed')
    )
  );

-- -----------------------------------------------------------------------------
-- ARTICLES
-- -----------------------------------------------------------------------------
create policy articles_select_published on articles for select to anon, authenticated
  using (status = 'published' or public.is_admin() or author_id = auth.uid());
create policy articles_insert_author on articles for insert to authenticated
  with check (author_id = auth.uid() and public.is_doctor(auth.uid()));
create policy articles_update_author on articles for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

create policy reactions_select_all on article_reactions for select to anon, authenticated
  using (true);
create policy reactions_write_own on article_reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- COMPLAINTS
-- -----------------------------------------------------------------------------
create policy complaints_select_own on complaints for select to authenticated
  using (complainant_id = auth.uid() or assignee_id = auth.uid() or public.is_admin());
create policy complaints_insert_own on complaints for insert to authenticated
  with check (complainant_id = auth.uid());
create policy complaints_admin_update on complaints for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- BLOOD BANKS (Phase 3)
-- -----------------------------------------------------------------------------
create policy blood_banks_read  on blood_banks for select to authenticated
  using (verified or public.is_admin());
create policy blood_banks_admin on blood_banks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy stock_read on blood_bank_stock for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from blood_banks b where b.id = bank_id and b.verified)
  );

-- -----------------------------------------------------------------------------
-- OPS TABLES: locked to service role.
-- outbox  -> no policy (Edge Functions use the service key)
-- audit   -> admins may read; nobody may write directly (triggers are definer)
-- config  -> server-only
-- -----------------------------------------------------------------------------
create policy audit_read_admin on audit_log for select to authenticated
  using (public.is_admin());

create policy notification_prefs_own on notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- CURATED PUBLIC VIEWS
-- Views owned by the migration role bypass RLS, so each one is responsible for
-- its own filtering. This is the ONLY route by which one user's data becomes
-- visible to another.
-- =============================================================================

-- Redacted live emergency board. No patient name, no requestor id, no exact
-- coordinates, no hospital phone. Enough to act on, nothing to weaponise.
create or replace view public.emergency_feed
with (security_invoker = false) as
select
  r.id,
  r.blood_group_needed,
  r.component,
  r.units_needed,
  r.units_confirmed,
  r.urgency,
  r.status,
  r.hospital_name,
  r.needed_by,
  r.created_at,
  r.expires_at,
  r.escalation_ring,
  up.name_en  as upazila_en,
  up.name_bn  as upazila_bn,
  d.name_en   as district_en,
  d.name_bn   as district_bn,
  -- distance band only: never the raw point
  case
    when r.geog is null then null
    when st_distance(r.geog, p.home_geog) < 1000 then 'under_1km'
    when st_distance(r.geog, p.home_geog) < 3000 then '1_3km'
    when st_distance(r.geog, p.home_geog) < 10000 then '3_10km'
    else 'far'
  end as distance_band
from blood_requests r
join upazilas up on up.id = r.upazila_id
join districts d on d.id = up.district_id
cross join lateral (select home_geog from profiles where id = auth.uid()) p
where r.status in ('open','matching')
  and auth.uid() is not null;

grant select on public.emergency_feed to authenticated;

-- Doctor public card: everything a patient needs to choose, nothing internal.
create or replace view public.doctor_cards
with (security_invoker = false) as
select
  doc.user_id,
  coalesce(pr.full_name_bn, pr.full_name) as display_name,
  pr.full_name                            as full_name,
  pr.avatar_url,
  doc.bmdc_reg_no,
  doc.degrees,
  doc.experience_years,
  doc.consult_fee,
  doc.languages,
  doc.bio,
  doc.rating_avg,
  doc.rating_count,
  doc.follow_up_free_days,
  doc.specialty_id,
  sp.slug as specialty_slug, sp.name_en as specialty_en, sp.name_bn as specialty_bn,
  doc.practice_upazila_id,
  up.name_en as upazila_en, up.name_bn as upazila_bn,
  d.name_en  as district_en, d.name_bn as district_bn,
  div.name_en as division_en, div.name_bn as division_bn,
  doc.practice_address,
  case
    when doc.practice_geog is null or p.home_geog is null then null
    else round((st_distance(doc.practice_geog, p.home_geog) / 1000.0)::numeric, 1)
  end as distance_km
from doctors doc
join profiles pr on pr.id = doc.user_id
left join specialties sp on sp.id = doc.specialty_id
left join upazilas up on up.id = doc.practice_upazila_id
left join districts d on d.id = up.district_id
left join divisions div on div.id = d.division_id
left join lateral (select home_geog from profiles where id = auth.uid()) p on true
where doc.verification = 'verified';

grant select on public.doctor_cards to authenticated;
grant select on public.doctor_cards to anon;

-- Article feed with author attribution resolved in one place.
create or replace view public.article_feed
with (security_invoker = false) as
select
  a.id, a.slug, a.title, a.title_bn, a.excerpt, a.cover_image_path,
  a.tags, a.published_at, a.view_count, a.flagged_review,
  a.author_id,
  coalesce(pr.full_name_bn, pr.full_name) as author_name,
  pr.avatar_url as author_avatar,
  doc.degrees as author_degrees,
  sp.name_en as specialty_en, sp.name_bn as specialty_bn, sp.slug as specialty_slug,
  (select count(*) from article_reactions ar where ar.article_id = a.id) as reaction_count
from articles a
join doctors doc on doc.user_id = a.author_id
join profiles pr on pr.id = a.author_id
left join specialties sp on sp.id = doc.specialty_id
where a.status = 'published'
  and doc.verification = 'verified';

grant select on public.article_feed to anon, authenticated;

-- Aggregate blood availability. Powers "X donors near you" and the district
-- picture without ever scanning donor rows from the client.
create materialized view public.donor_counts_by_upazila_group as
select
  p.home_upazila_id as upazila_id,
  p.blood_group,
  count(*) as donor_count
from profiles p
join donors dn on dn.user_id = p.id
where p.blood_group is not null
  and p.home_upazila_id is not null
group by 1, 2;

create unique index on public.donor_counts_by_upazila_group (upazila_id, blood_group);
grant select on public.donor_counts_by_upazila_group to authenticated;

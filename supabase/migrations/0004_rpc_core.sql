-- =============================================================================
-- Jibon Rokkha — 0003_rpc.sql
-- The API surface. Client-side TypeScript mirrors these rules for instant UI
-- feedback, but THIS is the security boundary: a user can edit React state or
-- call PostgREST directly, so every rule that matters is enforced here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOOD COMPATIBILITY
-- Pure arithmetic over the enum rather than a 64-row lookup table, so there is
-- exactly one place the medicine lives and no chance of a stale seed.
--
--   ABO: the donor's antigens must not be foreign to the recipient.
--        O -> anyone; A -> {A, AB}; B -> {B, AB}; AB -> {AB}
--   Rh : a negative donor may give to either; a positive donor only to positive.
-- -----------------------------------------------------------------------------
create or replace function public.can_donate(p_donor blood_group, p_recipient blood_group)
returns boolean
language sql immutable
as $$
  with t as (
    select replace(replace(p_donor::text, '+', ''), '-', '')     as da,
           replace(replace(p_recipient::text, '+', ''), '-', '') as ra
  )
  select
    (case da
       when 'O'  then true
       when 'A'  then ra in ('A', 'AB')
       when 'B'  then ra in ('B', 'AB')
       when 'AB' then ra = 'AB'
       else false
     end)
    and (right(p_donor::text, 1) = '-' or right(p_recipient::text, 1) = '+')
  from t;
$$;

-- Every group that can give to the given recipient, e.g. AB+ -> all 8.
-- This is what the search uses; matching on string equality would quietly
-- strand patients in an emergency.
create or replace function public.acceptable_donor_groups(p_recipient blood_group)
returns blood_group[]
language sql immutable
as $$
  select array_agg(g order by g)
  from unnest(enum_range(null::blood_group)) as g
  where public.can_donate(g, p_recipient);
$$;

-- Who a given donor can serve (used on the donor's own dashboard).
create or replace function public.donor_serves(p_donor blood_group)
returns blood_group[]
language sql immutable
as $$
  select array_agg(g order by g)
  from unnest(enum_range(null::blood_group)) as g
  where public.can_donate(p_donor, g);
$$;

-- -----------------------------------------------------------------------------
-- ELIGIBILITY
-- Reference implementation. Search and accept-time both call this, so a donor
-- eligible at invite is re-checked at accept (six hours can pass; a donation
-- elsewhere starts a cooldown).
-- -----------------------------------------------------------------------------
create or replace function public.cooldown_days(p_component blood_component)
returns int language sql immutable as $$
  select case p_component
    when 'whole_blood' then 90
    when 'prbc'        then 90
    when 'platelets'   then 14
    when 'plasma'      then 28
  end;
$$;

create or replace function public.donor_eligibility(
  p_user      uuid,
  p_component blood_component default 'whole_blood'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reasons   text[] := '{}';
  v_prof      profiles%rowtype;
  v_don       donors%rowtype;
  v_age       int;
  v_weight    numeric;
  v_last      date;
  v_next      date;
  v_cool      int := public.cooldown_days(p_component);
begin
  select * into v_prof from profiles where id = p_user;
  if not found then
    return jsonb_build_object('eligible', false, 'reasons', jsonb_build_array('no_profile'));
  end if;

  select * into v_don from donors where user_id = p_user;

  v_age    := case when v_prof.date_of_birth is null then null
                   else extract(year from age(current_date, v_prof.date_of_birth))::int end;
  v_weight := coalesce(v_don.weight_kg, v_prof.weight_kg);
  v_last   := v_don.last_donation_date;
  v_next   := case when v_last is null then null else v_last + v_cool end;

  -- Hard blocks: never shown as a candidate.
  if v_age is not null and v_age < 18 then v_reasons := v_reasons || 'age_too_young'; end if;
  if v_age is not null and v_age > 65 then v_reasons := v_reasons || 'age_too_old';     end if;
  if v_weight is not null and v_weight < 50 then v_reasons := v_reasons || 'underweight'; end if;
  if v_next is not null and v_next > current_date then
    v_reasons := v_reasons || 'cooldown_active';
  end if;
  if v_don.temp_status = 'unavailable' then v_reasons := v_reasons || 'opted_out'; end if;
  if v_don.temp_status = 'cooldown'    then v_reasons := v_reasons || 'manual_cooldown'; end if;
  if v_don.notifications_enabled is false then v_reasons := v_reasons || 'opted_out'; end if;

  -- Soft warnings: shown, but flagged to the requestor. We do not adjudicate
  -- these medically, and we never present a soft-warned donor as "safe".
  if v_don.chronic_conditions is not null and length(btrim(v_don.chronic_conditions)) > 0
    then v_reasons := v_reasons || 'chronic_condition'; end if;
  if v_don.recent_illness then v_reasons := v_reasons || 'recent_illness'; end if;
  if v_don.medications is not null and length(btrim(v_don.medications)) > 0
    then v_reasons := v_reasons || 'on_medication'; end if;
  if v_don.smoker then v_reasons := v_reasons || 'smoker'; end if;

  return jsonb_build_object(
    'eligible', not (v_reasons && array[
      'age_too_young','age_too_old','underweight','cooldown_active',
      'opted_out','manual_cooldown','no_profile'
    ]),
    'reasons',       to_jsonb(v_reasons),
    'soft_warnings', to_jsonb(v_reasons & array[
      'chronic_condition','recent_illness','on_medication','smoker'
    ]),
    'age',              v_age,
    'weight_kg',        v_weight,
    'last_donation',    v_last,
    'next_eligible_on', v_next,
    'component',        p_component
  );
end; $$;

grant execute on function public.donor_eligibility(uuid, blood_component) to authenticated;

-- -----------------------------------------------------------------------------
-- REGISTRATION
-- NID is hashed inside the database. The client never sees, sends, or stores
-- the pepper, and never receives the hash back.
-- -----------------------------------------------------------------------------
create or replace function public.register_profile(
  p_nid              text,
  p_full_name        text,
  p_full_name_bn     text default null,
  p_date_of_birth    date default null,
  p_gender           text default null,
  p_blood_group      blood_group default null,
  p_home_upazila_id  int default null,
  p_present_address  text default null,
  p_lat              double precision default null,
  p_lng              double precision default null
)
returns profiles
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_phone text;
  v_row   profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = 'RJ401';
  end if;

  -- NID must be a real 10/13/17 digit number before we accept it as an identity.
  if p_nid !~ '^[0-9]{10}$' and p_nid !~ '^[0-9]{13}$' and p_nid !~ '^[0-9]{17}$' then
    raise exception 'invalid NID format' using errcode = 'RJ003';
  end if;

  select phone into v_phone from auth.users where id = v_uid;
  if v_phone is null then
    raise exception 'no phone on session' using errcode = 'RJ401';
  end if;

  -- This is a definer function creating the caller's own row, so it is
  -- authorised to establish the initial role/NID. Nothing a client can call
  -- directly re-opens that door: guard_profile_identity still blocks role and
  -- nid changes on UPDATE unless the same app-controlled flag is set here.
  perform set_config('app.bypass_profile_guard', 'on', true);

  insert into profiles (
    id, phone, nid_hash, nid_last4, full_name, full_name_bn,
    date_of_birth, gender, blood_group, home_upazila_id, present_address,
    home_geog, role
  ) values (
    v_uid, v_phone, private.nid_hash(p_nid), right(p_nid, 4),
    p_full_name, p_full_name_bn, p_date_of_birth, p_gender, p_blood_group,
    p_home_upazila_id, p_present_address,
    case when p_lat is not null and p_lng is not null
         then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography end,
    'citizen'
  )
  returning * into v_row;

  perform set_config('app.bypass_profile_guard', 'off', true);

  insert into notification_prefs (user_id) values (v_uid)
    on conflict (user_id) do nothing;

  return v_row;
end; $$;

grant execute on function public.register_profile(text, text, text, date, text, blood_group, int, text, double precision, double precision)
  to authenticated;

-- -----------------------------------------------------------------------------
-- DONOR SELF-SERVICE
-- Registering as a donor is an explicit, separate act from having an account.
-- -----------------------------------------------------------------------------
create or replace function public.become_donor(
  p_weight_kg          numeric default null,
  p_temp_status        donor_temp_status default 'available',
  p_available_from     date default null,
  p_contact_visibility contact_visibility default 'on_unlock',
  p_notify_radius_km   int default 10,
  p_chronic_conditions text default null,
  p_medications        text default null,
  p_smoker             boolean default false
)
returns donors
language plpgsql security definer set search_path = public
as $$
declare v_row donors%rowtype; v_uid uuid := auth.uid();
begin
  insert into donors (
    user_id, weight_kg, temp_status, available_from, contact_visibility,
    notify_radius_km, chronic_conditions, medications, smoker
  ) values (
    v_uid, p_weight_kg, p_temp_status, p_available_from, p_contact_visibility,
    p_notify_radius_km, p_chronic_conditions, p_medications, p_smoker
  )
  on conflict (user_id) do update set
    weight_kg          = coalesce(excluded.weight_kg, donors.weight_kg),
    temp_status        = excluded.temp_status,
    available_from     = excluded.available_from,
    contact_visibility = excluded.contact_visibility,
    notify_radius_km   = excluded.notify_radius_km,
    chronic_conditions = excluded.chronic_conditions,
    medications        = excluded.medications,
    smoker             = excluded.smoker,
    updated_at         = now()
  returning * into v_row;

  -- A donor is a citizen with registered donor state in public.donors;
  -- role remains 'citizen'. Any citizen may be a donor or patient.
  return v_row;
end; $$;

grant execute on function public.become_donor(numeric, donor_temp_status, date, contact_visibility, int, text, text, boolean)
  to authenticated;

create or replace function public.set_donor_availability(
  p_temp_status    donor_temp_status,
  p_available_from date default null,
  p_travel_note    text default null
)
returns donors
language plpgsql security definer set search_path = public
as $$
declare v_row donors%rowtype;
begin
  update donors
     set temp_status    = p_temp_status,
         available_from = p_available_from,
         travel_note    = p_travel_note,
         updated_at     = now()
   where user_id = auth.uid()
  returning * into v_row;

  if not found then
    raise exception 'not a registered donor' using errcode = 'RJ004';
  end if;
  return v_row;
end; $$;

grant execute on function public.set_donor_availability(donor_temp_status, date, text) to authenticated;

-- Self-reported donation elsewhere. The closest realistic analogue of a
-- national registry that works today: it starts a real cooldown.
create or replace function public.record_external_donation(
  p_donated_on date,
  p_component  blood_component default 'whole_blood'
)
returns contributions
language plpgsql security definer set search_path = public
as $$
declare v_row contributions%rowtype;
begin
  if not exists (select 1 from donors where user_id = auth.uid()) then
    raise exception 'not a registered donor' using errcode = 'RJ004';
  end if;
  if p_donated_on > current_date then
    raise exception 'donation date cannot be in the future' using errcode = 'RJ005';
  end if;
  if p_donated_on < current_date - interval '1 year' then
    raise exception 'donation date too far in the past' using errcode = 'RJ006';
  end if;

  insert into contributions (donor_id, component, units, donated_on, external, verified_at)
  values (auth.uid(), p_component, 1, p_donated_on, true, now())
  returning * into v_row;

  return v_row;
end; $$;

grant execute on function public.record_external_donation(date, blood_component) to authenticated;

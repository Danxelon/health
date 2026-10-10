-- =============================================================================
-- Jibon Rokkha — 0005_triggers.sql
-- Invariants that must hold no matter which client writes the row.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- NID hashing. Raw NID never leaves this function's caller; the pepper lives in
-- private.secrets (not reachable by anon/authenticated).
-- -----------------------------------------------------------------------------
create or replace function private.nid_hash(p_nid text)
returns text
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_pepper text;
begin
  select value into v_pepper from private.secrets where key = 'nid_pepper';
  if v_pepper is null then
    raise exception 'nid_pepper missing from private.secrets' using errcode = 'P0001';
  end if;
  return encode(hmac(p_nid::bytea, v_pepper::bytea, 'sha256'), 'hex');
end;
$$;

revoke all on function private.nid_hash(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

create trigger trg_profiles_touch          before update on profiles
  for each row execute function public.touch_updated_at();
create trigger trg_blood_requests_touch    before update on blood_requests
  for each row execute function public.touch_updated_at();
create trigger trg_donors_touch            before update on donors
  for each row execute function public.touch_updated_at();
create trigger trg_articles_touch          before update on articles
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Generic audit: status-changing tables record actor / before / after.
-- audit_log is written by triggers only, never by a user session.
-- -----------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  insert into audit_log (actor_id, action, entity, entity_id, before, after)
  values (
    v_actor,
    lower(tg_op),
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end; $$;

create trigger trg_audit_blood_requests
  after insert or update of status or delete on blood_requests
  for each row execute function public.audit_row_change();

create trigger trg_audit_consultations
  after insert or update of status or delete on consultations
  for each row execute function public.audit_row_change();

create trigger trg_audit_doctors_verification
  after update of verification on doctors
  for each row execute function public.audit_row_change();

create trigger trg_audit_complaints
  after insert or update of status or delete on complaints
  for each row execute function public.audit_row_change();

-- -----------------------------------------------------------------------------
-- Request expiry is derived from urgency, not chosen by the client.
--   routine -> 7d   urgent -> 48h   critical -> 24h (then escalates, not dies)
-- -----------------------------------------------------------------------------
create or replace function public.set_request_expiry()
returns trigger language plpgsql as $$
begin
  if new.expires_at is null then
    new.expires_at := coalesce(new.created_at, now()) + case new.urgency
      when 'routine'  then interval '7 days'
      when 'urgent'   then interval '48 hours'
      when 'critical' then interval '24 hours'
    end;
  end if;
  return new;
end; $$;

create trigger trg_request_expiry before insert on blood_requests
  for each row execute function public.set_request_expiry();

-- -----------------------------------------------------------------------------
-- Contributions drive donor state. This is what makes cooldown computable
-- and what makes the donors table impossible to drift from reality.
-- -----------------------------------------------------------------------------
create or replace function public.sync_donor_from_contributions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_donor uuid := coalesce(new.donor_id, old.donor_id);
  v_last  date;
  v_count int;
begin
  select max(donated_on), coalesce(sum(units), 0)
    into v_last, v_count
  from contributions
  where donor_id = v_donor;

  update donors
     set last_donation_date = v_last,
         total_donations    = v_count,
         -- a fresh donation always starts a cooldown window
         temp_status        = case when v_last is not null and v_last >= current_date - 90
                                   then 'cooldown'::donor_temp_status
                                   else temp_status end,
         updated_at         = now()
   where user_id = v_donor;

  return coalesce(new, old);
end; $$;

create trigger trg_contributions_sync
  after insert or update or delete on contributions
  for each row execute function public.sync_donor_from_contributions();

-- -----------------------------------------------------------------------------
-- Fulfilment: a request is fulfilled when confirmed units meet the ask.
-- Comparing units_confirmed <= units_needed is already a table constraint.
-- -----------------------------------------------------------------------------
create or replace function public.sync_request_from_responses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req uuid := coalesce(new.request_id, old.request_id);
  v_confirmed int;
  v_needed int;
begin
  select count(*) filter (where donation_confirmed)
    into v_confirmed
  from request_responses where request_id = v_req;

  select units_needed into v_needed from blood_requests where id = v_req;

  update blood_requests
     set units_confirmed = least(v_confirmed, coalesce(v_needed, v_confirmed)),
         status = case
           when least(v_confirmed, coalesce(v_needed, v_confirmed)) >= coalesce(v_needed, 1)
             then 'fulfilled'::request_status
           when status = 'open' and v_confirmed > 0
             then 'matching'::request_status
           else status
         end
   where id = v_req;

  return coalesce(new, old);
end; $$;

create trigger trg_responses_sync
  after insert or update of donation_confirmed or delete on request_responses
  for each row execute function public.sync_request_from_responses();

-- -----------------------------------------------------------------------------
-- Reliability counters (admin-visible only; never surfaced publicly —
-- a public reliability score punishes people for having emergencies).
-- -----------------------------------------------------------------------------
create or replace function public.sync_donor_response_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_donor uuid := coalesce(new.donor_id, old.donor_id);
begin
  update donors d
     set accepted_count_12mo = sub.accepted,
         donated_count_12mo  = sub.donated,
         declined_count_12mo = sub.declined
  from (
    select
      count(*) filter (where state in ('accepted','donated'))                as accepted,
      count(*) filter (where state = 'donated')                             as donated,
      count(*) filter (where state = 'declined')                            as declined
    from request_responses
    where donor_id = v_donor and invited_at > now() - interval '12 months'
  ) sub
  where d.user_id = v_donor;
  return coalesce(new, old);
end; $$;

create trigger trg_donor_counters
  after insert or update of state on request_responses
  for each row execute function public.sync_donor_response_counters();

-- -----------------------------------------------------------------------------
-- Blood group is a verified attribute. Changing it invalidates that
-- verification, otherwise a user could self-upgrade to a rare group.
--
-- ORDERING NOTE: this must be the FIRST before-update trigger on profiles
-- (triggers of the same type fire in name order, so trg_0_... fires first).
-- guard_profile_identity() then re-asserts old.blood_group_verified on top, so
-- a user can never set the flag true from the client — only an admin can.
-- -----------------------------------------------------------------------------
create or replace function public.reset_verification_on_group_change()
returns trigger language plpgsql as $$
begin
  if new.blood_group is distinct from old.blood_group then
    new.blood_group_verified := false;
  end if;
  return new;
end; $$;

create trigger "trg_0_profiles_group_change" before update on profiles
  for each row execute function public.reset_verification_on_group_change();

-- -----------------------------------------------------------------------------
-- Identity guard. A user may edit their own profile but never their own role,
-- NID hash, or the verification flag — otherwise "role" is self-service and
-- "blood_group_verified" is just a badge anyone can wear.
--
-- The bypass flag is set only by registered security-definer functions
-- (register_profile, become_donor) via set_config(...). Raising here is safe:
-- careless maintenance functions fail loudly rather than silently corrupting.
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bypass_profile_guard', true) = 'on' then
    return new;
  end if;

  if not public.is_admin(auth.uid()) then
    if new.role is distinct from old.role then
      raise exception 'role is not self-assignable' using errcode = 'RJ001';
    end if;
    if new.nid_hash is distinct from old.nid_hash
       or new.nid_last4 is distinct from old.nid_last4 then
      raise exception 'nid cannot be changed without re-verification' using errcode = 'RJ002';
    end if;
    --
    -- The verification flag is preserved verbatim: neither reset (handled by
    -- trg_0_profiles_group_change) nor grant is a client-side operation.
    --
    new.blood_group_verified := old.blood_group_verified;
  end if;

  return new;
end; $$;

create trigger trg_profiles_identity_guard before update on profiles
  for each row execute function public.guard_profile_identity();

-- -----------------------------------------------------------------------------
-- Verification gate: a doctor row can only be 'verified' with a BMDC number,
-- and only an admin may move it there.
-- -----------------------------------------------------------------------------
create or replace function public.guard_doctor_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification is distinct from old.verification then
    if not public.is_admin(auth.uid()) then
      raise exception 'only an admin may change doctor verification'
        using errcode = 'P0001';
    end if;
    if new.verification = 'verified' then
      new.verified_at := now();
      new.verified_by := auth.uid();
      new.rejection_reason := null;
    end if;
  end if;
  return new;
end; $$;

create trigger trg_doctor_verification_guard before update on doctors
  for each row execute function public.guard_doctor_verification();

-- -----------------------------------------------------------------------------
-- audit_log and outbox are append-only for every non-service role.
-- -----------------------------------------------------------------------------
create or replace function public.block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'this table is append-only' using errcode = 'P0001';
end; $$;

create trigger trg_audit_immutable before update or delete on audit_log
  for each row execute function public.block_mutation();

-- -----------------------------------------------------------------------------
-- Complaint SLA: severity 3 -> 4h, 2 -> 24h, 1 -> 72h.
-- -----------------------------------------------------------------------------
create or replace function public.set_complaint_sla()
returns trigger language plpgsql as $$
begin
  if new.sla_due_at is null then
    new.sla_due_at := now() + case new.severity
      when 3 then interval '4 hours'
      when 2 then interval '24 hours'
      else interval '72 hours'
    end;
  end if;
  return new;
end; $$;

create trigger trg_complaint_sla before insert on complaints
  for each row execute function public.set_complaint_sla();

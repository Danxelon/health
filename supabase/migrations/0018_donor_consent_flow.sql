-- =============================================================================
-- MediLink / Jibon Rokkha — 0018_donor_consent_flow.sql
-- Automated IVR consent workflow for privacy-first blood donor discovery.
-- Donors remain anonymous upfront; raw phone & exact address are only revealed
-- once the donor explicitly consents via automated IVR call.
-- =============================================================================

create table if not exists public.donor_consent_requests (
  id                  uuid primary key default gen_random_uuid(),
  seeker_id           uuid references public.profiles(id) on delete set null,
  seeker_phone        text,
  seeker_name         text,
  donor_id            uuid not null references public.profiles(id) on delete cascade,
  blood_group         public.blood_group not null,
  hospital_name       text,
  urgency             public.request_urgency default 'urgent',
  status              text check (status in ('pending', 'calling', 'consented', 'declined', 'expired')) default 'calling',
  ivr_call_id         text,
  ivr_status          text default 'ringing',
  donor_response_at   timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '15 minutes')
);

create index if not exists donor_consent_requests_donor_idx on public.donor_consent_requests(donor_id);
create index if not exists donor_consent_requests_seeker_idx on public.donor_consent_requests(seeker_id);
create index if not exists donor_consent_requests_status_idx on public.donor_consent_requests(status);

alter table public.donor_consent_requests enable row level security;

-- RLS policies (idempotent with drop policy if exists)
drop policy if exists "Users can view their own consent requests" on public.donor_consent_requests;
drop policy if exists consent_requests_select on public.donor_consent_requests;
create policy "Users can view their own consent requests"
  on public.donor_consent_requests
  for select
  using (
    seeker_id = auth.uid() or
    donor_id = auth.uid() or
    auth.role() = 'service_role' or
    public.is_admin()
  );

drop policy if exists "Users or guests can insert consent requests" on public.donor_consent_requests;
drop policy if exists consent_requests_insert on public.donor_consent_requests;
create policy "Users or guests can insert consent requests"
  on public.donor_consent_requests
  for insert
  with check (true);

drop policy if exists "Users can update their own consent requests" on public.donor_consent_requests;
drop policy if exists consent_requests_update on public.donor_consent_requests;
create policy "Users can update their own consent requests"
  on public.donor_consent_requests
  for update
  using (
    donor_id = auth.uid() or
    auth.role() = 'service_role' or
    public.is_admin()
  );

grant select, insert, update on public.donor_consent_requests to anon, authenticated;

-- -----------------------------------------------------------------------------
-- request_donor_consent
-- Initiates an automated government IVR consent call to a donor.
-- -----------------------------------------------------------------------------
create or replace function public.request_donor_consent(
  p_donor_id       uuid,
  p_hospital_name  text default null,
  p_urgency        text default 'urgent',
  p_notes          text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seeker_id    uuid := auth.uid();
  v_seeker_phone text;
  v_seeker_name  text;
  v_blood_group  blood_group;
  v_urgency      request_urgency := 'urgent';
  v_req_id       uuid;
  v_ivr_call_id  text;
begin
  -- Resolve seeker profile if authenticated
  if v_seeker_id is not null then
    select phone, coalesce(nullif(btrim(full_name_bn), ''), full_name)
      into v_seeker_phone, v_seeker_name
      from public.profiles
     where id = v_seeker_id;
  end if;

  -- Resolve donor blood group
  select blood_group into v_blood_group
    from public.profiles
   where id = p_donor_id;

  if v_blood_group is null then
    v_blood_group := 'A+'::blood_group;
  end if;

  -- Validate urgency enum
  if p_urgency in ('routine', 'urgent', 'critical') then
    v_urgency := p_urgency::request_urgency;
  end if;

  v_ivr_call_id := 'IVR-GOV-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 8);

  insert into public.donor_consent_requests (
    seeker_id,
    seeker_phone,
    seeker_name,
    donor_id,
    blood_group,
    hospital_name,
    urgency,
    status,
    ivr_call_id,
    ivr_status,
    notes,
    created_at,
    expires_at
  ) values (
    v_seeker_id,
    v_seeker_phone,
    v_seeker_name,
    p_donor_id,
    v_blood_group,
    p_hospital_name,
    v_urgency,
    'calling',
    v_ivr_call_id,
    'ringing',
    p_notes,
    now(),
    now() + interval '15 minutes'
  )
  returning id into v_req_id;

  return v_req_id;
end;
$$;

grant execute on function public.request_donor_consent(uuid, text, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- respond_donor_consent
-- Donor responds to the IVR automated call: 'consented' or 'declined'.
-- -----------------------------------------------------------------------------
create or replace function public.respond_donor_consent(
  p_request_id uuid,
  p_decision   text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_consented boolean;
  v_new_status text;
  v_ivr_status text;
begin
  select * into v_req
    from public.donor_consent_requests
   where id = p_request_id;

  if not found then
    return false;
  end if;

  -- Check if expired
  if v_req.expires_at is not null and v_req.expires_at <= now() then
    update public.donor_consent_requests
       set status = 'expired',
           ivr_status = 'expired'
     where id = p_request_id;
    return false;
  end if;

  v_consented := lower(trim(p_decision)) in ('consented', 'consent', 'yes', 'true', 'accept', 'accepted');
  v_new_status := case when v_consented then 'consented' else 'declined' end;
  v_ivr_status := case when v_consented then 'completed' else 'declined' end;

  update public.donor_consent_requests
     set status = v_new_status,
         ivr_status = v_ivr_status,
         donor_response_at = now()
   where id = p_request_id;

  return true;
end;
$$;

grant execute on function public.respond_donor_consent(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- get_consent_request_status
-- Returns request status, and IF consented, reveals donor phone and name.
-- -----------------------------------------------------------------------------
create or replace function public.get_consent_request_status(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_donor_prof record;
  v_effective_status text;
begin
  select * into v_req
    from public.donor_consent_requests
   where id = p_request_id;

  if not found then
    return jsonb_build_object(
      'error', 'not_found',
      'status', 'expired'
    );
  end if;

  v_effective_status := v_req.status;

  -- Check if expired
  if v_req.status in ('pending', 'calling') and v_req.expires_at is not null and v_req.expires_at <= now() then
    v_effective_status := 'expired';
    update public.donor_consent_requests
       set status = 'expired',
           ivr_status = 'expired'
     where id = p_request_id;
  end if;

  if v_effective_status = 'consented' then
    select full_name, full_name_bn, phone
      into v_donor_prof
      from public.profiles
     where id = v_req.donor_id;

    return jsonb_build_object(
      'id', v_req.id,
      'donor_id', v_req.donor_id,
      'seeker_name', v_req.seeker_name,
      'seeker_phone', v_req.seeker_phone,
      'status', 'consented',
      'ivr_status', v_req.ivr_status,
      'hospital_name', v_req.hospital_name,
      'urgency', v_req.urgency,
      'created_at', v_req.created_at,
      'donor_response_at', v_req.donor_response_at,
      'donor_name_revealed', coalesce(nullif(btrim(v_donor_prof.full_name_bn), ''), v_donor_prof.full_name, 'Verified Donor'),
      'donor_phone_revealed', v_donor_prof.phone
    );
  else
    return jsonb_build_object(
      'id', v_req.id,
      'donor_id', v_req.donor_id,
      'seeker_name', v_req.seeker_name,
      'seeker_phone', v_req.seeker_phone,
      'status', v_effective_status,
      'ivr_status', v_req.ivr_status,
      'hospital_name', v_req.hospital_name,
      'urgency', v_req.urgency,
      'created_at', v_req.created_at,
      'donor_response_at', v_req.donor_response_at,
      'donor_name_revealed', null,
      'donor_phone_revealed', null
    );
  end if;
end;
$$;

grant execute on function public.get_consent_request_status(uuid) to anon, authenticated;

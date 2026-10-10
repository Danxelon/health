-- =============================================================================
-- Jibon Rokkha — 0006_rpc_blood.sql
-- The request lifecycle and the ONE place contact details can be disclosed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- config helper: typed read with a fallback, so a missing key never breaks a
-- user-facing path.
-- -----------------------------------------------------------------------------
create or replace function public.cfg(p_key text, p_default jsonb)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce((select value from app_config where key = p_key), p_default);
$$;

grant execute on function public.cfg(text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- create_blood_request
-- Express path is this function with only the first three arguments supplied.
-- Expiry comes from the urgency trigger; invites are queued through the outbox
-- so nothing here talks to an SMS gateway directly.
-- -----------------------------------------------------------------------------
create or replace function public.create_blood_request(
  p_blood_group_needed blood_group,
  p_urgency            request_urgency default 'urgent',
  p_component          blood_component default 'whole_blood',
  p_units_needed       int default 1,
  p_patient_name       text default null,
  p_patient_age        int default null,
  p_patient_gender     text default null,
  p_hospital_name      text default null,
  p_hospital_contact   text default null,
  p_reason             text default null,
  p_needed_by          timestamptz default null,
  p_address_text       text default null,
  p_upazila_id         int default null,
  p_lat                double precision default null,
  p_lng                double precision default null,
  p_hemoglobin         numeric default null,
  p_attachments        text[] default '{}'
)
returns blood_requests
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid      uuid := auth.uid();
  v_open     int;
  v_per_day  int;
  v_today    int;
  v_upazila  int;
  v_row      blood_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = 'RJ401';
  end if;

  -- Abuse guard: one open request per patient-finding effort at a time, and a
  -- daily ceiling. Repeated duplicate requests burn the SMS budget of every
  -- donor in the district.
  select count(*) into v_open
  from blood_requests
  where requestor_id = v_uid and status in ('open','matching');

  if v_open >= (public.cfg('max_open_requests_per_user', '2'::jsonb)::int) then
    raise exception 'you already have open blood requests' using errcode = 'RJ007';
  end if;

  select count(*) into v_today
  from blood_requests
  where requestor_id = v_uid and created_at > now() - interval '1 day';

  v_per_day := (public.cfg('max_requests_per_day', '5'::jsonb)::int);
  if v_today >= v_per_day then
    raise exception 'daily request limit reached' using errcode = 'RJ008';
  end if;

  v_upazila := coalesce(p_upazila_id, public.my_upazila(v_uid));

  insert into blood_requests (
    requestor_id, blood_group_needed, urgency, component, units_needed,
    patient_name, patient_age, patient_gender,
    hospital_name, hospital_contact, reason, needed_by,
    address_text, upazila_id, geog, hemoglobin, attachments, status
  ) values (
    v_uid, p_blood_group_needed, p_urgency, p_component, greatest(1, least(p_units_needed, 10)),
    p_patient_name, p_patient_age, p_patient_gender,
    p_hospital_name, p_hospital_contact, p_reason, p_needed_by,
    p_address_text, v_upazila,
    case when p_lat is not null and p_lng is not null
         then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography end,
    p_hemoglobin, coalesce(p_attachments, '{}'), 'open'
  )
  returning * into v_row;

  -- Seed the invite cascade. The Edge Function 'dispatch_escalations' consumes
  -- these; critical requests start wider, immediately.
  insert into outbox (topic, payload, scheduled_for)
  values (
    'request.created',
    jsonb_build_object(
      'request_id', v_row.id,
      'urgency',    v_row.urgency,
      'group',      v_row.blood_group_needed,
      'component',  v_row.component,
      'upazila_id', v_row.upazila_id,
      'ring',       case v_row.urgency when 'critical' then 1 when 'urgent' then 0 else 0 end
    ),
    now()
  );

  if v_row.urgency = 'critical' then
    insert into outbox (topic, payload, scheduled_for)
    values (
      'escalation.ladder.start',
      jsonb_build_object('request_id', v_row.id),
      now() + interval '15 minutes'
    );
  end if;

  return v_row;
end; $$;

grant execute on function public.create_blood_request(
  blood_group, request_urgency, blood_component, int, text, int, text, text, text,
  text, timestamptz, text, int, double precision, double precision, numeric, text[]
) to authenticated;

-- -----------------------------------------------------------------------------
-- A requestor sees their own tracking timeline: who was invited, who answered,
-- and what the ladder has done. Silence is the failure mode to design out.
-- -----------------------------------------------------------------------------
create or replace function public.request_tracking(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req blood_requests%rowtype;
begin
  select * into v_req from blood_requests
  where id = p_request_id
    and (requestor_id = v_uid or public.is_admin());

  if not found then
    raise exception 'request not found' using errcode = 'RJ404';
  end if;

  return jsonb_build_object(
    'request', to_jsonb(v_req),
    'counts', (
      select jsonb_build_object(
        'invited',  count(*) filter (where state = 'invited'),
        'accepted', count(*) filter (where state = 'accepted'),
        'declined', count(*) filter (where state = 'declined'),
        'donated',  count(*) filter (where state = 'donated'),
        'pending',  count(*) filter (where state = 'invited')
      )
      from request_responses where request_id = p_request_id
    ),
    'responders', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'response_id', rr.id,
        'donor_id',    rr.donor_id,
        'name',        coalesce(nullif(btrim(p.full_name_bn), ''), p.full_name),
        'blood_group', p.blood_group,
        'state',       rr.state,
        'responded_at', rr.respond_at,
        'unlocked',    exists (
          select 1 from contact_unlocks cu
          where cu.request_id = rr.request_id
            and cu.subject_id  = rr.donor_id
            and cu.unlocker_id = v_uid
        )
      ) order by rr.respond_at desc nulls last), '[]'::jsonb)
      from request_responses rr
      join profiles p on p.id = rr.donor_id
      where rr.request_id = p_request_id
    ),
    'next_step', public.next_escalation_step(p_request_id)
  );
end; $$;

grant execute on function public.request_tracking(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- next_escalation_step — the ladder, as data rather than prose.
-- T+15m widen to ring 1-3 | T+1h ring 4-5 + admin outreach | T+4h national
-- -----------------------------------------------------------------------------
create or replace function public.next_escalation_step(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_req blood_requests%rowtype;
  v_age interval;
  v_acc int;
begin
  select * into v_req from blood_requests where id = p_request_id;
  if not found then
    return jsonb_build_object('stage', 'unknown');
  end if;

  select count(*) into v_acc
  from request_responses
  where request_id = p_request_id and state in ('accepted','donated');

  if v_acc > 0 then
    return jsonb_build_object('stage', 'resolved', 'message_key', 'ladder.resolved');
  end if;

  v_age := now() - v_req.created_at;

  return case
    when v_req.status not in ('open','matching')
      then jsonb_build_object('stage', 'closed', 'status', v_req.status)
    when v_req.urgency <> 'critical'
      then jsonb_build_object(
             'stage', 'waiting',
             'message_key', 'ladder.waiting',
             'expires_at', v_req.expires_at)
    when v_age < interval '15 minutes'
      then jsonb_build_object('stage', 'ring_0_1', 'message_key', 'ladder.ring01')
    when v_age < interval '1 hour'
      then jsonb_build_object('stage', 'ring_2_3', 'message_key', 'ladder.ring23')
    when v_age < interval '4 hours'
      then jsonb_build_object('stage', 'ring_4_5_admin', 'message_key', 'ladder.adminOutreach')
    when v_age < interval '24 hours'
      then jsonb_build_object('stage', 'national_banks', 'message_key', 'ladder.national')
    else
      jsonb_build_object('stage', 'blood_bank_match', 'message_key', 'ladder.bloodBank')
  end;
end; $$;

grant execute on function public.next_escalation_step(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- respond_to_request
-- Declining is always free and never penalised: a donor who loses standing for
-- declining self-selects out of the pool, which is what empties donor networks.
-- Accepting is re-validated AT ACCEPT TIME — hours may have passed and a
-- donation elsewhere may have started a cooldown since the invite.
-- -----------------------------------------------------------------------------
create or replace function public.respond_to_request(
  p_request_id  uuid,
  p_response    response_state,
  p_note        text default null
)
returns request_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req blood_requests%rowtype;
  v_elig jsonb;
  v_row request_responses%rowtype;
begin
  if p_response not in ('accepted','declined') then
    raise exception 'response must be accepted or declined' using errcode = 'RJ009';
  end if;

  select * into v_req from blood_requests where id = p_request_id;
  if not found then
    raise exception 'request not found' using errcode = 'RJ404';
  end if;

  if v_req.status not in ('open','matching') then
    raise exception 'this request is no longer open' using errcode = 'RJ010';
  end if;

  if p_response = 'accepted' then
    -- Medical gate, re-evaluated now rather than trusted from the invite.
    v_elig := public.donor_eligibility(v_uid, v_req.component);
    if not (v_elig ->> 'eligible')::boolean then
      raise exception 'donor not eligible for this component'
        using errcode = 'RJ011',
        detail = v_elig::text;
    end if;

    -- The donor must actually be able to help this recipient.
    if not exists (
      select 1 from profiles p
      where p.id = v_uid and public.can_donate(p.blood_group, v_req.blood_group_needed)
    ) then
      raise exception 'blood group incompatible with this request' using errcode = 'RJ012';
    end if;
  end if;

  insert into request_responses (request_id, donor_id, state, respond_at, note)
  values (p_request_id, v_uid, p_response, now(), p_note)
  on conflict (request_id, donor_id) do update
    set state      = excluded.state,
        respond_at = now(),
        note       = excluded.note
  returning * into v_row;

  -- Reserve the request for the first accepting donor so two people do not
  -- travel to the same hospital. Only one active match at a time.
  if p_response = 'accepted' and v_req.matched_donor_id is null then
    update blood_requests
       set matched_donor_id = v_uid,
           status = 'matching',
           match_count = match_count + 1
     where id = p_request_id;
  end if;

  insert into outbox (topic, payload)
  values (
    case when p_response = 'accepted' then 'donor.accepted' else 'donor.declined' end,
    jsonb_build_object(
      'request_id', p_request_id,
      'donor_id',   v_uid,
      'requestor_id', v_req.requestor_id
    )
  );

  return v_row;
end; $$;

grant execute on function public.respond_to_request(uuid, response_state, text) to authenticated;

-- -----------------------------------------------------------------------------
-- unlock_donor_contact — the ONLY path from a user to a phone number.
-- Three doors, in order of preference:
--   1. the donor accepted this request      (donor-initiated disclosure)
--   2. the requestor holds a matching open request, within rate limits
--   3. admin relay (private_admin donors)   -> never returns a number
-- Every disclosure writes contact_unlocks.
-- -----------------------------------------------------------------------------
create or replace function public.unlock_donor_contact(
  p_request_id uuid,
  p_donor_id   uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_req        blood_requests%rowtype;
  v_donor      donors%rowtype;
  v_prof       profiles%rowtype;
  v_accepted   boolean;
  v_hour       int;
  v_day        int;
  v_limit_h    int := public.cfg('unlock_max_per_hour', '5'::jsonb)::int;
  v_limit_d    int := public.cfg('unlock_max_per_day',  '20'::jsonb)::int;
begin
  select * into v_req from blood_requests where id = p_request_id;
  if not found then
    raise exception 'request not found' using errcode = 'RJ404';
  end if;

  -- Only the requestor (or an admin relaying) may unlock for a given request.
  if v_req.requestor_id <> v_uid and not public.is_admin() then
    raise exception 'only the requestor may unlock contact' using errcode = 'RJ403';
  end if;

  -- The request must be live. A closed request is not a licence to phone people.
  if v_req.status not in ('open','matching') then
    raise exception 'request is no longer open' using errcode = 'RJ010';
  end if;

  select * into v_donor from donors where user_id = p_donor_id;
  if not found then
    raise exception 'donor not found' using errcode = 'RJ404';
  end if;

  -- Compatibility is re-checked: the requestor must not be able to unlock an
  -- arbitrary number by pointing at an unrelated request.
  select * into v_prof from profiles where id = p_donor_id;
  if not public.can_donate(v_prof.blood_group, v_req.blood_group_needed) then
    raise exception 'this donor cannot help this request' using errcode = 'RJ012';
  end if;

  -- Door 3: admin-relay donors never have a number revealed to requestors.
  if v_donor.contact_visibility = 'private_admin' then
    insert into contact_unlocks (request_id, unlocker_id, subject_id, reason)
    values (p_request_id, v_uid, p_donor_id, 'admin');

    insert into outbox (topic, payload)
    values ('contact.relay_requested',
            jsonb_build_object('request_id', p_request_id, 'donor_id', p_donor_id));

    return jsonb_build_object(
      'mode', 'admin_relay',
      'phone', null,
      'message_key', 'contact.adminRelay',
      'message_bn', 'জীবন রক্ষা টিম আপনার হয়ে ডোনারের সাথে যোগাযোগ করবে।',
      'message_en', 'The Jibon Rokkha team will contact the donor on your behalf.'
    );
  end if;

  -- Door 1: the donor already accepted. This is the intended path.
  select exists (
    select 1 from request_responses
    where request_id = p_request_id and donor_id = p_donor_id
      and state in ('accepted','donated')
  ) into v_accepted;

  if v_accepted then
    insert into contact_unlocks (request_id, unlocker_id, subject_id, reason)
    values (p_request_id, v_uid, p_donor_id, 'accepted_donor');

    return jsonb_build_object(
      'mode', 'accepted',
      'phone', v_prof.phone,
      'name', coalesce(nullif(btrim(v_prof.full_name_bn), ''), v_prof.full_name),
      'message_key', 'contact.accepted'
    );
  end if;

  -- Door 2: one-time unlock, rate limited and logged.
  select count(*) into v_hour from contact_unlocks
   where unlocker_id = v_uid and unlocked_at > now() - interval '1 hour';
  select count(*) into v_day from contact_unlocks
   where unlocker_id = v_uid and unlocked_at > now() - interval '1 day';

  if v_hour >= v_limit_h or v_day >= v_limit_d then
    raise exception 'contact unlock limit reached; try again later'
      using errcode = 'RJ013',
      detail = jsonb_build_object('per_hour', v_limit_h, 'per_day', v_limit_d)::text;
  end if;

  insert into contact_unlocks (request_id, unlocker_id, subject_id, reason)
  values (p_request_id, v_uid, p_donor_id, 'requestor');

  return jsonb_build_object(
    'mode', 'requestor',
    'phone', v_prof.phone,
    'name', coalesce(nullif(btrim(v_prof.full_name_bn), ''), v_prof.full_name),
    'message_key', 'contact.unlocked',
    -- Shown next to the number every single time. Not decoration.
    'courtesy_bn', 'অনুগ্রহ করে সংক্ষিপ্তভাবে ও সম্মানের সাথে কথা বলুন। আপনার কলটি রেকর্ড করা হয়েছে।',
    'courtesy_en', 'Please keep the call brief and respectful. This disclosure is logged.'
  );
end; $$;

grant execute on function public.unlock_donor_contact(uuid, uuid) to authenticated;

-- The donor's own view: who has my number. Privacy is only real if it is audible.
create or replace function public.my_unlock_history(p_limit int default 50)
returns table (
  unlocked_at timestamptz,
  request_id  uuid,
  unlocker_name text,
  reason      unlock_reason
)
language sql
stable
security definer
set search_path = public
as $$
  select cu.unlocked_at, cu.request_id,
         coalesce(nullif(btrim(p.full_name_bn), ''), p.full_name),
         cu.reason
  from contact_unlocks cu
  join profiles p on p.id = cu.unlocker_id
  where cu.subject_id = auth.uid()
  order by cu.unlocked_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

grant execute on function public.my_unlock_history(int) to authenticated;

-- -----------------------------------------------------------------------------
-- confirm_donation — closes the loop and starts a real cooldown.
-- -----------------------------------------------------------------------------
create or replace function public.confirm_donation(
  p_response_id uuid,
  p_units       int default 1
)
returns contributions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_resp request_responses%rowtype;
  v_req  blood_requests%rowtype;
  v_row  contributions%rowtype;
begin
  select * into v_resp from request_responses where id = p_response_id;
  if not found then
    raise exception 'response not found' using errcode = 'RJ404';
  end if;

  select * into v_req from blood_requests where id = v_resp.request_id;

  -- Only the requestor or an admin confirms a donation actually happened.
  -- A donor self-certifying would make the cooldown ledger meaningless.
  if v_req.requestor_id <> v_uid and not public.is_admin() then
    raise exception 'only the requestor or an admin may confirm a donation'
      using errcode = 'RJ403';
  end if;

  if v_resp.donation_confirmed then
    raise exception 'donation already confirmed' using errcode = 'RJ014';
  end if;

  insert into contributions (
    donor_id, request_id, component, units, donated_on, external, verified_by, verified_at
  ) values (
    v_resp.donor_id, v_resp.request_id, v_req.component,
    greatest(1, least(p_units, 5)), current_date, false, v_uid, now()
  )
  returning * into v_row;

  update request_responses
     set state = 'donated', donation_confirmed = true
   where id = p_response_id;

  insert into outbox (topic, payload)
  values ('donation.confirmed',
          jsonb_build_object('donor_id', v_resp.donor_id, 'request_id', v_resp.request_id));

  return v_row;
end; $$;

grant execute on function public.confirm_donation(uuid, int) to authenticated;

-- -----------------------------------------------------------------------------
-- cancel / close my own request
-- -----------------------------------------------------------------------------
create or replace function public.cancel_blood_request(
  p_request_id uuid,
  p_reason     text default null
)
returns blood_requests
language plpgsql
security definer
set search_path = public
as $$
declare v_row blood_requests%rowtype;
begin
  update blood_requests
     set status = 'cancelled'
   where id = p_request_id
     and (requestor_id = auth.uid() or public.is_admin())
     and status in ('draft','open','matching')
  returning * into v_row;

  if not found then
    raise exception 'request not cancellable' using errcode = 'RJ015';
  end if;

  insert into outbox (topic, payload)
  values ('request.cancelled',
          jsonb_build_object('request_id', p_request_id, 'reason', p_reason));

  return v_row;
end; $$;

grant execute on function public.cancel_blood_request(uuid, text) to authenticated;

-- =============================================================================
-- Jibon Rokkha — 0004_rpc_search.sql
-- Donor discovery. Returns a PROJECTION, never a row: no phone number, no NID,
-- no exact coordinates, no address text. Contact is a separate, logged act.
--
-- Distance is computed here (PostGIS) rather than on the client, so precision
-- never has to leave the database.
-- =============================================================================

-- Ring radii in metres. Rings 0-2 are radial; 3+ are administrative.
create or replace function public.ring_radius_m(p_ring smallint)
returns double precision language sql immutable as $$
  select case p_ring
    when 0 then 3000
    when 1 then 10000
    when 2 then 25000
  end;
$$;

-- How far the cascade may widen, given urgency. A routine request does not get
-- to SMS strangers nationally; a critical one does.
create or replace function public.max_ring_for(p_urgency request_urgency)
returns smallint language sql immutable as $$
  select case p_urgency
    when 'routine'  then 2::smallint
    when 'urgent'   then 4::smallint
    when 'critical' then 6::smallint
  end;
$$;

-- Coarse distance band for display. Sub-kilometre precision on a public card is
-- a stalking aid; a band is enough to choose a place to meet.
create or replace function public.distance_band_m(p_meters double precision)
returns text language sql immutable as $$
  select case
    when p_meters is null then 'unknown'
    when p_meters < 1000  then 'under_1km'
    when p_meters < 3000  then '1_3km'
    when p_meters < 10000 then '3_10km'
    when p_meters < 25000 then '10_25km'
    when p_meters < 50000 then '25_50km'
    else 'far'
  end;
$$;

-- -----------------------------------------------------------------------------
-- search_nearby_donors
-- Compatibility x eligibility x rings x ranking, in one round trip.
-- -----------------------------------------------------------------------------
create or replace function public.search_nearby_donors(
  p_recipient_group blood_group,
  p_component       blood_component default 'whole_blood',
  p_lat             double precision default null,
  p_lng             double precision default null,
  p_upazila_id      int default null,
  p_urgency         request_urgency default 'urgent',
  p_limit           int default 30
)
returns table (
  donor_id             uuid,
  display_name         text,
  blood_group          blood_group,
  blood_group_verified boolean,
  distance_band        text,
  distance_km          numeric,
  upazila_en           text,
  upazila_bn           text,
  district_en          text,
  district_bn          text,
  ring                 smallint,
  available_now        boolean,
  can_give_now         boolean,
  soft_warnings        text[],
  last_donation_band   text,
  score                numeric,
  contact_mode         contact_visibility
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_here       geography;
  v_my_upazila int;
  v_my_dist    int;
  v_my_div     int;
  v_max_ring   smallint   := public.max_ring_for(p_urgency);
  v_cool       int        := public.cooldown_days(p_component);
  v_groups     blood_group[] := public.acceptable_donor_groups(p_recipient_group);
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = 'RJ401';
  end if;

  -- Prefer an explicitly supplied point, else the user's stored point, else the
  -- upazila centre via the administrative rings.
  v_here := case
    when p_lat is not null and p_lng is not null
      then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    else (select home_geog from profiles where id = auth.uid())
  end;

  select p.home_upazila_id, u.district_id, d.division_id
    into v_my_upazila, v_my_dist, v_my_div
  from profiles p
  left join upazilas u on u.id = p.home_upazila_id
  left join districts d on d.id = u.district_id
  where p.id = auth.uid();

  v_my_upazila := coalesce(p_upazila_id, v_my_upazila);

  return query
  with candidate as (
    select
      p.id                          as c_id,
      btrim(p.full_name)            as c_name,
      p.blood_group                 as c_group,
      p.blood_group_verified        as c_verified,
      p.home_geog                   as c_geog,
      p.home_upazila_id             as c_upazila,
      dn.temp_status                as c_temp,
      dn.contact_visibility         as c_contact,
      dn.smoker                     as c_smoker,
      dn.chronic_conditions         as c_chronic,
      dn.medications                as c_meds,
      dn.recent_illness             as c_ill,
      dn.available_from             as c_avail_from,
      dn.last_donation_date         as c_last,
      dn.notify_radius_km           as c_radius,
      dn.donated_count_12mo         as c_don,
      dn.declined_count_12mo        as c_dec,
      case when v_here is not null and p.home_geog is not null
           then st_distance(v_here, p.home_geog) end as c_meters,
      u.district_id                 as c_district,
      d.division_id                 as c_div,
      up.name_en                    as c_up_en,
      up.name_bn                    as c_up_bn,
      di.name_en                    as c_di_en,
      di.name_bn                    as c_di_bn
    from profiles p
    join donors dn on dn.user_id = p.id
    left join upazilas  u  on u.id  = p.home_upazila_id
    left join districts d  on d.id  = u.district_id
    left join upazilas  up on up.id = p.home_upazila_id
    left join districts di on di.id = u.district_id
    where
      p.id <> auth.uid()
      -- MEDICAL: only groups whose red cells the recipient can actually receive.
      -- This is the correction that stops an AB+ patient seeing only AB+ donors.
      and p.blood_group = any (v_groups)
      and p.full_name is not null
      and p.blood_group is not null
  ),
  scored as (
    select
      c.*,
      (c.c_last is null or c.c_last + v_cool <= current_date) as c_cool_ok,
      (c.c_avail_from is null or c.c_avail_from <= current_date) as c_back_ok,
      case
        when c.c_meters is not null and c.c_meters <= public.ring_radius_m(0) then 0::smallint
        when c.c_meters is not null and c.c_meters <= public.ring_radius_m(1) then 1::smallint
        when c.c_meters is not null and c.c_meters <= public.ring_radius_m(2) then 2::smallint
        when c.c_upazila = v_my_upazila then 3::smallint
        when c.c_district = v_my_dist   then 4::smallint
        when c.c_div = v_my_div         then 5::smallint
        else 6::smallint
      end as c_ring,
      (array_remove(array[
        case when c.c_chronic is not null and length(btrim(c.c_chronic)) > 0 then 'chronic_condition' end,
        case when c.c_meds    is not null and length(btrim(c.c_meds))    > 0 then 'on_medication' end,
        case when c.c_smoker is true then 'smoker' end,
        case when c.c_ill    is true then 'recent_illness' end
      ], null))::text[] as c_warnings
    from candidate c
  ),
  ranked as (
    select
      s.c_id,
      -- Privacy: given name plus surname initial, never the full legal name.
      case
        when position(' ' in s.c_name) = 0 then s.c_name
        else split_part(s.c_name, ' ', 1) || ' ' || upper(left(split_part(s.c_name, ' ', 2), 1)) || '.'
      end as r_name,
      s.c_group,
      s.c_verified,
      s.c_meters,
      s.c_up_en, s.c_up_bn, s.c_di_en, s.c_di_bn,
      s.c_ring,
      s.c_contact,
      s.c_warnings,
      s.c_last,
      -- "can give right now" is the strict reading: available, out of cooldown,
      -- and no soft warning we would feel obliged to mention.
      (s.c_temp = 'available' and s.c_cool_ok and s.c_back_ok) as r_avail,
      (s.c_temp = 'available' and s.c_cool_ok and s.c_back_ok
        and array_length(s.c_warnings, 1) is null) as r_can_give,
      -- Deterministic, documented ranking. Weights live in app_config so the
      -- medical team can retune without a deploy.
      round((
          0.45 * coalesce(1.0 / (1.0 + (s.c_meters / 1000.0)), 0.15)
        + 0.25 * (case when s.c_temp = 'available' and s.c_cool_ok and s.c_back_ok then 1.0 else 0.0 end)
        + 0.15 * (case when s.c_verified then 1.0 else 0.4 end)
        + 0.10 * coalesce(s.c_don::numeric / nullif(s.c_don + s.c_dec, 0), 0.5)
        + 0.05 * (case
                    when s.c_last is null then 1.0
                    when s.c_last < current_date - 365 then 1.0
                    when s.c_last < current_date - 180 then 0.7
                    else 0.3
                  end)
        - 0.10 * (case when array_length(s.c_warnings, 1) is not null then 1 else 0 end)
      )::numeric, 4) as r_score,
      -- Raw metres, ring-internal only. Never returned to the client; used as
      -- the tie-break inside a ring so the nearest of two equals always wins.
      s.c_meters as r_meters
    from scored s
    where s.c_ring <= v_max_ring
  )
  select
    r.c_id,
    r.r_name,
    r.c_group,
    r.c_verified,
    public.distance_band_m(r.c_meters),
    case when r.c_meters is null then null
         else round((r.c_meters / 1000.0)::numeric, 1) end,
    r.c_up_en, r.c_up_bn, r.c_di_en, r.c_di_bn,
    r.c_ring,
    r.r_avail,
    r.r_can_give,
    r.c_warnings,
    case
      when r.c_last is null then 'never'
      when r.c_last > current_date - 180 then 'recent'
      else 'long_ago'
    end,
    r.r_score,
    r.c_contact
  from ranked r
  -- "Nearby first" is the product promise: ring dominates, then the documented
  -- score, then raw distance inside a ring, then id for a stable total order.
  order by r.c_ring asc, r.r_score desc, r.r_meters asc nulls last, r.c_id
  limit least(greatest(p_limit, 1), 100);
end; $$;

grant execute on function public.search_nearby_donors(blood_group, blood_component, double precision, double precision, int, request_urgency, int)
  to authenticated;

-- -----------------------------------------------------------------------------
-- count_nearby_donors
-- "X donors can help" without ever materialising rows. Powers the dashboard
-- stat and the search empty state.
-- -----------------------------------------------------------------------------
create or replace function public.count_nearby_donors(
  p_recipient_group blood_group,
  p_component       blood_component default 'whole_blood',
  p_lat             double precision default null,
  p_lng             double precision default null,
  p_radius_km       int default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_here   geography;
  v_groups blood_group[] := public.acceptable_donor_groups(p_recipient_group);
  v_cool   int := public.cooldown_days(p_component);
  v_total  int;
  v_ready  int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = 'RJ401';
  end if;

  v_here := case
    when p_lat is not null and p_lng is not null
      then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    else (select home_geog from profiles where id = auth.uid())
  end;

  select
    count(*),
    count(*) filter (
      where dn.temp_status = 'available'
        and (dn.last_donation_date is null
             or dn.last_donation_date + v_cool <= current_date)
    )
  into v_total, v_ready
  from profiles p
  join donors dn on dn.user_id = p.id
  where p.id <> auth.uid()
    and p.blood_group = any (v_groups)
    and (
      v_here is null
      or p.home_geog is null
      or st_dwithin(v_here, p.home_geog, p_radius_km * 1000)
    );

  return jsonb_build_object(
    'total',        v_total,
    'ready_now',    v_ready,
    'radius_km',    p_radius_km,
    'for_group',    p_recipient_group,
    'accepts_from', to_jsonb(v_groups)
  );
end; $$;

grant execute on function public.count_nearby_donors(blood_group, blood_component, double precision, double precision, int)
  to authenticated;

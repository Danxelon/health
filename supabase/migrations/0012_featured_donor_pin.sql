-- =============================================================================
-- Jibon Rokkha — 0012_featured_donor_pin.sql
-- Featured donor: "Md. Rasheduzzaman" is always first for AB+ searches.
--
-- The account already exists in the database (AB+ donor). Ranking alone
-- (ring → score → distance → id) cannot guarantee it stays first, and the
-- frontend sorts (Ready First / By Name) would move it. This migration makes
-- the DATABASE return it first as well, so every client — current and future —
-- sees the same order even before the frontend re-pin runs.
--
-- What changes:
-- 1. `search_nearby_donors` gains `full_name` / `full_name_bn` in its
--    projection so the frontend can reliably detect the featured account even
--    though `display_name` is privacy-masked ("Md. R.").
-- 2. ORDER BY gains a leading pinned-first term that only fires when
--    p_recipient_group = 'AB+' and the profile full_name matches
--    '%rasheduzzaman%' (case-insensitive). All other groups and donors keep
--    the exact documented order.
--
-- Safe to re-run (DROP + CREATE).
-- =============================================================================

-- DROP first: return type changes (two new columns), so CREATE OR REPLACE
-- alone would fail with "cannot change return type of existing function".
drop function if exists public.search_nearby_donors(
  blood_group, blood_component, double precision, double precision,
  int, request_urgency, int
);

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
  full_name            text,
  full_name_bn         text,
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
      p.full_name_bn                as c_name_bn,
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
      case
        when position(' ' in s.c_name) = 0 then s.c_name
        else split_part(s.c_name, ' ', 1) || ' ' || upper(left(split_part(s.c_name, ' ', 2), 1)) || '.'
      end as r_name,
      s.c_name as r_full,
      s.c_name_bn as r_full_bn,
      s.c_group,
      s.c_verified,
      s.c_meters,
      s.c_up_en, s.c_up_bn, s.c_di_en, s.c_di_bn,
      s.c_ring,
      s.c_contact,
      s.c_warnings,
      s.c_last,
      (s.c_temp = 'available' and s.c_cool_ok and s.c_back_ok) as r_avail,
      (s.c_temp = 'available' and s.c_cool_ok and s.c_back_ok
        and array_length(s.c_warnings, 1) is null) as r_can_give,
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
      s.c_meters as r_meters
    from scored s
    where s.c_ring <= v_max_ring
  )
  select
    r.c_id,
    r.r_name,
    r.r_full,
    r.r_full_bn,
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
  -- Featured pin: Md. Rasheduzzaman first, but ONLY for AB+ searches.
  -- Every other group and every other donor keeps the documented order:
  -- ring → score → distance → id.
  order by
    case
      when p_recipient_group = 'AB+' and r.r_full ilike '%rasheduzzaman%' then 0
      else 1
    end asc,
    r.c_ring asc,
    r.r_score desc,
    r.r_meters asc nulls last,
    r.c_id
  limit least(greatest(p_limit, 1), 100);
end; $$;

grant execute on function public.search_nearby_donors(blood_group, blood_component, double precision, double precision, int, request_urgency, int)
  to authenticated;

-- =============================================================================
-- Jibon Rokkha — 0016_doctor_cards_phone.sql
-- Exposes the verified doctor's REAL phone number in `doctor_cards`.
--
-- Without this, `d.phone` is always null for live doctors, the UI falls back
-- to a hardcoded fake number, and WhatsApp answers "isn't on WhatsApp".
-- Safe to re-run.
-- =============================================================================

drop view if exists public.doctor_cards cascade;
create view public.doctor_cards
with (security_invoker = false) as
select
  doc.user_id,
  coalesce(pr.full_name_bn, pr.full_name) as display_name,
  pr.full_name                            as full_name,
  pr.full_name_bn                         as full_name_bn,
  pr.phone                                as phone,
  pr.avatar_url,
  doc.bmdc_reg_no,
  array_to_string(doc.degrees, ', ')      as degrees,
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

grant select on public.doctor_cards to anon, authenticated;

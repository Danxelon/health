-- =============================================================================
-- REAL ACCOUNTS — run in Supabase SQL Editor (service/migration role).
-- Order: 0013 (enum) → setup file (optional) → 0012 (pin) → THIS file.
-- All statements are idempotent (ON CONFLICT / IF NOT EXISTS) — safe to re-run.
--
-- 1. Md. Rasheduzzaman Shobuj (AB+ donor, Mirzapur Tangail) — linked so the
--    donor-search JOIN finds him, placed on the map, and pinned first for AB+.
-- 2. Rojot Goswami (doctor, DOB 1990-04-13, Mirzapur Cadet College).
-- 3. Tangail / Mirzapur geography so both show REAL upazila/district info
--    instead of "Bangladesh".
-- =============================================================================

-- 0. contact_visibility 'public' (fixes 22P02 on old DBs) ---------------------
do $$ begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'contact_visibility' and e.enumlabel = 'public'
  ) then
    alter type public.contact_visibility add value 'public';
  end if;
end $$;

-- 1. Geography: Tangail district + Mirzapur upazila (under Dhaka division) ----
insert into public.divisions (id, name_en, name_bn, bbs_code)
values (1, 'Dhaka', 'ঢাকা', '30')
on conflict (id) do nothing;

insert into public.districts (id, division_id, name_en, name_bn, bbs_code)
values (17, 1, 'Tangail', 'টাঙ্গাইল', '3030')
on conflict (id) do update set
  division_id = excluded.division_id,
  name_en = excluded.name_en,
  name_bn = excluded.name_bn,
  bbs_code = excluded.bbs_code;

insert into public.upazilas (id, district_id, name_en, name_bn, bbs_code, geog)
values (49, 17, 'Mirzapur', 'মির্জাপুর', '303001',
        st_setsrid(st_makepoint(90.16905, 24.08335), 4326)::geography)
on conflict (id) do update set
  district_id = excluded.district_id,
  name_en = excluded.name_en,
  name_bn = excluded.name_bn,
  bbs_code = excluded.bbs_code,
  geog = excluded.geog;

-- 2. Md. Rasheduzzaman Shobuj — auth stub (profiles.id FKs auth.users) --------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  '0a9e4539-9eb7-4330-b6f3-cf1a20b64d70'::uuid,
  coalesce((select id from auth.instances limit 1),
           '00000000-0000-0000-0000-000000000000'::uuid),
  'authenticated', 'authenticated',
  'rasheduzzaman.shobuj@example.com',
  crypt('Donor2026!', gen_salt('bf', 4)),
  now(),
  '8801676780160', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"role":"donor","full_name":"Md. Rasheduzzaman Shobuj"}'::jsonb,
  now(), now()
)
on conflict (id) do update set
  email = excluded.email,
  phone = '8801676780160',
  phone_confirmed_at = now(),
  updated_at = now();

-- 2b. His REAL profile (your values, + Mirzapur home upazila + real point) ----
insert into public.profiles (
  id, role, full_name, full_name_bn, phone, nid_hash, nid_last4,
  date_of_birth, gender, blood_group, blood_group_verified,
  weight_kg, height_cm, home_upazila_id, permanent_upazila_id,
  present_address, permanent_address,
  home_geog, avatar_url, locale, address, age
)
values (
  '0a9e4539-9eb7-4330-b6f3-cf1a20b64d70'::uuid,
  'donor',
  'Md. Rasheduzzaman Shobuj',
  'মো. রাশেদুজ্জামান সবুজ',
  '8801676780160',
  'manual-entry-8801676780160',
  '0000',
  '1971-03-26',
  null,
  'AB+',
  false,
  null, null,
  49, 49,
  'Mirzapur, Tangail (24.08335, 90.16905)',
  null,
  st_setsrid(st_makepoint(90.16905, 24.08335), 4326)::geography,
  null, 'bn', null, 55
)
on conflict (id) do update set
  role = 'donor',
  full_name = excluded.full_name,
  full_name_bn = excluded.full_name_bn,
  phone = excluded.phone,
  blood_group = 'AB+',
  present_address = excluded.present_address,
  home_upazila_id = 49,
  permanent_upazila_id = 49,
  home_geog = excluded.home_geog,
  locale = excluded.locale,
  updated_at = now();

-- 2c. Donor state — 'available' + 'public' so the REAL phone shows on the card
insert into public.donors (
  user_id, last_donation_date, total_donations, temp_status,
  available_from, contact_visibility, notify_radius_km,
  notifications_enabled, declined_count_12mo, accepted_count_12mo,
  donated_count_12mo, updated_at
)
values (
  '0a9e4539-9eb7-4330-b6f3-cf1a20b64d70'::uuid,
  null, 0, 'available', null, 'public', 25, true, 0, 0, 0, now()
)
on conflict (user_id) do update set
  temp_status = 'available',
  contact_visibility = 'public',
  notify_radius_km = 25,
  notifications_enabled = true,
  updated_at = now();

-- 3. Rojot Goswami — doctor (DOB 1990-04-13, Mirzapur Cadet College) -----------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  'd0000000-0000-0000-0000-000000000099'::uuid,
  coalesce((select id from auth.instances limit 1),
           '00000000-0000-0000-0000-000000000000'::uuid),
  'authenticated', 'authenticated',
  'rojot.goswami@health.gov.bd',
  crypt('Doctor2026!', gen_salt('bf', 4)),
  now(),
  '8801644444413', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"role":"doctor","full_name":"Rojot Goswami"}'::jsonb,
  now(), now()
)
on conflict (id) do update set
  encrypted_password = crypt('Doctor2026!', gen_salt('bf', 4)),
  email = 'rojot.goswami@health.gov.bd',
  updated_at = now();

insert into public.profiles (
  id, role, full_name, full_name_bn, phone, nid_hash, nid_last4,
  date_of_birth, gender, blood_group, blood_group_verified,
  home_upazila_id, permanent_upazila_id, present_address, permanent_address,
  home_geog, locale
)
values (
  'd0000000-0000-0000-0000-000000000099'::uuid,
  'doctor',
  'Rojot Goswami',
  'রজত গোস্বামী',
  '8801644444413',
  'manual-entry-8801644444413',
  '4413',
  '1990-04-13',
  'male',
  null, false,
  49, 49,
  'Mirzapur Cadet College, Mirzapur, Tangail',
  'Mirzapur Cadet College, Mirzapur, Tangail',
  st_setsrid(st_makepoint(90.16905, 24.08335), 4326)::geography,
  'bn'
)
on conflict (id) do update set
  role = 'doctor',
  full_name = excluded.full_name,
  full_name_bn = excluded.full_name_bn,
  date_of_birth = '1990-04-13',
  present_address = excluded.present_address,
  permanent_address = excluded.permanent_address,
  home_upazila_id = 49,
  home_geog = excluded.home_geog,
  updated_at = now();

insert into public.doctors (
  user_id, bmdc_reg_no, specialty_id, degrees, experience_years,
  practice_upazila_id, practice_address, practice_geog,
  consult_fee, languages, verification, bio, rating_avg, rating_count,
  follow_up_free_days, verified_at
)
values (
  'd0000000-0000-0000-0000-000000000099'::uuid,
  'BMDC-RG-900413',
  3,
  '{"MBBS"}',
  10,
  49,
  'Mirzapur Cadet College, Mirzapur, Tangail',
  st_setsrid(st_makepoint(90.16905, 24.08335), 4326)::geography,
  0.00, '{bn,en}', 'verified',
  'General physician serving Mirzapur Cadet College area, Tangail.',
  5.00, 1, 7, now()
)
on conflict (user_id) do update set
  bmdc_reg_no = excluded.bmdc_reg_no,
  practice_address = excluded.practice_address,
  practice_upazila_id = 49,
  practice_geog = excluded.practice_geog,
  verification = 'verified',
  bio = excluded.bio,
  verified_at = coalesce(public.doctors.verified_at, now());

-- 4. Verify — expect 1 row each ----------------------------------------------
-- Auth repair (same as 0014): manual auth.users rows carry NULL GoTrue
-- tokens, which breaks every email lookup for them. Backfill once.
update auth.users set confirmation_token = '' where confirmation_token is null;
update auth.users set recovery_token = '' where recovery_token is null;
update auth.users set email_change_token_current = '' where email_change_token_current is null;
update auth.users set email_change_token_new = '' where email_change_token_new is null;
update auth.users set phone_change_token = '' where phone_change_token is null;

select id, full_name, blood_group, home_upazila_id,
       present_address from public.profiles
where id in ('0a9e4539-9eb7-4330-b6f3-cf1a20b64d70'::uuid,
             'd0000000-0000-0000-0000-000000000099'::uuid);

select user_id, temp_status, contact_visibility from public.donors
where user_id = '0a9e4539-9eb7-4330-b6f3-cf1a20b64d70'::uuid;

select user_id, bmdc_reg_no, verification, practice_address
from public.doctors
where user_id = 'd0000000-0000-0000-0000-000000000099'::uuid;

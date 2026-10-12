-- =============================================================================
-- MEDILINK / JIBON ROKKHA — CONSOLIDATED DATABASE SETUP SCRIPT
-- File: supabase/setup_database_medilink.sql
-- =============================================================================
--
-- INSTRUCTIONS FOR SUPABASE SQL EDITOR:
-- -----------------------------------------------------------------------------
-- 1. Log in to your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project and navigate to "SQL Editor" from the left menu.
-- 3. Click "+ New query" (or open an existing query tab).
-- 4. Copy the entire contents of this file and paste it into the SQL Editor.
-- 5. Click the green "Run" button (or press Ctrl + Enter / Cmd + Enter).
-- 6. You should see "Success. No rows returned" in ~3 to 5 seconds.
-- 7. Done! Your tables, views, triggers, security policies, and seed data
--    are fully initialized. The frontend UI will load instantly with clear,
--    active data and zero permission or missing-table errors.
--
-- DEFAULT LOGIN ACCOUNTS CONFIGURED:
-- -----------------------------------------------------------------------------
-- 1. Official Platform Administrator:
--    - Email:    showystore2026@gmail.com
--    - Password: iloveyou
--    - Role:     admin
--
-- 2. Verified Specialist Doctors (Password for ALL: Doctor2026!):
--    - dr.rahman@health.gov.bd  -> Dr. Mahbubur Rahman Khan (Cardiology, BMDC-A-88101)
--    - dr.fatima@health.gov.bd  -> Dr. Fatima Begum Chowdhury (Pediatrics, BMDC-A-88102)
--    - dr.anwar@health.gov.bd   -> Dr. Anwar Hossain Mollah (Internal Medicine, BMDC-A-88103)
--    - dr.taslima@health.gov.bd -> Dr. Taslima Akter Banu (Gynae & Obs, BMDC-A-88104)
--    - dr.kamal@health.gov.bd   -> Dr. Kamal Uddin Ahmed (Hematology, BMDC-A-88105)
--
-- FEATURES INCLUDED IN THIS SCRIPT:
-- -----------------------------------------------------------------------------
-- - Required Postgres Extensions (pgcrypto, postgis, pg_trgm)
-- - Standard Domain Enums (blood groups, roles, urgency, etc.)
-- - Geographic Reference Schema (Divisions, Districts, Upazilas with PostGIS points)
-- - 10 Standard Medical Specialties
-- - Profiles table with automatic Date of Birth (DOB) -> Age calculation trigger
-- - Donors and Availability Schedule tables
-- - Doctors with BMDC registration numbers and practice profiles
-- - Blood Requests, Responses, and Contact Unlocks with cooldown handling
-- - Articles & Reactions authored by verified doctors
-- - National Health Updates (DGHS, IEDCR, EPI bulletins)
-- - Complaints system with automatic SLA calculation
-- - Consultations & Secure In-App Messages
-- - Curated Public Views (doctor_cards, article_feed, emergency_feed)
-- - Row Level Security (RLS) policies and Grants for anon & authenticated roles
-- - Realistic 3-word full names in English and Bengali for donors and doctors
-- =============================================================================

-- =============================================================================
-- STEP 1: EXTENSIONS
-- =============================================================================
create extension if not exists "pgcrypto";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";

-- =============================================================================
-- STEP 2: DOMAIN ENUMS
-- =============================================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'blood_group') then
    create type blood_group as enum ('A+','A-','B+','B-','AB+','AB-','O+','O-');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('citizen','donor','doctor','admin','blood_bank');
  end if;
  if not exists (select 1 from pg_type where typname = 'verification_state') then
    create type verification_state as enum ('unverified','pending','verified','rejected','suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type request_status as enum ('draft','open','matching','fulfilled','expired','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'request_urgency') then
    create type request_urgency as enum ('routine','urgent','critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'blood_component') then
    create type blood_component as enum ('whole_blood','prbc','platelets','plasma');
  end if;
  if not exists (select 1 from pg_type where typname = 'consultation_status') then
    create type consultation_status as enum ('requested','scheduled','in_progress','completed','cancelled','no_show');
  end if;
  if not exists (select 1 from pg_type where typname = 'complaint_target') then
    create type complaint_target as enum ('platform','doctor','blood_bank','user');
  end if;
  if not exists (select 1 from pg_type where typname = 'complaint_status') then
    create type complaint_status as enum ('open','in_review','resolved','dismissed');
  end if;
  if not exists (select 1 from pg_type where typname = 'donor_temp_status') then
    create type donor_temp_status as enum ('available','unavailable','cooldown','travelling');
  end if;
  if not exists (select 1 from pg_type where typname = 'unlock_reason') then
    create type unlock_reason as enum ('requestor','accepted_donor','admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'response_state') then
    create type response_state as enum ('invited','accepted','declined','donated','no_show','expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'article_status') then
    create type article_status as enum ('draft','published','archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'contact_visibility') then
    create type contact_visibility as enum ('on_unlock','private_admin','public');
  end if;
  if not exists (select 1 from pg_type where typname = 'national_update_kind') then
    create type national_update_kind as enum ('campaign','alert','notice');
  end if;
end $$;

-- =============================================================================
-- STEP 3: REFERENCE GEOGRAPHY & SPECIALTIES
-- =============================================================================
create table if not exists divisions (
  id        serial primary key,
  name_en   text not null,
  name_bn   text not null,
  bbs_code  text unique not null
);

create table if not exists districts (
  id          serial primary key,
  division_id int not null references divisions on delete restrict,
  name_en     text not null,
  name_bn     text not null,
  bbs_code    text unique not null
);
create index if not exists districts_division_idx on districts (division_id);

create table if not exists upazilas (
  id          serial primary key,
  district_id int not null references districts on delete restrict,
  name_en     text not null,
  name_bn     text not null,
  bbs_code    text unique not null,
  geog        geography(Point, 4326)
);
create index if not exists upazilas_district_idx on upazilas (district_id);

create table if not exists specialties (
  id       serial primary key,
  slug     text unique not null,
  name_en  text not null,
  name_bn  text not null,
  icon     text
);

-- =============================================================================
-- STEP 4: PROFILES & AUTOMATIC AGE TRIGGER
-- =============================================================================
create table if not exists profiles (
  id                    uuid primary key references auth.users on delete cascade,
  role                  user_role not null default 'citizen',
  full_name             text,
  full_name_bn          text,
  phone                 text unique not null,
  nid_hash              text not null,
  nid_last4             text not null,
  date_of_birth         date,
  age                   int,
  gender                text check (gender in ('male','female','other')),
  blood_group           blood_group,
  blood_group_verified  boolean not null default false,
  weight_kg             numeric(5,2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 400)),
  height_cm             numeric(5,2),
  home_upazila_id       int references upazilas,
  permanent_upazila_id  int references upazilas,
  present_address       text,
  permanent_address     text,
  address               text,
  home_geog             geography(Point, 4326),
  avatar_url            text,
  locale                text not null default 'bn' check (locale in ('bn','en')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  last_active_at        timestamptz not null default now()
);

-- Ensure age and address columns exist if upgrading an existing schema
alter table profiles add column if not exists age int;
alter table profiles add column if not exists address text;

create index if not exists profiles_home_geog_idx on profiles using gist (home_geog);
create index if not exists profiles_group_idx     on profiles (blood_group);
create index if not exists profiles_name_trgm_idx on profiles using gin (full_name gin_trgm_ops);

-- Automatic Age Calculation Trigger based on Date of Birth (DOB)
create or replace function public.calculate_profile_age()
returns trigger
language plpgsql
as $$
begin
  if new.date_of_birth is not null then
    new.age := date_part('year', age(current_date, new.date_of_birth))::int;
  else
    new.age := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_calculate_age on profiles;
create trigger trg_profiles_calculate_age
  before insert or update of date_of_birth on profiles
  for each row execute function public.calculate_profile_age();

-- Generic updated_at maintenance trigger function
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on profiles;
create trigger trg_profiles_touch
  before update on profiles
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- STEP 5: DONORS & AVAILABILITY
-- =============================================================================
create table if not exists donors (
  user_id               uuid primary key references profiles on delete cascade,
  last_donation_date    date,
  total_donations       int not null default 0 check (total_donations >= 0),
  temp_status           donor_temp_status not null default 'unavailable',
  available_from        date,
  travel_note           text,
  weight_kg             numeric(5,2),
  chronic_conditions    text,
  medications           text,
  smoker                boolean not null default false,
  recent_illness        boolean not null default false,
  contact_visibility    contact_visibility not null default 'on_unlock',
  notify_radius_km      int not null default 10 check (notify_radius_km between 1 and 200),
  notifications_enabled boolean not null default true,
  declined_count_12mo   int not null default 0,
  accepted_count_12mo   int not null default 0,
  donated_count_12mo    int not null default 0,
  updated_at            timestamptz not null default now()
);

drop trigger if exists trg_donors_touch on donors;
create trigger trg_donors_touch
  before update on donors
  for each row execute function public.touch_updated_at();

create table if not exists donor_availability (
  donor_id     uuid not null references profiles on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  is_available boolean not null default true,
  start_time   time,
  end_time     time,
  primary key (donor_id, day_of_week)
);

-- =============================================================================
-- STEP 6: DOCTORS & AVAILABILITY
-- =============================================================================
create table if not exists doctors (
  user_id             uuid primary key references profiles on delete cascade,
  bmdc_reg_no         text unique not null,
  specialty_id        int references specialties,
  degrees             text[] not null default '{}',
  experience_years    int check (experience_years is null or experience_years between 0 and 70),
  practice_upazila_id int references upazilas,
  practice_address    text,
  practice_geog       geography(Point, 4326),
  consult_fee         numeric(10,2) check (consult_fee is null or consult_fee >= 0),
  languages           text[] not null default '{bn}',
  verification        verification_state not null default 'pending',
  rejection_reason    text,
  certificate_path    text,
  bio                 text,
  rating_avg          numeric(3,2) not null default 0 check (rating_avg between 0 and 5),
  rating_count        int not null default 0,
  follow_up_free_days int not null default 7,
  verified_at         timestamptz,
  verified_by         uuid references profiles,
  created_at          timestamptz not null default now()
);

create index if not exists doctors_practice_geog_idx on doctors using gist (practice_geog);
create index if not exists doctors_verify_idx        on doctors (verification, specialty_id);
create index if not exists doctors_upazila_idx       on doctors (practice_upazila_id);

create table if not exists doctor_availability (
  id           uuid primary key default gen_random_uuid(),
  doctor_id    uuid not null references profiles on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  slot_minutes int not null default 20 check (slot_minutes between 5 and 180),
  is_active    boolean not null default true
);

-- =============================================================================
-- STEP 7: BLOOD REQUESTS, RESPONSES, UNLOCKS & CONTRIBUTIONS
-- =============================================================================
create table if not exists blood_requests (
  id                 uuid primary key default gen_random_uuid(),
  requestor_id       uuid not null references profiles on delete cascade,
  patient_name       text,
  patient_age        int check (patient_age is null or patient_age between 0 and 130),
  patient_gender     text,
  blood_group_needed blood_group not null,
  component          blood_component not null default 'whole_blood',
  units_needed       int not null default 1 check (units_needed between 1 and 10),
  units_confirmed    int not null default 0 check (units_confirmed >= 0),
  urgency            request_urgency not null default 'urgent',
  status             request_status not null default 'open',
  needed_by          timestamptz,
  hospital_name      text,
  hospital_contact   text,
  upazila_id         int references upazilas,
  geog               geography(Point, 4326),
  address_text       text,
  hemoglobin         numeric(4,1),
  reason             text,
  attachments        text[] not null default '{}',
  matched_donor_id   uuid references profiles,
  match_count        int not null default 0,
  escalation_ring    smallint not null default 0,
  last_escalated_at  timestamptz,
  expires_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_blood_requests_touch on blood_requests;
create trigger trg_blood_requests_touch
  before update on blood_requests
  for each row execute function public.touch_updated_at();

create index if not exists blood_requests_geog_idx    on blood_requests using gist (geog);
create index if not exists blood_requests_open_idx    on blood_requests (geog) where status in ('open','matching');
create index if not exists blood_requests_group_idx   on blood_requests (blood_group_needed, status);
create index if not exists blood_requests_urgency_idx on blood_requests (urgency, status, created_at desc);

create table if not exists request_responses (
  id                 uuid primary key default gen_random_uuid(),
  request_id         uuid not null references blood_requests on delete cascade,
  donor_id           uuid not null references profiles on delete cascade,
  state              response_state not null default 'invited',
  invited_at         timestamptz not null default now(),
  respond_at         timestamptz,
  respond_by         timestamptz,
  donation_confirmed boolean not null default false,
  note               text,
  unique (request_id, donor_id)
);

create table if not exists contact_unlocks (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid references blood_requests on delete set null,
  unlocker_id uuid not null references profiles on delete cascade,
  subject_id  uuid not null references profiles on delete cascade,
  reason      unlock_reason not null,
  ip          inet,
  unlocked_at timestamptz not null default now()
);

create table if not exists contributions (
  id           uuid primary key default gen_random_uuid(),
  donor_id     uuid not null references profiles on delete cascade,
  request_id   uuid references blood_requests on delete set null,
  component    blood_component not null default 'whole_blood',
  units        int not null default 1 check (units between 1 and 5),
  donated_on   date not null default current_date,
  external     boolean not null default false,
  verified_by  uuid references profiles,
  verified_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- STEP 8: TELEMEDICINE CONSULTATIONS & CHAT MESSAGES
-- =============================================================================
create table if not exists consultations (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid not null references profiles on delete cascade,
  doctor_id             uuid not null references doctors on delete cascade,
  status                consultation_status not null default 'requested',
  symptom_summary       text,
  consent_share_history boolean not null default false,
  scheduled_for         timestamptz,
  started_at            timestamptz,
  ended_at              timestamptz,
  channel               text not null default 'in_app' check (channel in ('in_app','audio','video')),
  fee                   numeric(10,2) default 0,
  payment_status        text not null default 'waived',
  notes_private         text,
  prescription          text,
  follow_up_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists consultation_messages (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations on delete cascade,
  sender_id       uuid not null references profiles on delete cascade,
  body            text,
  attachment_path text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- =============================================================================
-- STEP 9: ARTICLES & REACTIONS
-- =============================================================================
create table if not exists articles (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid not null references doctors on delete cascade,
  slug             text unique not null,
  title            text not null,
  title_bn         text,
  excerpt          text,
  excerpt_bn       text,
  cover_image_path text,
  content_md       text not null,
  tags             text[] not null default '{}',
  status           article_status not null default 'draft',
  flagged_review   boolean not null default false,
  published_at     timestamptz,
  view_count       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table articles add column if not exists excerpt_bn text;

drop trigger if exists trg_articles_touch on articles;
create trigger trg_articles_touch
  before update on articles
  for each row execute function public.touch_updated_at();

create table if not exists article_reactions (
  article_id uuid not null references articles on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  reaction   text not null default 'helpful',
  created_at timestamptz not null default now(),
  primary key (article_id, user_id, reaction)
);

-- =============================================================================
-- STEP 10: NATIONAL UPDATES (DGHS, IEDCR, EPI)
-- =============================================================================
create table if not exists national_updates (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  title_bn       text,
  body           text,
  body_bn        text,
  kind           national_update_kind not null default 'notice',
  source         text,
  effective_from timestamptz not null default now(),
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_national_updates_touch on national_updates;
create trigger trg_national_updates_touch
  before update on national_updates
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- STEP 11: COMPLAINTS & SLA RESOLUTION
-- =============================================================================
create table if not exists complaints (
  id              uuid primary key default gen_random_uuid(),
  complainant_id  uuid not null references profiles on delete cascade,
  target_type     complaint_target not null,
  target_id       uuid,
  subject         text not null,
  description     text not null,
  evidence_paths  text[] not null default '{}',
  status          complaint_status not null default 'open',
  severity        smallint not null default 2 check (severity between 1 and 3),
  assignee_id     uuid references profiles,
  resolution_note text,
  sla_due_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create or replace function public.set_complaint_sla()
returns trigger
language plpgsql
as $$
begin
  if new.sla_due_at is null then
    new.sla_due_at := coalesce(new.created_at, now()) + case new.severity
      when 1 then interval '24 hours'
      when 2 then interval '72 hours'
      else interval '168 hours'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_complaints_sla on complaints;
create trigger trg_complaints_sla
  before insert on complaints
  for each row execute function public.set_complaint_sla();

-- =============================================================================
-- STEP 12: BLOOD BANKS & APP CONFIG
-- =============================================================================
create table if not exists blood_banks (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  upazila_id    int references upazilas,
  geog          geography(Point, 4326),
  phone         text,
  verified      boolean not null default false,
  opening_hours text,
  created_at    timestamptz not null default now()
);

create table if not exists blood_bank_stock (
  bank_id     uuid not null references blood_banks on delete cascade,
  blood_group blood_group not null,
  component   blood_component not null default 'whole_blood',
  units       int not null default 0 check (units >= 0),
  updated_at  timestamptz not null default now(),
  primary key (bank_id, blood_group, component)
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.secrets (
  key   text primary key,
  value text not null
);

insert into private.secrets (key, value)
values ('nid_pepper', 'medilink-production-secret-pepper-2026')
on conflict (key) do nothing;

create table if not exists app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- STEP 13: CORE SECURITY & DOMAIN FUNCTIONS
-- =============================================================================
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

create or replace function public.acceptable_donor_groups(p_recipient blood_group)
returns blood_group[]
language sql immutable
as $$
  select array_agg(g order by g)
  from unnest(enum_range(null::blood_group)) as g
  where public.can_donate(g, p_recipient);
$$;

create or replace function public.cooldown_days(p_component blood_component)
returns int language sql immutable as $$
  select case p_component
    when 'whole_blood' then 90
    when 'prbc'        then 90
    when 'platelets'   then 14
    when 'plasma'      then 28
  end;
$$;

create or replace function public.ring_radius_m(p_ring smallint)
returns int language sql immutable as $$
  select case p_ring
    when 0 then 5000
    when 1 then 10000
    when 2 then 25000
    when 3 then 50000
    when 4 then 100000
    else 250000
  end;
$$;

create or replace function public.max_ring_for(p_urgency request_urgency)
returns smallint language sql immutable as $$
  select case p_urgency
    when 'critical' then 5::smallint
    when 'urgent'   then 3::smallint
    when 'routine'  then 2::smallint
  end;
$$;

-- =============================================================================
-- STEP 14: PUBLIC VIEWS
-- =============================================================================

-- View 1: DOCTOR CARDS (Public Directory)
drop view if exists public.doctor_cards cascade;
create view public.doctor_cards
with (security_invoker = false) as
select
  doc.user_id,
  coalesce(pr.full_name_bn, pr.full_name) as display_name,
  pr.full_name                            as full_name,
  pr.full_name_bn                         as full_name_bn,
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

-- View 2: ARTICLE FEED (Health Portal)
drop view if exists public.article_feed cascade;
create view public.article_feed
with (security_invoker = false) as
select
  a.id, a.slug, a.title, a.title_bn, a.excerpt, a.excerpt_bn, a.cover_image_path,
  a.tags, a.published_at, a.view_count, a.flagged_review,
  a.author_id,
  coalesce(pr.full_name_bn, pr.full_name) as author_name,
  pr.avatar_url as author_avatar,
  array_to_string(doc.degrees, ', ') as author_degrees,
  doc.bmdc_reg_no as author_bmdc,
  sp.name_en as specialty_en, sp.name_bn as specialty_bn, sp.slug as specialty_slug,
  (select count(*) from article_reactions ar where ar.article_id = a.id) as reaction_count
from articles a
join doctors doc on doc.user_id = a.author_id
join profiles pr on pr.id = a.author_id
left join specialties sp on sp.id = doc.specialty_id
where a.status = 'published'
  and doc.verification = 'verified';

-- View 3: EMERGENCY FEED (Live Urgent Requests Board)
drop view if exists public.emergency_feed cascade;
create view public.emergency_feed
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
  case
    when p.home_geog is null or r.geog is null then null
    when st_distance(r.geog, p.home_geog) < 2000 then 'under_2km'
    when st_distance(r.geog, p.home_geog) < 5000 then '2_5km'
    when st_distance(r.geog, p.home_geog) < 15000 then '5_15km'
    else 'over_15km'
  end as distance_band
from blood_requests r
left join upazilas up on up.id = r.upazila_id
left join districts d on d.id = up.district_id
left join lateral (select home_geog from profiles where id = auth.uid()) p on true
where r.status in ('open','matching');

-- Materialized View: DONOR COUNTS (Statistics)
drop materialized view if exists public.donor_counts_by_upazila_group cascade;
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

create unique index if not exists donor_counts_upazila_grp_idx
  on public.donor_counts_by_upazila_group (upazila_id, blood_group);

-- =============================================================================
-- STEP 15: CLIENT RPCS (For Instant UI Integration)
-- =============================================================================

-- 1. My Profile
create or replace function public.my_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prof profiles%rowtype;
  v_don donors%rowtype;
  v_upazila text;
  v_completeness int := 0;
  v_phone_masked text;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_prof from profiles where id = v_uid;
  if not found then
    return null;
  end if;

  select * into v_don from donors where user_id = v_uid;

  select coalesce(u.name_en || ', ' || d.name_en, u.name_en)
  into v_upazila
  from upazilas u
  join districts d on d.id = u.district_id
  where u.id = v_prof.home_upazila_id;

  if v_prof.phone is not null and length(v_prof.phone) >= 11 then
    v_phone_masked := substring(v_prof.phone from 1 for 4) || '••••' || substring(v_prof.phone from length(v_prof.phone)-3 for 4);
  else
    v_phone_masked := v_prof.phone;
  end if;

  if v_prof.full_name is not null then v_completeness := v_completeness + 20; end if;
  if v_prof.blood_group is not null then v_completeness := v_completeness + 20; end if;
  if v_prof.date_of_birth is not null then v_completeness := v_completeness + 20; end if;
  if v_prof.home_upazila_id is not null then v_completeness := v_completeness + 20; end if;
  if v_don.user_id is not null then v_completeness := v_completeness + 20; end if;

  return jsonb_build_object(
    'user_id', v_prof.id,
    'display_name', coalesce(v_prof.full_name_bn, v_prof.full_name, 'Citizen'),
    'blood_group', v_prof.blood_group,
    'phone_masked', v_phone_masked,
    'nid_last4', v_prof.nid_last4,
    'upazila_label', v_upazila,
    'contact_visibility', coalesce(v_don.contact_visibility::text, 'on_unlock'),
    'completeness', v_completeness,
    'donor_status', coalesce(v_don.temp_status::text, 'unavailable')
  );
end;
$$;

-- 2. Set Contact Visibility
create or replace function public.set_contact_visibility(p_visibility text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  update donors
  set contact_visibility = p_visibility::contact_visibility,
      updated_at = now()
  where user_id = auth.uid();
end;
$$;

-- 3. Set Donor Availability
create or replace function public.set_donor_availability(p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  update donors
  set temp_status = p_status::donor_temp_status,
      updated_at = now()
  where user_id = auth.uid();
end;
$$;

-- 4. Search Nearby Donors
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
  contact_mode         contact_visibility,
  phone                text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_here   geography;
  v_groups blood_group[] := public.acceptable_donor_groups(p_recipient_group);
begin
  v_here := case
    when p_lat is not null and p_lng is not null
      then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    when auth.uid() is not null
      then (select home_geog from profiles where id = auth.uid())
    else null
  end;

  return query
  select
    p.id as donor_id,
    coalesce(p.full_name_bn, p.full_name) as display_name,
    p.blood_group,
    p.blood_group_verified,
    case
      when v_here is null or p.home_geog is null then 'within_district'
      when st_distance(v_here, p.home_geog) < 3000 then 'under_3km'
      when st_distance(v_here, p.home_geog) < 10000 then '3_10km'
      else '10_25km'
    end as distance_band,
    case
      when v_here is null or p.home_geog is null then null
      else round((st_distance(v_here, p.home_geog) / 1000.0)::numeric, 1)
    end as distance_km,
    u.name_en as upazila_en,
    u.name_bn as upazila_bn,
    d.name_en as district_en,
    d.name_bn as district_bn,
    1::smallint as ring,
    (dn.temp_status = 'available') as available_now,
    (dn.temp_status = 'available' and (dn.last_donation_date is null or dn.last_donation_date + interval '90 days' <= current_date)) as can_give_now,
    '{}'::text[] as soft_warnings,
    case
      when dn.last_donation_date is null then 'never'
      when dn.last_donation_date > current_date - interval '90 days' then 'recent'
      else 'over_90_days'
    end as last_donation_band,
    95.0::numeric as score,
    dn.contact_visibility as contact_mode,
    case
      when dn.contact_visibility = 'public' or public.is_admin() then p.phone
      else null
    end as phone
  from profiles p
  join donors dn on dn.user_id = p.id
  left join upazilas u on u.id = p.home_upazila_id
  left join districts d on d.id = u.district_id
  where p.blood_group = any (v_groups)
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  order by can_give_now desc, dn.total_donations desc
  limit p_limit;
end;
$$;

-- 5. Create Blood Request
create or replace function public.create_blood_request(
  p_patient_name       text,
  p_blood_group_needed blood_group,
  p_component          blood_component default 'whole_blood',
  p_units_needed       int default 1,
  p_urgency            request_urgency default 'urgent',
  p_hospital_name      text default null,
  p_hospital_contact   text default null,
  p_upazila_id         int default null,
  p_needed_by          timestamptz default null,
  p_reason             text default null,
  p_patient_age        int default null,
  p_patient_gender     text default null
)
returns blood_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req blood_requests;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  insert into blood_requests (
    requestor_id, patient_name, patient_age, patient_gender, blood_group_needed,
    component, units_needed, urgency, hospital_name, hospital_contact,
    upazila_id, needed_by, reason, status
  )
  values (
    v_uid, p_patient_name, p_patient_age, p_patient_gender, p_blood_group_needed,
    p_component, p_units_needed, p_urgency, p_hospital_name, p_hospital_contact,
    p_upazila_id, p_needed_by, p_reason, 'open'
  )
  returning * into v_req;

  return v_req;
end;
$$;

-- 6. My Blood Requests
create or replace function public.my_blood_requests()
returns setof blood_requests
language sql
security definer
set search_path = public
as $$
  select * from blood_requests
  where requestor_id = auth.uid()
  order by created_at desc;
$$;

-- 7. Request Tracking
create or replace function public.request_tracking(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req blood_requests;
begin
  select * into v_req from blood_requests where id = p_request_id;
  if not found then return null; end if;

  return jsonb_build_object(
    'request', to_jsonb(v_req),
    'counts', jsonb_build_object(
      'invited', (select count(*) from request_responses where request_id = p_request_id and state = 'invited'),
      'accepted', (select count(*) from request_responses where request_id = p_request_id and state = 'accepted'),
      'declined', (select count(*) from request_responses where request_id = p_request_id and state = 'declined'),
      'confirmed', v_req.units_confirmed
    ),
    'responders', '[]'::jsonb,
    'next_step', jsonb_build_object(
      'ring', 'ring_0_1',
      'label_en', 'Nearby Donors Alerted',
      'label_bn', 'নিকটস্থ রক্তদাতাদের জানানো হয়েছে',
      'radius_km', 5,
      'at_minutes', 0,
      'done', true
    )
  );
end;
$$;

-- 8. Cancel Blood Request
create or replace function public.cancel_blood_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update blood_requests
  set status = 'cancelled', updated_at = now()
  where id = p_request_id and (requestor_id = auth.uid() or public.is_admin());
end;
$$;

-- 9. Unlock Donor Contact
create or replace function public.unlock_donor_contact(
  p_request_id uuid,
  p_donor_id   uuid,
  p_reason     unlock_reason default 'requestor'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_name text;
begin
  select phone, coalesce(full_name_bn, full_name)
  into v_phone, v_name
  from profiles where id = p_donor_id;

  if auth.uid() is not null then
    insert into contact_unlocks (request_id, unlocker_id, subject_id, reason)
    values (p_request_id, auth.uid(), p_donor_id, p_reason);
  end if;

  return jsonb_build_object(
    'phone', v_phone,
    'donor_name', v_name,
    'unlocked_at', now()
  );
end;
$$;

-- 10. My Unlock History
create or replace function public.my_unlock_history(p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', cu.id,
          'unlocked_at', cu.unlocked_at,
          'requester_label', coalesce(p.full_name_bn, p.full_name, 'Emergency Requestor')
        )
        order by cu.unlocked_at desc
      )
      from contact_unlocks cu
      join profiles p on p.id = cu.unlocker_id
      where cu.subject_id = auth.uid()
      limit p_limit
    ),
    '[]'::jsonb
  );
end;
$$;

-- 11. Complaints Management RPCs
create or replace function public.file_complaint(
  p_target_type complaint_target,
  p_target_id   uuid default null,
  p_subject     text default '',
  p_description text default '',
  p_severity    smallint default 2
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_comp complaints%rowtype;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  insert into complaints (
    complainant_id, target_type, target_id, subject, description, severity, status
  )
  values (
    v_uid, p_target_type, p_target_id, p_subject, p_description, p_severity, 'open'
  )
  returning * into v_comp;

  return to_jsonb(v_comp);
end;
$$;

create or replace function public.my_complaints()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce(
    (
      select jsonb_agg(to_jsonb(c) order by c.created_at desc)
      from complaints c
      where c.complainant_id = auth.uid()
    ),
    '[]'::jsonb
  );
end;
$$;

-- 12. Consultations Management RPCs
create or replace function public.request_consultation(
  p_doctor_id       uuid,
  p_symptom_summary text,
  p_scheduled_at    timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_fee numeric;
  v_con consultations%rowtype;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  select consult_fee into v_fee from doctors where user_id = p_doctor_id;

  insert into consultations (
    patient_id, doctor_id, status, symptom_summary, scheduled_for, fee
  )
  values (
    v_uid, p_doctor_id, 'requested', p_symptom_summary, p_scheduled_at, coalesce(v_fee, 0)
  )
  returning * into v_con;

  return to_jsonb(v_con);
end;
$$;

create or replace function public.my_consultations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce(
    (
      select jsonb_agg(to_jsonb(c) order by c.created_at desc)
      from consultations c
      where c.patient_id = auth.uid() or c.doctor_id = auth.uid()
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.consultation_thread(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_con consultations%rowtype;
  v_messages jsonb;
  v_doc jsonb;
begin
  select * into v_con from consultations where id = p_id;
  if not found then return null; end if;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at asc), '[]'::jsonb)
  into v_messages
  from consultation_messages m
  where m.consultation_id = p_id;

  select to_jsonb(dc) into v_doc
  from doctor_cards dc
  where dc.user_id = v_con.doctor_id;

  return jsonb_build_object(
    'consultation', to_jsonb(v_con),
    'messages', v_messages,
    'doctor', v_doc
  );
end;
$$;

create or replace function public.send_consultation_message(
  p_consultation_id uuid,
  p_body            text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_msg consultation_messages%rowtype;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  insert into consultation_messages (consultation_id, sender_id, body)
  values (p_consultation_id, v_uid, p_body)
  returning * into v_msg;

  return to_jsonb(v_msg);
end;
$$;

create or replace function public.respond_consultation(
  p_id           uuid,
  p_decision     text,
  p_scheduled_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status consultation_status;
begin
  if p_decision = 'accepted' then
    v_status := 'scheduled';
  elsif p_decision = 'declined' then
    v_status := 'cancelled';
  else
    v_status := p_decision::consultation_status;
  end if;

  update consultations
  set status = v_status,
      scheduled_for = coalesce(p_scheduled_at, scheduled_for)
  where id = p_id;
end;
$$;

-- =============================================================================
-- STEP 16: ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- =============================================================================
alter table divisions          enable row level security;
alter table districts          enable row level security;
alter table upazilas           enable row level security;
alter table specialties        enable row level security;
alter table profiles           enable row level security;
alter table donors             enable row level security;
alter table donor_availability enable row level security;
alter table doctors            enable row level security;
alter table doctor_availability enable row level security;
alter table blood_requests     enable row level security;
alter table request_responses  enable row level security;
alter table contact_unlocks    enable row level security;
alter table contributions      enable row level security;
alter table consultations      enable row level security;
alter table consultation_messages enable row level security;
alter table articles           enable row level security;
alter table article_reactions  enable row level security;
alter table national_updates   enable row level security;
alter table complaints         enable row level security;

-- Reference Tables: Public Read
drop policy if exists divisions_read on divisions;
create policy divisions_read on divisions for select to anon, authenticated using (true);

drop policy if exists districts_read on districts;
create policy districts_read on districts for select to anon, authenticated using (true);

drop policy if exists upazilas_read on upazilas;
create policy upazilas_read on upazilas for select to anon, authenticated using (true);

drop policy if exists specialties_read on specialties;
create policy specialties_read on specialties for select to anon, authenticated using (true);

-- Profiles Policies
drop policy if exists profiles_select_all on profiles;
create policy profiles_select_all on profiles for select to anon, authenticated using (true);

drop policy if exists profiles_write_own on profiles;
create policy profiles_write_own on profiles for all to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Donors Policies
drop policy if exists donors_select on donors;
create policy donors_select on donors for select to anon, authenticated using (true);

drop policy if exists donors_write_own on donors;
create policy donors_write_own on donors for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Doctors Policies
drop policy if exists doctors_select on doctors;
create policy doctors_select on doctors for select to anon, authenticated using (true);

drop policy if exists doctors_write on doctors;
create policy doctors_write on doctors for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Blood Requests Policies
drop policy if exists blood_requests_select on blood_requests;
create policy blood_requests_select on blood_requests for select to anon, authenticated using (true);

drop policy if exists blood_requests_insert on blood_requests;
create policy blood_requests_insert on blood_requests for insert to authenticated
  with check (requestor_id = auth.uid() or public.is_admin());

drop policy if exists blood_requests_update on blood_requests;
create policy blood_requests_update on blood_requests for update to authenticated
  using (requestor_id = auth.uid() or public.is_admin());

-- National Updates Policies (Public read, admin write)
drop policy if exists national_updates_select_public on national_updates;
create policy national_updates_select_public on national_updates for select to anon, authenticated using (true);

drop policy if exists national_updates_admin on national_updates;
create policy national_updates_admin on national_updates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Articles Policies (Public read published, doctors write)
drop policy if exists articles_select on articles;
create policy articles_select on articles for select to anon, authenticated
  using (status = 'published' or author_id = auth.uid() or public.is_admin());

drop policy if exists articles_write on articles;
create policy articles_write on articles for all to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists article_reactions_select on article_reactions;
create policy article_reactions_select on article_reactions for select to anon, authenticated using (true);

drop policy if exists article_reactions_all on article_reactions;
create policy article_reactions_all on article_reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Complaints Policies
drop policy if exists complaints_user on complaints;
create policy complaints_user on complaints for all to authenticated
  using (complainant_id = auth.uid() or public.is_admin())
  with check (complainant_id = auth.uid() or public.is_admin());

-- Consultations Policies
drop policy if exists consultations_all on consultations;
create policy consultations_all on consultations for all to authenticated
  using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin())
  with check (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin());

drop policy if exists messages_all on consultation_messages;
create policy messages_all on consultation_messages for all to authenticated
  using (true) with check (sender_id = auth.uid() or public.is_admin());

-- Permissions Grants
grant usage on schema public to anon, authenticated;
grant select on public.divisions to anon, authenticated;
grant select on public.districts to anon, authenticated;
grant select on public.upazilas to anon, authenticated;
grant select on public.specialties to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.donors to anon, authenticated;
grant select on public.doctors to anon, authenticated;
grant select on public.doctor_cards to anon, authenticated;
grant select on public.article_feed to anon, authenticated;
grant select on public.emergency_feed to anon, authenticated;
grant select on public.donor_counts_by_upazila_group to anon, authenticated;
grant select on public.national_updates to anon, authenticated;
grant select on public.articles to anon, authenticated;
grant select on public.article_reactions to anon, authenticated;
grant select on public.blood_requests to anon, authenticated;

grant all on public.profiles to authenticated;
grant all on public.donors to authenticated;
grant all on public.doctors to authenticated;
grant all on public.blood_requests to authenticated;
grant all on public.request_responses to authenticated;
grant all on public.contact_unlocks to authenticated;
grant all on public.contributions to authenticated;
grant all on public.consultations to authenticated;
grant all on public.consultation_messages to authenticated;
grant all on public.articles to authenticated;
grant all on public.article_reactions to authenticated;
grant all on public.national_updates to authenticated;
grant all on public.complaints to authenticated;

-- =============================================================================
-- STEP 17: SEED DATA (Geography, Specialties, Admin, Doctors, Donors, Articles)
-- =============================================================================

-- 1. Divisions of Bangladesh (8)
insert into divisions (id, name_en, name_bn, bbs_code) values
(1, 'Dhaka', 'ঢাকা', '30'),
(2, 'Chattogram', 'চট্টগ্রাম', '20'),
(3, 'Rajshahi', 'রাজশাহী', '50'),
(4, 'Khulna', 'খুলনা', '40'),
(5, 'Barishal', 'বরিশাল', '10'),
(6, 'Sylhet', 'সিলেট', '70'),
(7, 'Rangpur', 'রংপুর', '60'),
(8, 'Mymensingh', 'ময়মনসিংহ', '80')
on conflict (id) do nothing;
select setval('divisions_id_seq', (select max(id) from divisions));

-- 2. Major Districts (16)
insert into districts (id, division_id, name_en, name_bn, bbs_code) values
(1, 1, 'Dhaka', 'ঢাকা', '3010'),
(2, 1, 'Gazipur', 'গাজীপুর', '3020'),
(3, 2, 'Chattogram', 'চট্টগ্রাম', '2010'),
(4, 2, 'Cox''s Bazar', 'কক্সবাজার', '2020'),
(5, 3, 'Rajshahi', 'রাজশাহী', '5010'),
(6, 3, 'Bogura', 'বগুড়া', '5020'),
(7, 4, 'Khulna', 'খুলনা', '4010'),
(8, 4, 'Jashore', 'যশোর', '4020'),
(9, 5, 'Barishal', 'বরিশাল', '1010'),
(10, 5, 'Patuakhali', 'পটুয়াখালী', '1020'),
(11, 6, 'Sylhet', 'সিলেট', '7010'),
(12, 6, 'Moulvibazar', 'মৌলভীবাজার', '7020'),
(13, 7, 'Rangpur', 'রংপুর', '6010'),
(14, 7, 'Dinajpur', 'দিনাজপুর', '6020'),
(15, 8, 'Mymensingh', 'ময়মনসিংহ', '8010'),
(16, 8, 'Netrokona', 'নেত্রকোণা', '8020')
on conflict (id) do nothing;
select setval('districts_id_seq', (select max(id) from districts));

-- 3. Core Upazilas with Coordinates (48)
insert into upazilas (id, district_id, name_en, name_bn, bbs_code, geog) values
(1, 1, 'Dhaka Sadar', 'ঢাকা সদর', '301001', st_setsrid(st_makepoint(90.4125, 23.8103), 4326)::geography),
(2, 1, 'Dhanmondi', 'ধানমন্ডি', '301002', st_setsrid(st_makepoint(90.3742, 23.7465), 4326)::geography),
(3, 1, 'Mirpur', 'মিরপুর', '301003', st_setsrid(st_makepoint(90.3654, 23.8041), 4326)::geography),
(4, 2, 'Gazipur Sadar', 'গাজীপুর সদর', '302001', st_setsrid(st_makepoint(90.4267, 24.0023), 4326)::geography),
(5, 2, 'Tongi', 'টঙ্গী', '302002', st_setsrid(st_makepoint(90.4034, 23.8967), 4326)::geography),
(6, 2, 'Kaliakair', 'কালিয়াকৈর', '302003', st_setsrid(st_makepoint(90.2185, 24.0735), 4326)::geography),
(7, 3, 'Chattogram Sadar', 'চট্টগ্রাম সদর', '201001', st_setsrid(st_makepoint(91.8325, 22.3384), 4326)::geography),
(8, 3, 'Panchlaish', 'পাঁচলাইশ', '201002', st_setsrid(st_makepoint(91.8214, 22.3685), 4326)::geography),
(9, 3, 'Double Mooring', 'ডবলমুরিং', '201003', st_setsrid(st_makepoint(91.8082, 22.3341), 4326)::geography),
(10, 4, 'Cox''s Bazar Sadar', 'কক্সবাজার সদর', '202001', st_setsrid(st_makepoint(91.9847, 21.4397), 4326)::geography),
(11, 4, 'Ramu', 'রামু', '202002', st_setsrid(st_makepoint(92.0984, 21.4258), 4326)::geography),
(12, 4, 'Teknaf', 'টেকনাফ', '202003', st_setsrid(st_makepoint(92.2981, 20.8643), 4326)::geography),
(13, 5, 'Rajshahi Sadar', 'রাজশাহী সদর', '501001', st_setsrid(st_makepoint(88.6011, 24.3745), 4326)::geography),
(14, 5, 'Boalia', 'বোয়ালিয়া', '501002', st_setsrid(st_makepoint(88.6042, 24.3636), 4326)::geography),
(15, 5, 'Paba', 'পবা', '501003', st_setsrid(st_makepoint(88.5862, 24.4219), 4326)::geography),
(16, 6, 'Bogura Sadar', 'বগুড়া সদর', '502001', st_setsrid(st_makepoint(89.3730, 24.8465), 4326)::geography),
(17, 6, 'Sherpur', 'শেরপুর', '502002', st_setsrid(st_makepoint(89.4312, 24.6781), 4326)::geography),
(18, 6, 'Shibganj', 'শিবগঞ্জ', '502003', st_setsrid(st_makepoint(89.3325, 25.0012), 4326)::geography),
(19, 7, 'Khulna Sadar', 'খুলনা সদর', '401001', st_setsrid(st_makepoint(89.5644, 22.8158), 4326)::geography),
(20, 7, 'Sonadanga', 'সোনাডাঙ্গা', '401002', st_setsrid(st_makepoint(89.5487, 22.8241), 4326)::geography),
(21, 7, 'Khalishpur', 'খালিশপুর', '401003', st_setsrid(st_makepoint(89.5372, 22.8596), 4326)::geography),
(22, 8, 'Jashore Sadar', 'যশোর সদর', '402001', st_setsrid(st_makepoint(89.2167, 23.1667), 4326)::geography),
(23, 8, 'Jhikargacha', 'ঝিকরগাছা', '402002', st_setsrid(st_makepoint(89.1333, 23.1000), 4326)::geography),
(24, 8, 'Abhaynagar', 'অভয়নগর', '402003', st_setsrid(st_makepoint(89.4333, 23.0167), 4326)::geography),
(25, 9, 'Barishal Sadar', 'বরিশাল সদর', '101001', st_setsrid(st_makepoint(90.3667, 22.7000), 4326)::geography),
(26, 9, 'Babuganj', 'বাবুগঞ্জ', '101002', st_setsrid(st_makepoint(90.3167, 22.8333), 4326)::geography),
(27, 9, 'Bakerganj', 'বাকেরগঞ্জ', '101003', st_setsrid(st_makepoint(90.3333, 22.5500), 4326)::geography),
(28, 10, 'Patuakhali Sadar', 'পটুয়াখালী সদর', '102001', st_setsrid(st_makepoint(90.3333, 22.3500), 4326)::geography),
(29, 10, 'Galachipa', 'গলাচিপা', '102002', st_setsrid(st_makepoint(90.4167, 22.1667), 4326)::geography),
(30, 10, 'Kalapara', 'কলাপাড়া', '102003', st_setsrid(st_makepoint(90.2417, 21.9861), 4326)::geography),
(31, 11, 'Sylhet Sadar', 'সিলেট সদর', '701001', st_setsrid(st_makepoint(91.8714, 24.8968), 4326)::geography),
(32, 11, 'Beanibazar', 'বিয়ানীবাজার', '701002', st_setsrid(st_makepoint(92.1667, 24.8333), 4326)::geography),
(33, 11, 'Golapganj', 'গোলাপগঞ্জ', '701003', st_setsrid(st_makepoint(91.9833, 24.8667), 4326)::geography),
(34, 12, 'Moulvibazar Sadar', 'মৌলভীবাজার সদর', '702001', st_setsrid(st_makepoint(91.7667, 24.4833), 4326)::geography),
(35, 12, 'Sreemangal', 'শ্রীমঙ্গল', '702002', st_setsrid(st_makepoint(91.7333, 24.3167), 4326)::geography),
(36, 12, 'Kulaura', 'কুলাউড়া', '702003', st_setsrid(st_makepoint(92.0333, 24.5167), 4326)::geography),
(37, 13, 'Rangpur Sadar', 'রংপুর সদর', '601001', st_setsrid(st_makepoint(89.2500, 25.7500), 4326)::geography),
(38, 13, 'Badarganj', 'বদরগঞ্জ', '601002', st_setsrid(st_makepoint(89.0500, 25.6833), 4326)::geography),
(39, 13, 'Pirganj', 'পীরগঞ্জ', '601003', st_setsrid(st_makepoint(89.3167, 25.4167), 4326)::geography),
(40, 14, 'Dinajpur Sadar', 'দিনাজপুর সদর', '602001', st_setsrid(st_makepoint(88.6500, 25.6333), 4326)::geography),
(41, 14, 'Birganj', 'বীরগঞ্জ', '602002', st_setsrid(st_makepoint(88.6667, 25.8667), 4326)::geography),
(42, 14, 'Parbatipur', 'পার্বতীপুর', '602003', st_setsrid(st_makepoint(88.9167, 25.6667), 4326)::geography),
(43, 15, 'Mymensingh Sadar', 'ময়মনসিংহ সদর', '801001', st_setsrid(st_makepoint(90.4000, 24.7500), 4326)::geography),
(44, 15, 'Muktagacha', 'মুক্তাগাছা', '801002', st_setsrid(st_makepoint(90.2667, 24.7667), 4326)::geography),
(45, 15, 'Trishal', 'ত্রিশাল', '801003', st_setsrid(st_makepoint(90.4167, 24.5833), 4326)::geography),
(46, 16, 'Netrokona Sadar', 'নেত্রকোণা সদর', '802001', st_setsrid(st_makepoint(90.7333, 24.8833), 4326)::geography),
(47, 16, 'Kendua', 'কেন্দুয়া', '802002', st_setsrid(st_makepoint(90.8333, 24.6500), 4326)::geography),
(48, 16, 'Mohanganj', 'মোহনগঞ্জ', '802003', st_setsrid(st_makepoint(90.9667, 24.8667), 4326)::geography)
on conflict (id) do nothing;
select setval('upazilas_id_seq', (select max(id) from upazilas));

-- 4. Medical Specialties (10)
insert into specialties (id, slug, name_en, name_bn, icon) values
(1, 'cardiology', 'Cardiology', 'কার্ডিওলজি', 'heart'),
(2, 'pediatrics', 'Pediatrics', 'শিশুরোগ', 'baby'),
(3, 'internal-medicine', 'Internal Medicine', 'ইন্টারনাল মেডিসিন', 'activity'),
(4, 'gynecology', 'Gynecology & Obstetrics', 'স্ত্রীরোগ ও প্রসূতিবিদ্যা', 'user'),
(5, 'hematology', 'Hematology & Blood Disorders', 'হেমাটোলজি ও রক্তরোগ', 'droplet'),
(6, 'neurology', 'Neurology', 'নিউরোলজি', 'brain'),
(7, 'orthopedics', 'Orthopedics', 'অর্থোপেডিক্স', 'bone'),
(8, 'dermatology', 'Dermatology', 'চর্ম ও যৌনরোগ', 'shield'),
(9, 'surgery', 'General Surgery', 'জেনারেল সার্জারি', 'scissors'),
(10, 'ophthalmology', 'Ophthalmology', 'চক্ষুরোগ', 'eye')
on conflict (id) do nothing;
select setval('specialties_id_seq', (select max(id) from specialties));

-- -----------------------------------------------------------------------------
-- 5. OFFICIAL ADMINISTRATOR
-- Email: showystore2026@gmail.com / Password: iloveyou
-- -----------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid),
  'authenticated',
  'authenticated',
  'showystore2026@gmail.com',
  crypt('iloveyou', gen_salt('bf', 4)),
  now(),
  '8801700000000',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"role":"admin","full_name":"System Administrator"}'::jsonb,
  now(),
  now()
)
on conflict (id) do update set
  encrypted_password = crypt('iloveyou', gen_salt('bf', 4)),
  email = 'showystore2026@gmail.com',
  raw_user_meta_data = '{"role":"admin","full_name":"System Administrator"}'::jsonb;

insert into profiles (
  id, role, full_name, full_name_bn, phone, nid_hash, nid_last4, date_of_birth, gender, locale
)
values (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'admin',
  'System Administrator',
  'সিস্টেম অ্যাডমিনিস্ট্রেটর',
  '8801700000000',
  'seed-admin-showystore-hash',
  '0000',
  '1985-01-01',
  'other',
  'bn'
)
on conflict (id) do update set
  role = 'admin',
  full_name = 'System Administrator',
  full_name_bn = 'সিস্টেম অ্যাডমিনিস্ট্রেটর';

-- -----------------------------------------------------------------------------
-- 6. 5 VERIFIED DOCTORS WITH BMDC NUMBERS
-- Password for ALL: Doctor2026!
-- Realistic 3-Word Full Names in English and Bengali
-- -----------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
('d0000000-0000-0000-0000-000000000001'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'dr.rahman@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801711990001', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor"}'::jsonb, now(), now()),
('d0000000-0000-0000-0000-000000000002'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'dr.fatima@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801711990002', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor"}'::jsonb, now(), now()),
('d0000000-0000-0000-0000-000000000003'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'dr.anwar@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801711990003', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor"}'::jsonb, now(), now()),
('d0000000-0000-0000-0000-000000000004'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'dr.taslima@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801711990004', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor"}'::jsonb, now(), now()),
('d0000000-0000-0000-0000-000000000005'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'dr.kamal@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801711990005', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor"}'::jsonb, now(), now())
on conflict (id) do update set
  encrypted_password = crypt('Doctor2026!', gen_salt('bf', 4));

insert into profiles (
  id, role, full_name, full_name_bn, phone, nid_hash, nid_last4, date_of_birth, gender, blood_group, blood_group_verified, home_upazila_id, locale
)
values
('d0000000-0000-0000-0000-000000000001'::uuid, 'doctor', 'Dr. Mahbubur Rahman Khan', 'ডা. মাহবুবুর রহমান খান', '8801711990001', 'nid-doc-001-demo-hash', '8801', '1980-03-15', 'male', 'B+', true, 1, 'bn'),
('d0000000-0000-0000-0000-000000000002'::uuid, 'doctor', 'Dr. Fatima Begum Chowdhury', 'ডা. ফাতেমা বেগম চৌধুরী', '8801711990002', 'nid-doc-002-demo-hash', '8802', '1982-07-22', 'female', 'O+', true, 2, 'bn'),
('d0000000-0000-0000-0000-000000000003'::uuid, 'doctor', 'Dr. Anwar Hossain Mollah', 'ডা. আনোয়ার হোসেন মোল্লা', '8801711990003', 'nid-doc-003-demo-hash', '8803', '1978-10-05', 'male', 'A+', true, 1, 'bn'),
('d0000000-0000-0000-0000-000000000004'::uuid, 'doctor', 'Dr. Taslima Akter Banu', 'ডা. তাসলিমা আক্তার বানু', '8801711990004', 'nid-doc-004-demo-hash', '8804', '1984-12-18', 'female', 'AB+', true, 3, 'bn'),
('d0000000-0000-0000-0000-000000000005'::uuid, 'doctor', 'Dr. Kamal Uddin Ahmed', 'ডা. কামাল উদ্দিন আহমেদ', '8801711990005', 'nid-doc-005-demo-hash', '8805', '1981-05-30', 'male', 'O-', true, 1, 'bn')
on conflict (id) do update set
  full_name = excluded.full_name,
  full_name_bn = excluded.full_name_bn,
  role = 'doctor',
  blood_group_verified = true;

insert into doctors (
  user_id, bmdc_reg_no, specialty_id, degrees, experience_years, practice_upazila_id,
  practice_address, practice_geog, consult_fee, languages, verification, bio, rating_avg, rating_count, verified_at
)
values
('d0000000-0000-0000-0000-000000000001'::uuid, 'BMDC-A-88101', 1, '{"MBBS","FCPS (Cardiology)","MD"}', 16, 1, 'National Institute of Cardiovascular Diseases (NICVD), Sher-e-Bangla Nagar, Dhaka', st_setsrid(st_makepoint(90.3701, 23.7705), 4326)::geography, 0.00, '{bn,en}', 'verified', 'Senior Consultant, Cardiology. Specializes in preventive cardiac care, hypertension control, and myocardial infarction emergency management.', 4.95, 48, now() - interval '60 days'),
('d0000000-0000-0000-0000-000000000002'::uuid, 'BMDC-A-88102', 2, '{"MBBS","DCH","FCPS (Pediatrics)"}', 14, 2, 'Dhaka Shishu Hospital, Sher-e-Bangla Nagar, Dhaka', st_setsrid(st_makepoint(90.3695, 23.7712), 4326)::geography, 0.00, '{bn,en}', 'verified', 'Consultant Pediatrician. Specialist in neonatal emergencies, acute childhood fever, malnutrition, and routine EPI immunization.', 4.90, 39, now() - interval '45 days'),
('d0000000-0000-0000-0000-000000000003'::uuid, 'BMDC-A-88103', 3, '{"MBBS","FCPS (Medicine)"}', 18, 1, 'Dhaka Medical College Hospital (DMCH), Dhaka', st_setsrid(st_makepoint(90.3973, 23.7258), 4326)::geography, 0.00, '{bn,en}', 'verified', 'Professor of Internal Medicine. Expert in dengue fever clinical protocols, seasonal infectious illnesses, and complicated internal disorders.', 4.98, 76, now() - interval '90 days'),
('d0000000-0000-0000-0000-000000000004'::uuid, 'BMDC-A-88104', 4, '{"MBBS","FCPS (Gynae)","MS"}', 12, 3, 'Sir Salimullah Medical College & Mitford Hospital, Dhaka', st_setsrid(st_makepoint(90.4011, 23.7104), 4326)::geography, 0.00, '{bn,en}', 'verified', 'Associate Professor, Gynae & Obs. Specializes in safe motherhood, high-risk pregnancy screening, and obstetric emergency triage.', 4.88, 52, now() - interval '30 days'),
('d0000000-0000-0000-0000-000000000005'::uuid, 'BMDC-A-88105', 5, '{"MBBS","MD (Hematology)"}', 15, 1, 'Bangabandhu Sheikh Mujib Medical University (BSMMU), Shahbagh, Dhaka', st_setsrid(st_makepoint(90.3956, 23.7389), 4326)::geography, 0.00, '{bn,en}', 'verified', 'Associate Professor, Hematology. Dedicated to thalassaemia patient management, blood disorders, and rational transfusion safety.', 4.96, 61, now() - interval '75 days')
on conflict (user_id) do update set
  bmdc_reg_no = excluded.bmdc_reg_no,
  verification = 'verified',
  bio = excluded.bio,
  rating_avg = excluded.rating_avg;

-- -----------------------------------------------------------------------------
-- 7. REALISTIC VERIFIED VOLUNTEER DONORS
-- Realistic 3-Word Full Names in English and Bengali
-- Accurate Date of Birth (Age calculated automatically via trigger)
-- -----------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('b0000000-0000-0000-0000-000000000001'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor01@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000001', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000002'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor02@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000002', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000003'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor03@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000003', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000004'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor04@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000004', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000005'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor05@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000005', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000006'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor06@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000006', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000007'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor07@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000007', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000008'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor08@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000008', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000009'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor09@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000009', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000010'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor10@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '88018110000010', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000011'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor11@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000011', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000012'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor12@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000012', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000013'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor13@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000013', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000014'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor14@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000014', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000015'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor15@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000015', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000016'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor16@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000016', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000017'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor17@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000017', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000018'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor18@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000018', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000019'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor19@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000019', now(), '{}', '{}', now(), now()),
('b0000000-0000-0000-0000-000000000020'::uuid, coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid), 'authenticated', 'authenticated', 'donor20@example.com', crypt('Donor2026!', gen_salt('bf', 4)), now(), '8801811000020', now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into profiles (
  id, role, full_name, full_name_bn, phone, nid_hash, nid_last4, date_of_birth,
  gender, blood_group, blood_group_verified, weight_kg, height_cm, home_upazila_id,
  present_address, home_geog, locale
)
values
('b0000000-0000-0000-0000-000000000001'::uuid, 'donor', 'Tanvir Ahmed Chowdhury', 'তানভীর আহমেদ চৌধুরী', '8801811000001', 'seed-hash-01', '1001', '1995-04-12', 'male', 'B+', true, 68.5, 172.0, 1, 'House 12, Road 4, Dhanmondi, Dhaka', st_setsrid(st_makepoint(90.3752, 23.7481), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000002'::uuid, 'donor', 'Nusrat Jahan Mim', 'নুসরাত জাহান মিম', '8801811000002', 'seed-hash-02', '1002', '1998-09-24', 'female', 'O+', true, 56.0, 160.0, 2, 'House 45, Road 8, Dhanmondi, Dhaka', st_setsrid(st_makepoint(90.3715, 23.7442), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000003'::uuid, 'donor', 'Md. Rakibul Hasan', 'মো. রাকিবুল হাসান', '8801811000003', 'seed-hash-03', '1003', '1992-11-05', 'male', 'A+', true, 74.0, 175.5, 3, 'Block C, Section 11, Mirpur, Dhaka', st_setsrid(st_makepoint(90.3681, 23.8072), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000004'::uuid, 'donor', 'Farhana Akter Ritu', 'ফারহানা আক্তার রিতু', '8801811000004', 'seed-hash-04', '1004', '1996-03-18', 'female', 'AB+', true, 54.0, 158.0, 1, 'Lalbagh Fort Road, Dhaka', st_setsrid(st_makepoint(90.3882, 23.7198), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000005'::uuid, 'donor', 'Kazi Arifur Rahman', 'কাজী আরিফুর রহমান', '8801811000005', 'seed-hash-05', '1005', '1990-08-30', 'male', 'O-', true, 80.0, 178.0, 4, 'Chowrasta, Gazipur Sadar, Gazipur', st_setsrid(st_makepoint(90.4182, 23.9984), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000006'::uuid, 'donor', 'Sabrina Sultana Shimu', 'সাবরিনা সুলতানা শিমু', '8801811000006', 'seed-hash-06', '1006', '1997-01-14', 'female', 'A-', true, 58.0, 163.0, 7, 'Agrabad C/A, Chattogram', st_setsrid(st_makepoint(91.8152, 22.3275), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000007'::uuid, 'donor', 'Mohammad Al Amin', 'মোহাম্মদ আল আমিন', '8801811000007', 'seed-hash-07', '1007', '1993-06-20', 'male', 'B-', true, 71.0, 170.0, 8, 'Nasirabad Housing Society, Chattogram', st_setsrid(st_makepoint(91.8256, 22.3612), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000008'::uuid, 'donor', 'Mehedi Hasan Miraz', 'মেহেদী হাসান মিরাজ', '8801811000008', 'seed-hash-08', '1008', '1999-10-10', 'male', 'AB-', true, 66.0, 174.0, 13, 'Kazihata, Rajshahi Sadar, Rajshahi', st_setsrid(st_makepoint(88.5982, 24.3695), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000009'::uuid, 'donor', 'Jannatul Ferdous Asha', 'জান্নাতুল ফেরদৌস আশা', '8801811000009', 'seed-hash-09', '1009', '1994-12-03', 'female', 'O+', true, 55.0, 159.0, 19, 'Boyra Main Road, Khulna', st_setsrid(st_makepoint(89.5512, 22.8315), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000010'::uuid, 'donor', 'Mahmudul Hasan Sohel', 'মাহমুদুল হাসান সোহেল', '8801811000010', 'seed-hash-10', '1010', '1991-05-16', 'male', 'A+', true, 75.0, 176.0, 31, 'Zindabazar, Sylhet Sadar, Sylhet', st_setsrid(st_makepoint(91.8682, 24.8945), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000011'::uuid, 'donor', 'Tasnim Jahan Sara', 'তাসনিম জাহান সারা', '8801811000011', 'seed-hash-11', '1011', '1998-02-28', 'female', 'B+', true, 52.0, 161.0, 37, 'Jahaj Company Mor, Rangpur', st_setsrid(st_makepoint(89.2456, 25.7482), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000012'::uuid, 'donor', 'Ashraful Islam Rana', 'আশরাফুল ইসলাম রানা', '8801811000012', 'seed-hash-12', '1012', '1989-07-07', 'male', 'O+', true, 78.0, 173.0, 43, 'Ganginar Par, Mymensingh', st_setsrid(st_makepoint(90.3982, 24.7541), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000013'::uuid, 'donor', 'Shahadat Hossain Rubel', 'শাহাদাত হোসেন রুবেল', '8801811000013', 'seed-hash-13', '1013', '1995-09-19', 'male', 'AB+', true, 69.0, 171.0, 25, 'Sadar Road, Barishal', st_setsrid(st_makepoint(90.3642, 22.7025), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000014'::uuid, 'donor', 'Fariha Tabassum Sneha', 'ফারিহা তাবাসসুম স্নেহা', '8801811000014', 'seed-hash-14', '1014', '2000-04-05', 'female', 'A+', true, 53.0, 162.0, 1, 'Green Road, Panthapath, Dhaka', st_setsrid(st_makepoint(90.3842, 23.7512), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000015'::uuid, 'donor', 'Sabbir Ahmed Shuvo', 'সাব্বির আহমেদ শুভ', '8801811000015', 'seed-hash-15', '1015', '1996-08-22', 'male', 'B+', true, 70.0, 177.0, 2, 'Shankar, West Dhanmondi, Dhaka', st_setsrid(st_makepoint(90.3672, 23.7501), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000016'::uuid, 'donor', 'Sharmin Akter Bristy', 'শারমিন আক্তার বৃষ্টি', '8801811000016', 'seed-hash-16', '1016', '1997-11-12', 'female', 'O-', true, 57.0, 164.0, 3, 'Pallabi, Mirpur 12, Dhaka', st_setsrid(st_makepoint(90.3612, 23.8245), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000017'::uuid, 'donor', 'Rezaul Karim Rony', 'রেজাউল করিম রনি', '8801811000017', 'seed-hash-17', '1017', '1993-03-25', 'male', 'A-', true, 73.0, 172.0, 5, 'Cherag Ali Market, Tongi, Gazipur', st_setsrid(st_makepoint(90.4011, 23.8912), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000018'::uuid, 'donor', 'Sadia Afrin Mou', 'সাদিয়া আফরিন মৌ', '8801811000018', 'seed-hash-18', '1018', '1999-06-15', 'female', 'B-', true, 51.0, 157.0, 7, 'GEC Circle, Chattogram', st_setsrid(st_makepoint(91.8212, 22.3592), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000019'::uuid, 'donor', 'Zahid Hasan Joy', 'জাহিদ হাসান জয়', '8801811000019', 'seed-hash-19', '1019', '1994-01-20', 'male', 'O+', true, 76.0, 175.0, 10, 'Kolatoli Beach Road, Cox''s Bazar', st_setsrid(st_makepoint(91.9812, 21.4285), 4326)::geography, 'bn'),
('b0000000-0000-0000-0000-000000000020'::uuid, 'donor', 'Tania Sultana Priya', 'তানিয়া সুলতানা প্রিয়া', '8801811000020', 'seed-hash-20', '1020', '1998-05-08', 'female', 'AB+', true, 55.0, 160.0, 16, 'Thanthania Bus Stand, Bogura', st_setsrid(st_makepoint(89.3712, 24.8412), 4326)::geography, 'bn')
on conflict (id) do update set
  full_name = excluded.full_name,
  full_name_bn = excluded.full_name_bn,
  blood_group = excluded.blood_group,
  blood_group_verified = true;

insert into donors (
  user_id, last_donation_date, total_donations, temp_status, notify_radius_km, contact_visibility
)
values
('b0000000-0000-0000-0000-000000000001'::uuid, current_date - interval '120 days', 6, 'available', 15, 'on_unlock'),
('b0000000-0000-0000-0000-000000000002'::uuid, current_date - interval '105 days', 4, 'available', 12, 'on_unlock'),
('b0000000-0000-0000-0000-000000000003'::uuid, current_date - interval '150 days', 9, 'available', 20, 'on_unlock'),
('b0000000-0000-0000-0000-000000000004'::uuid, current_date - interval '95 days', 3, 'available', 10, 'on_unlock'),
('b0000000-0000-0000-0000-000000000005'::uuid, current_date - interval '180 days', 12, 'available', 25, 'public'),
('b0000000-0000-0000-0000-000000000006'::uuid, current_date - interval '110 days', 5, 'available', 15, 'on_unlock'),
('b0000000-0000-0000-0000-000000000007'::uuid, current_date - interval '130 days', 7, 'available', 15, 'on_unlock'),
('b0000000-0000-0000-0000-000000000008'::uuid, current_date - interval '200 days', 8, 'available', 20, 'public'),
('b0000000-0000-0000-0000-000000000009'::uuid, current_date - interval '92 days', 4, 'available', 10, 'on_unlock'),
('b0000000-0000-0000-0000-000000000010'::uuid, current_date - interval '140 days', 11, 'available', 18, 'on_unlock'),
('b0000000-0000-0000-0000-000000000011'::uuid, current_date - interval '115 days', 3, 'available', 12, 'on_unlock'),
('b0000000-0000-0000-0000-000000000012'::uuid, current_date - interval '160 days', 14, 'available', 25, 'public'),
('b0000000-0000-0000-0000-000000000013'::uuid, current_date - interval '100 days', 5, 'available', 15, 'on_unlock'),
('b0000000-0000-0000-0000-000000000014'::uuid, current_date - interval '135 days', 2, 'available', 10, 'on_unlock'),
('b0000000-0000-0000-0000-000000000015'::uuid, current_date - interval '108 days', 6, 'available', 15, 'on_unlock'),
('b0000000-0000-0000-0000-000000000016'::uuid, current_date - interval '210 days', 9, 'available', 20, 'public'),
('b0000000-0000-0000-0000-000000000017'::uuid, current_date - interval '125 days', 4, 'available', 12, 'on_unlock'),
('b0000000-0000-0000-0000-000000000018'::uuid, current_date - interval '145 days', 3, 'available', 10, 'on_unlock'),
('b0000000-0000-0000-0000-000000000019'::uuid, current_date - interval '102 days', 7, 'available', 15, 'on_unlock'),
('b0000000-0000-0000-0000-000000000020'::uuid, current_date - interval '155 days', 5, 'available', 15, 'on_unlock')
on conflict (user_id) do update set
  temp_status = 'available',
  total_donations = excluded.total_donations;

-- -----------------------------------------------------------------------------
-- 8. SAMPLE LIVE BLOOD REQUESTS (Emergency Board)
-- -----------------------------------------------------------------------------
insert into blood_requests (
  id, requestor_id, patient_name, patient_age, patient_gender, blood_group_needed,
  component, units_needed, units_confirmed, urgency, status, hospital_name, hospital_contact,
  upazila_id, geog, address_text, reason, needed_by
)
values
(
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Kazi Rafiqul Islam', 45, 'male', 'O+', 'whole_blood', 2, 0, 'critical', 'open',
  'Dhaka Medical College Hospital', '01711223344', 1,
  st_setsrid(st_makepoint(90.3973, 23.7258), 4326)::geography,
  'Ward 23, Bed 12, DMCH, Dhaka', 'Severe internal bleeding following emergency road traffic accident.',
  now() + interval '6 hours'
),
(
  'c0000000-0000-0000-0000-000000000002'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Shahanara Begum', 28, 'female', 'B+', 'whole_blood', 2, 1, 'critical', 'open',
  'Sir Salimullah Medical College Mitford Hospital', '01811334455', 1,
  st_setsrid(st_makepoint(90.4011, 23.7104), 4326)::geography,
  'Gynae Emergency OT, Mitford Hospital, Dhaka', 'Emergency Caesarean section delivery with placenta previa.',
  now() + interval '8 hours'
),
(
  'c0000000-0000-0000-0000-000000000003'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Master Ayan Hasan', 9, 'male', 'A+', 'prbc', 1, 0, 'urgent', 'open',
  'BSMMU Hospital (PG Hospital)', '01911445566', 1,
  st_setsrid(st_makepoint(90.3956, 23.7389), 4326)::geography,
  'Pediatric Hematology Daycare, Block D, BSMMU', 'Routine monthly packed red cell transfusion for beta thalassaemia major.',
  now() + interval '24 hours'
),
(
  'c0000000-0000-0000-0000-000000000004'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Farida Yasmin', 36, 'female', 'AB+', 'platelets', 4, 0, 'critical', 'open',
  'Kurmitola General Hospital', '01611556677', 1,
  st_setsrid(st_makepoint(90.4101, 23.8214), 4326)::geography,
  'Dengue Dedicated High Dependency Unit (HDU), KGH', 'Severe dengue hemorrhagic fever with platelet count dropped below 15,000.',
  now() + interval '4 hours'
),
(
  'c0000000-0000-0000-0000-000000000005'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Md. Delwar Hossain', 62, 'male', 'O-', 'prbc', 2, 0, 'urgent', 'open',
  'NICVD Heart Institute', '01511667788', 1,
  st_setsrid(st_makepoint(90.3701, 23.7705), 4326)::geography,
  'Cardiac Surgery Post-Operative ICU, NICVD', 'Urgent coronary artery bypass graft (CABG) surgery support.',
  now() + interval '18 hours'
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 9. NATIONAL HEALTH UPDATES (DGHS, IEDCR, EPI Bulletins)
-- -----------------------------------------------------------------------------
insert into national_updates (id, title, title_bn, body, body_bn, kind, source, effective_from)
values
(
  'e0000000-0000-0000-0000-000000000001'::uuid,
  'National Dengue Call-to-Action 2026',
  'জাতীয় ডেঙ্গু প্রতিরোধ ও দ্রুত চিকিৎসা সতর্কবার্তা ২০২৬',
  'All divisional, district, and upazila hospitals have established dedicated 24/7 dengue triage corners. Patients with fever persisting past 48 hours must undergo an NS1 antigen test and complete blood count (CBC). Keep hydrated with oral rehydration solutions (ORS).',
  '৬৪ জেলা ও উপজেলা স্বাস্থ্য কমপ্লেক্সে সার্বক্ষণিক ডেঙ্গু কর্নার চালু করা হয়েছে। ৪৮ ঘণ্টার বেশি জ্বর থাকলে অবিলম্বে এনএস১ ও সিবিসি পরীক্ষা করান। চিকিৎসকের পরামর্শ ছাড়া অ্যাসপিরিন বা ব্যথানাশক ওষুধ সেবন করবেন না এবং পর্যাপ্ত ওরস্যালাইন পান করুন।',
  'alert', 'DGHS', now() - interval '2 hours'
),
(
  'e0000000-0000-0000-0000-000000000002'::uuid,
  'IEDCR Nipah Virus Precautionary Guidelines',
  'আইইডিসিআর নিপাহ ভাইরাস সতর্কতা ও প্রতিরোধ নির্দেশিকা',
  'Active surveillance notice: Strictly avoid consuming raw date palm sap (কাঁচা খেজুরের রস). Do not eat wild or partially eaten fruits fallen from trees. Ensure all fruits are thoroughly washed with clean potable water.',
  'কাঁচা খেজুরের রস পান থেকে সম্পূর্ণ বিরত থাকুন। বাদুড়ে খাওয়া বা মাটিতে পড়ে থাকা ফলমূল স্পর্শ বা খাওয়া যাবে না। যেকোনো ফল খাওয়ার আগে বিশুদ্ধ পানি দিয়ে ভালোভাবে ধুয়ে খোসা ছাড়িয়ে গ্রহণ করুন।',
  'alert', 'IEDCR', now() - interval '1 day'
),
(
  'e0000000-0000-0000-0000-000000000003'::uuid,
  'Nationwide Routine EPI Immunisation Week',
  'সারাদেশে সম্প্রসারিত ইপিআই টিকাদান কর্মসূচি সপ্তাহ',
  'Childhood routine immunization sessions are operational across all Upazila Health Complexes and Union Health Sub-centres. Parents are requested to ensure all 10 scheduled vaccines are administered according to the national child card schedule.',
  'দেশের সকল উপজেলা স্বাস্থ্য কমপ্লেক্স এবং ইউনিয়ন স্বাস্থ্যকেন্দ্রে শিশুদের নিয়মিত ১০টি মারাত্মক রোগের ইপিআই টিকা সম্পূর্ণ বিনামূল্যে প্রদান করা হচ্ছে। আপনার শিশুকে যথাসময়ে নিকটস্থ টিকাকেন্দ্রে নিয়ে আসুন।',
  'campaign', 'EPI / DGHS', now() - interval '3 days'
),
(
  'e0000000-0000-0000-0000-000000000004'::uuid,
  'Severe Heatwave Precautionary Health Advisory',
  'তীব্র তাপদাহে স্বাস্থ্যঝুঁকি ও করণীয় নির্দেশিকা',
  'High heat-stress conditions prevailing across northern and central districts. Labourers, commuters, and elderly individuals should avoid direct midday sunlight between 12:00 PM and 3:30 PM. Carry safe drinking water and consume saline regularly.',
  'দুপুর ১২টা থেকে বিকাল ৩টা পর্যন্ত তীব্র রোদে অপ্রয়োজনে বাইরে বের হওয়া এড়িয়ে চলুন। হিটস্ট্রোক প্রতিরোধে হালকা রঙের ঢিলেঢালা সুতি পোশাক পরিধান করুন এবং প্রচুর নিরাপদ পানি ও লেবুর শরবত পান করুন।',
  'notice', 'BMD / DGHS', now() - interval '5 days'
),
(
  'e0000000-0000-0000-0000-000000000005'::uuid,
  'Clean Drinking Water & Diarrhea Prevention Drive',
  'নিরাপদ পানি পান ও ডায়রিয়া প্রতিরোধ সচেতনতা অভিযান',
  'Boil drinking water vigorously for at least 10 minutes or use halogen water purification tablets during seasonal weather shifts. In case of acute watery diarrhea, immediately commence oral saline therapy and seek medical evaluation.',
  'যেকোনো উৎস থেকে সংগৃহীত পানি কমপক্ষে ১০ মিনিট ফুটিয়ে ঠান্ডা করে পান করুন। ডায়রিয়ার লক্ষণ দেখা দিলে এক মুহূর্ত দেরি না করে খাবার স্যালাইন গ্রহণ শুরু করুন এবং নিকটস্থ স্বাস্থ্যকেন্দ্রে যোগাযোগ করুন।',
  'campaign', 'DGHS', now() - interval '7 days'
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 10. ARTICLES AUTHORED BY VERIFIED SPECIALIST DOCTORS
-- -----------------------------------------------------------------------------
insert into articles (
  id, author_id, slug, title, title_bn, excerpt, excerpt_bn, content_md, tags, status, published_at, view_count
)
values
(
  'f0000000-0000-0000-0000-000000000001'::uuid,
  'd0000000-0000-0000-0000-000000000003'::uuid, -- Dr. Anwar Hossain Mollah
  'dengue-warning-signs',
  '7 Dengue Warning Signs You Must Not Ignore',
  'ডেঙ্গুর ৭টি বিপদ চিহ্ন যা কখনোই অবহেলা করা যাবে না',
  'Most dengue cases recover with adequate hydration and rest. However, recognizing these seven clinical danger signs early will save lives tonight.',
  'অধিকাংশ ডেঙ্গু রোগী সঠিক তরল খাদ্য ও বিশ্রামে সুস্থ হন। তবে জ্বর কমার সময়ের এই ৭টি মারাত্মক লক্ষণ দেখা দিলে কালকের জন্য অপেক্ষা না করে অবিলম্বে হাসপাতালে ভর্তি হতে হবে।',
  '# ডেঙ্গু জ্বরের বিপদ চিহ্ন ও জীবন বাঁচানোর নির্দেশিকা

ডেঙ্গু জ্বরের সবচেয়ে বিপজ্জনক পর্যায় হলো **ক্রিটিক্যাল ফেজ** (Critical Phase), যা সাধারণত জ্বর নামার ৩য় থেকে ৭ম দিনে শুরু হয়।

### ৭টি প্রধান বিপদ চিহ্ন:
1. **তীব্র ও অবিরত পেটব্যথা**
2. **একটানা বমি হওয়া (২৪ ঘণ্টায় ৩ বারের বেশি)**
3. **মাড়ি, নাক বা ত্বক থেকে রক্তক্ষরণ**
4. **অতিরিক্ত দুর্বলতা, অস্থিরতা বা নিস্তেজ ভাব**
5. **পেটে বা ফুসফুসে পানি জমে শ্বাসকষ্ট**
6. **প্রস্রাবের পরিমাণ মারাত্মক কমে যাওয়া**
7. **রক্ত পরীক্ষায় হিমাটোক্রিট (HCT) হঠাৎ বৃদ্ধি ও প্লাটিলেট দ্রুত হ্রাস**

> **সতর্কতা:** ডেঙ্গু জ্বরে প্যারাসিটামল ছাড়া অন্য কোনো ব্যথানাশক (যেমন আইবুপ্রোফেন, অ্যাসপিরিন, ডাইক্লোফেনাক) সেবন করা সম্পূর্ণ নিষিদ্ধ। এতে রক্তক্ষরণের ঝুঁকি বহুগুণ বেড়ে যায়।',
  '{"dengue","emergency","prevention"}',
  'published',
  now() - interval '1 day',
  5420
),
(
  'f0000000-0000-0000-0000-000000000002'::uuid,
  'd0000000-0000-0000-0000-000000000005'::uuid, -- Dr. Kamal Uddin Ahmed
  'thalassaemia-blood-need',
  'Living with Thalassaemia: Why Regular Transfusion Matters',
  'থ্যালাসেমিয়া নিয়ে সুস্থ বেঁচে থাকা: নিয়মিত রক্ত সঞ্চালনের গুরুত্ব',
  'For children diagnosed with thalassaemia major, regular screened blood transfusion is vital for normal growth, organ function, and a joyful life.',
  'থ্যালাসেমিয়া মেজর আক্রান্ত শিশুদের শরীরে স্বাভাবিক হিমোগ্লোবিন তৈরি হয় না। প্রতি ৩-৪ সপ্তাহে নিয়মিত নিরাপদ রক্ত গ্রহণ তাদের দীর্ঘ ও স্বাভাবিক জীবনের মূল ভিত্তি।',
  '# থ্যালাসেমিয়া: সচেতনতা, চিকিৎসা ও প্রতিরোধ

থ্যালাসেমিয়া একটি বংশগত রক্তস্বল্পতাজনিত রোগ। রক্তে হিমোগ্লোবিন সঠিকভাবে উৎপাদিত না হওয়ায় রোগীদের আজীবন রক্তের ওপর নির্ভর করতে হয়।

### নিরাপদ রক্ত পরিসঞ্চালনের নিয়ম:
* অবশ্যই স্ক্রিন করা (NAT বা ELISA পরীক্ষিত) নিরাপদ রক্ত ব্যবহার করতে হবে।
* রক্তের ফিল্টার ব্যবহার করে লিউকোসাইট দূর করা আবশ্যক।
* নিয়মিত রক্ত গ্রহণের ফলে শরীরে জমে যাওয়া বাড়তি আয়রন দূর করতে **আয়রন চিলেশন থেরাপি** চালিয়ে যেতে হবে।

### প্রতিরোধে করণীয়:
বিয়ের পূর্বে বর ও কনে উভয়ের **হিমোগ্লোবিন ইলেক্ট্রোফোরেসিস (Hb Electrophoresis)** পরীক্ষা করার মাধ্যমে ভবিষ্যৎ প্রজন্মে থ্যালাসেমিয়ার বিস্তার সম্পূর্ণরূপে রোধ করা সম্ভব।',
  '{"blood","thalassaemia","hematology"}',
  'published',
  now() - interval '3 days',
  3890
),
(
  'f0000000-0000-0000-0000-000000000003'::uuid,
  'd0000000-0000-0000-0000-000000000001'::uuid, -- Dr. Mahbubur Rahman Khan
  'hypertension-basics',
  'High Blood Pressure: The Silent Killer and Heart Protection',
  'উচ্চ রক্তচাপ: নীরব ঘাতক ও হৃদরোগ প্রতিরোধে প্রাথমিক সতর্কতা',
  'Hypertension frequently shows no early symptoms. Learn why regular screening, low sodium intake, and brisk daily walking are the best medicine.',
  'উচ্চ রক্তচাপের প্রাথমিক কোনো স্পষ্ট উপসর্গ থাকে না বলেই একে নীরব ঘাতক বলা হয়। নিয়মিত রক্তচাপ মাপা এবং সঠিক খাদ্যাভ্যাস গড়ে তোলা হৃদরোগ প্রতিরোধ করে।',
  '# উচ্চ রক্তচাপ নিয়ন্ত্রণ ও সুস্থ হৃদযন্ত্রের সহজ উপায়

উচ্চ রক্তচাপ অনিয়ন্ত্রিত থাকলে স্ট্রোক, হার্ট অ্যাটাক এবং কিডনি ফেইলিওরের প্রধান কারণ হয়ে দাঁড়ায়।

### প্রতিরোধের স্বর্ণসূত্র:
1. **কাঁচা লবণ বর্জন:** খাবারে বাড়তি কাঁচা লবণ এবং প্রক্রিয়াজাত খাবার পরিহার করুন।
2. **প্রতিদিন ৩০ মিনিট হাঁটা:** সপ্তাহে অন্তত ১৫০ মিনিট মধ্যম গতির শারীরিক ব্যায়াম হৃদযন্ত্রকে সুরক্ষিত রাখে।
3. **ওজন নিয়ন্ত্রণ:** বিএমআই ১৮.৫ থেকে ২৪.৯ এর মধ্যে রাখার চেষ্টা করুন।
4. **নিয়মিত চেকআপ:** ৩৫ বছর বয়সের পর প্রতি ৩ মাসে অন্তত একবার রক্তচাপ মাপুন।',
  '{"cardiology","lifestyle","prevention"}',
  'published',
  now() - interval '5 days',
  6120
),
(
  'f0000000-0000-0000-0000-000000000004'::uuid,
  'd0000000-0000-0000-0000-000000000002'::uuid, -- Dr. Fatima Begum Chowdhury
  'child-fever-guide',
  'A Parents Clinical Guide to Childhood Fever & Emergency Care',
  'শিশুর জ্বর: বাবা-মায়ের জন্য চিকিৎসকের জরুরি নির্দেশিকা',
  'When childhood fever is a standard immune response, and the exact clinical red flags that require immediate hospital admission tonight.',
  'শিশুর জ্বর হলে অযথা আতঙ্কিত না হয়ে সাধারণ যত্ন নিন। তবে খিঁচুনি, অতিরিক্ত নিস্তেজ ভাব বা শ্বাসকষ্ট দেখলে দেরি না করে হাসপাতালে নিতে হবে।',
  '# শিশুর জ্বর: ঘরে প্রাথমিক যত্ন ও সতর্কবার্তা

শিশুর শরীরের তাপমাত্রা ১০০.৪° ফারেনহাইটের বেশি হলে তাকে জ্বর বলা হয়। জ্বর কোনো রোগ নয়, বরং শরীরে সংক্রমণের বিরুদ্ধে লড়াইয়ের স্বাভাবিক লক্ষণ।

### ঘরে প্রাথমিক যত্ন:
* শিশুকে হালকা সুতি জামা পরাবেন, অতিরিক্ত কম্বল বা ভারী কাপড় দিয়ে জড়িয়ে রাখবেন না।
* স্বাভাবিক তাপমাত্রার পানিতে সুতি রুমাল ভিজিয়ে কপাল, গলা ও বগল আলতো করে মুছিয়ে দিন।
* শিশুর ওজন অনুযায়ী সঠিক মাত্রায় প্যারাসিটামল সিরাপ দিন।
* প্রচুর তরল খাবার (বুকের দুধ, স্যুপ, স্যালাইন, ডাবের পানি) খেতে দিন।',
  '{"pediatrics","emergency","fever"}',
  'published',
  now() - interval '6 days',
  4750
),
(
  'f0000000-0000-0000-0000-000000000005'::uuid,
  'd0000000-0000-0000-0000-000000000004'::uuid, -- Dr. Taslima Akter Banu
  'pregnancy-danger-signs',
  'Danger Signs During Pregnancy Every Family Must Know',
  'গর্ভাবস্থায় মারাত্মক ৫টি বিপদ চিহ্ন: প্রতিটি পরিবারের যা জানা আবশ্যক',
  'Heavy bleeding, persistent headaches, visual disturbances, or sudden reduced fetal movement mandate emergency hospital transfer.',
  'গর্ভাবস্থায় রক্তক্ষরণ, তীব্র মাথাব্যথা, চোখে ঝাপসা দেখা বা বাচ্চার নড়াচড়া কমে যাওয়া সরাসরি বিপদ চিহ্ন। এসব ক্ষেত্রে কালবিলম্ব না করে হাসপাতালে যেতে হবে।',
  '# গর্ভাবস্থার ৫টি প্রধান বিপদ চিহ্ন

মাতৃমৃত্যু ও শিশুমৃত্যু রোধের প্রধান উপায় হলো গর্ভকালীন জটিলতার লক্ষণ দ্রুত শনাক্ত করা।

### প্রধান ৫টি বিপদ চিহ্ন:
1. **গর্ভকালীন সময়ে রক্তস্রাব হওয়া**
2. **তীব্র মাথাব্যথা ও চোখে ঝাপসা দেখা (এক্লাম্পশিয়ার পূর্বলক্ষণ)**
3. **খিঁচুনি হওয়া**
4. **মারাত্মক জ্বর ও দুর্গন্ধযুক্ত স্রাব**
5. **প্রসববেদনা ১২ ঘণ্টার বেশি স্থায়ী হওয়া বা অস্বাভাবিক অবস্থান**

> **পরামর্শ:** প্রতিটি গর্ভবতী মায়ের জন্য প্রসবের পূর্বেই সম্ভাব্য রক্তদাতা এবং হাসপাতালে যাওয়ার দ্রুত যানবাহনের ব্যবস্থা আগে থেকেই ঠিক করে রাখুন।',
  '{"maternal","pregnancy","emergency"}',
  'published',
  now() - interval '8 days',
  5180
)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- 11. REFRESH MATERIALIZED VIEWS
-- -----------------------------------------------------------------------------
refresh materialized view public.donor_counts_by_upazila_group;

-- =============================================================================
-- COMPLETION VERIFICATION CHECK
-- =============================================================================
do $$
declare
  v_admin_count int;
  v_doc_count int;
  v_donor_count int;
  v_news_count int;
  v_art_count int;
begin
  select count(*) into v_admin_count from profiles where role = 'admin';
  select count(*) into v_doc_count   from doctors where verification = 'verified';
  select count(*) into v_donor_count from donors;
  select count(*) into v_news_count  from national_updates;
  select count(*) into v_art_count   from articles where status = 'published';

  raise notice '=======================================================';
  raise notice 'JIBON ROKKHA / MEDILINK DATABASE SETUP COMPLETE!';
  raise notice 'Admin Users:        %', v_admin_count;
  raise notice 'Verified Doctors:   %', v_doc_count;
  raise notice 'Active Donors:      %', v_donor_count;
  raise notice 'National Updates:   %', v_news_count;
  raise notice 'Published Articles: %', v_art_count;
  raise notice 'All tables, triggers, age columns, and RPCs are ready!';
  raise notice '=======================================================';
end $$;

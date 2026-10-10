-- =============================================================================
-- Jibon Rokkha — 0001_schema.sql
-- Enums, reference geography, core tables, indexes.
-- Target: Supabase Postgres 15 + PostGIS.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type blood_group        as enum ('A+','A-','B+','B-','AB+','AB-','O+','O-');
create type user_role          as enum ('citizen','donor','doctor','admin','blood_bank');
create type verification_state as enum ('pending','verified','rejected','suspended');
create type request_status     as enum ('draft','open','matching','fulfilled','expired','cancelled');
create type request_urgency    as enum ('routine','urgent','critical');
create type blood_component    as enum ('whole_blood','prbc','platelets','plasma');
create type consultation_status as enum ('requested','scheduled','in_progress','completed','cancelled','no_show');
create type complaint_target   as enum ('platform','doctor','blood_bank','user');
create type complaint_status   as enum ('open','in_review','resolved','dismissed');
create type donor_temp_status  as enum ('available','unavailable','cooldown','travelling');
create type unlock_reason      as enum ('requestor','accepted_donor','admin');
create type response_state     as enum ('invited','accepted','declined','donated','no_show','expired');
create type article_status     as enum ('draft','published','archived');
create type contact_visibility as enum ('on_unlock','private_admin');

-- -----------------------------------------------------------------------------
-- REFERENCE GEOGRAPHY  (8 divisions / 64 districts / ~495 upazilas)
-- Normalised so "count AB- donors in this district" is an indexed query,
-- not a LIKE over free-text addresses.
-- -----------------------------------------------------------------------------
create table divisions (
  id        serial primary key,
  name_en   text not null,
  name_bn   text not null,
  bbs_code  text unique not null
);

create table districts (
  id          serial primary key,
  division_id int not null references divisions on delete restrict,
  name_en     text not null,
  name_bn     text not null,
  bbs_code    text unique not null
);
create index districts_division_idx on districts (division_id);

create table upazilas (
  id          serial primary key,
  district_id int not null references districts on delete restrict,
  name_en     text not null,
  name_bn     text not null,
  bbs_code    text unique not null,
  geog        geography(Point, 4326)
);
create index upazilas_district_idx on upazilas (district_id);

create table specialties (
  id       serial primary key,
  slug     text unique not null,
  name_en  text not null,
  name_bn  text not null,
  icon     text
);

-- -----------------------------------------------------------------------------
-- PROFILES  (1:1 with auth.users)
-- NID is NEVER stored in plaintext. It is an identity credential, not a
-- profile field: we keep an HMAC hash for uniqueness + last 4 for display.
-- -----------------------------------------------------------------------------
create table profiles (
  id                    uuid primary key references auth.users on delete cascade,
  role                  user_role not null default 'citizen',
  full_name             text,
  full_name_bn          text,
  phone                 text unique not null,
  nid_hash              text not null,
  nid_last4             text not null check (char_length(nid_last4) = 4),
  date_of_birth         date,
  gender                text check (gender in ('male','female','other')),
  blood_group           blood_group,
  blood_group_verified  boolean not null default false,
  weight_kg             numeric(5,2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 400)),
  height_cm             numeric(5,2),
  home_upazila_id       int references upazilas,
  permanent_upazila_id  int references upazilas,
  present_address       text,
  permanent_address     text,
  home_geog             geography(Point, 4326),
  avatar_url            text,
  locale                text not null default 'bn' check (locale in ('bn','en')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  last_active_at        timestamptz not null default now(),

  constraint profiles_group_verified_needs_group
    check (not blood_group_verified or blood_group is not null),
  constraint profiles_nid_hash_unique unique (nid_hash)
);

create index profiles_home_geog_idx  on profiles using gist (home_geog);
create index profiles_group_idx      on profiles (blood_group);
create index profiles_name_trgm_idx  on profiles using gin (full_name gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- DONORS  (donor-specific state; owner + admin readable only)
-- -----------------------------------------------------------------------------
create table donors (
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

create table donor_availability (
  donor_id     uuid not null references profiles on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  is_available boolean not null default true,
  start_time   time,
  end_time     time,
  primary key (donor_id, day_of_week),
  constraint donor_availability_time_order
    check (start_time is null or end_time is null or start_time < end_time)
);

-- -----------------------------------------------------------------------------
-- BLOOD REQUESTS
-- -----------------------------------------------------------------------------
create table blood_requests (
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
  updated_at         timestamptz not null default now(),
  constraint blood_requests_units_ok check (units_confirmed <= units_needed)
);

create index blood_requests_geog_idx    on blood_requests using gist (geog);
create index blood_requests_open_idx    on blood_requests (geog) where status in ('open','matching');
create index blood_requests_group_idx   on blood_requests (blood_group_needed, status);
create index blood_requests_urgency_idx on blood_requests (urgency, status, created_at desc);
create index blood_requests_requestor   on blood_requests (requestor_id, created_at desc);

create table request_responses (
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
create index request_responses_donor_idx on request_responses (donor_id, state);

-- Append-only record of every contact disclosure. "Who has my number" must be
-- answerable by the donor.
create table contact_unlocks (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid references blood_requests on delete set null,
  unlocker_id uuid not null references profiles on delete cascade,
  subject_id  uuid not null references profiles on delete cascade,
  reason      unlock_reason not null,
  ip          inet,
  unlocked_at timestamptz not null default now()
);
create index contact_unlocks_subject_idx on contact_unlocks (subject_id, unlocked_at desc);
create index contact_unlocks_unlocker_idx on contact_unlocks (unlocker_id, unlocked_at desc);

-- Immutable ledger that makes cooldown computable.
create table contributions (
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
create index contributions_donor_idx on contributions (donor_id, donated_on desc);

-- -----------------------------------------------------------------------------
-- DOCTORS
-- -----------------------------------------------------------------------------
create table doctors (
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
create index doctors_practice_geog_idx on doctors using gist (practice_geog);
create index doctors_verify_idx        on doctors (verification, specialty_id);
create index doctors_upazila_idx       on doctors (practice_upazila_id);

create table doctor_availability (
  id           uuid primary key default gen_random_uuid(),
  doctor_id    uuid not null references profiles on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  slot_minutes int not null default 20 check (slot_minutes between 5 and 180),
  is_active    boolean not null default true,
  constraint doctor_availability_order check (start_time < end_time)
);
create index doctor_availability_doctor_idx on doctor_availability (doctor_id, day_of_week);

-- -----------------------------------------------------------------------------
-- CONSULTATIONS  (chat is real; audio/video are honest stubs in Phase 1)
-- -----------------------------------------------------------------------------
create table consultations (
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
  fee                   numeric(10,2),
  payment_status        text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded','waived')),
  notes_private         text,
  prescription          text,
  follow_up_at          timestamptz,
  created_at            timestamptz not null default now()
);
create index consultations_patient_idx on consultations (patient_id, created_at desc);
create index consultations_doctor_idx  on consultations (doctor_id, status, scheduled_for);

create table consultation_messages (
  id              uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations on delete cascade,
  sender_id       uuid not null references profiles on delete cascade,
  body            text,
  attachment_path text,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  constraint consultation_messages_has_content check (body is not null or attachment_path is not null)
);
create index consultation_messages_thread_idx on consultation_messages (consultation_id, created_at);

-- -----------------------------------------------------------------------------
-- CONTENT
-- -----------------------------------------------------------------------------
create table articles (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid not null references doctors on delete cascade,
  slug             text unique not null,
  title            text not null,
  title_bn         text,
  excerpt          text,
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
create index articles_published_idx on articles (status, published_at desc);
create index articles_author_idx    on articles (author_id);
create index articles_search_idx    on articles using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(excerpt,'')));

create table article_reactions (
  article_id uuid not null references articles on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  reaction   text not null default 'helpful' check (reaction in ('helpful','thanks','saved')),
  created_at timestamptz not null default now(),
  primary key (article_id, user_id, reaction)
);

-- -----------------------------------------------------------------------------
-- COMPLAINTS  (a form without a queue and a clock is theatre)
-- -----------------------------------------------------------------------------
create table complaints (
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
  resolved_at     timestamptz
);
create index complaints_queue_idx    on complaints (status, severity desc, sla_due_at);
create index complaints_mine_idx     on complaints (complainant_id, created_at desc);

-- -----------------------------------------------------------------------------
-- BLOOD BANKS (Phase 3 stock view)
-- -----------------------------------------------------------------------------
create table blood_banks (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  upazila_id    int references upazilas,
  geog          geography(Point, 4326),
  phone         text,
  verified      boolean not null default false,
  opening_hours text,
  created_at    timestamptz not null default now()
);
create index blood_banks_geog_idx on blood_banks using gist (geog);

create table blood_bank_stock (
  bank_id     uuid not null references blood_banks on delete cascade,
  blood_group blood_group not null,
  component   blood_component not null default 'whole_blood',
  units       int not null default 0 check (units >= 0),
  updated_at  timestamptz not null default now(),
  primary key (bank_id, blood_group, component)
);

-- -----------------------------------------------------------------------------
-- OPS: outbox (SMS costs money; nothing calls the gateway directly),
--      audit_log (append-only), notification prefs, tunable config
-- -----------------------------------------------------------------------------
create table outbox (
  id            bigserial primary key,
  topic         text not null,
  payload       jsonb not null default '{}',
  attempts      int not null default 0,
  status        text not null default 'pending' check (status in ('pending','sent','failed','dead')),
  last_error    text,
  scheduled_for timestamptz not null default now(),
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index outbox_due_idx on outbox (status, scheduled_for) where status = 'pending';

create table audit_log (
  id         bigserial primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  before     jsonb,
  after      jsonb,
  ip         inet,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on audit_log (entity, entity_id, created_at desc);
create index audit_log_actor_idx  on audit_log (actor_id, created_at desc);

create table notification_prefs (
  user_id uuid primary key references profiles on delete cascade,
  sms     boolean not null default true,
  push    boolean not null default true,
  email   boolean not null default false
);

create table app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Server-side secrets (NID HMAC pepper, dev OTP switch) live outside the
-- client-reachable schema. Never expose this table to anon/authenticated.
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.secrets (
  key   text primary key,
  value text not null
);

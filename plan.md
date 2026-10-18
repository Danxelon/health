# Jibon Rokkha — Full-Stack Health & Blood Donation Platform
### Bangladesh · React + Tailwind (frontend) · Supabase Postgres (backend) · Vercel (hosting)

> **Status:** v2 plan. `plan-v1.md` holds the original brief. This document keeps every original requirement and adds the *logic layer*: matching rules, eligibility engines, lifecycle state machines, privacy tiers, and the concrete backend contract (schema, RLS, RPCs, RPC signatures) that the React app talks to.

---

## 0. The one-line upgrade

v1 described **screens**. v2 describes **rules that make the screens correct**.

The two pieces of logic that carry the whole product — and which v1 left entirely undefined — are:

1. **Blood compatibility & eligibility** (who can actually receive, who can actually donate, and when).
2. **A privacy-preserving matching cascade** (how a stranger in need finds a donor without the platform leaking everyone's NID and GPS).

Everything else in this document is in service of those two.

---

## 1. Scope, roles, and the "non-negotiables"

### 1.1 Roles (Simplified 3-Role Model)
| Role | How it's granted | Can do |
|---|---|---|
| `citizen` | self signup (default) | Core role for all citizens. Any citizen can act as a **blood donor** (by registering donor availability in `public.donors`) and/or as a **patient / seeker** (requesting blood, tracking matching donors, booking doctor consultations). Also accesses public health feed and complaint system. |
| `doctor` | signup **pending** → admin verifies BMDC | publish articles, accept telemedicine consultations, set schedule/fees |
| `admin` | seeded / manually promoted | verify doctors, triage complaints, manage platform records, read audit log |

### 1.2 Non-negotiables (guardrails that shape the schema)
- **NID is never public.** It is a verification credential, not a profile field. Stored only as an HMAC hash + last 4 digits for display. This protects donors from identity theft and is the reason a donor's contact details need an *unlock* rather than being open (see §6).
- **Medical information is not marketing.** Blood group and location precision are disclosed on a need-to-know basis, escalated only when a request is genuinely open (§6).
- **Every contact disclosure is logged.** `contact_unlocks` is an append-only table. "Who saw my number and when" must be answerable.
- **Nothing is deleted, everything is audited.** `blood_requests`, `contributions`, `verification_requests`, and `audit_log` are append-only histories.
- **Phone-first, offline-tolerant.** Assume intermittent connectivity: optimistic UI, retry queues on mutations, and cached last-known search results.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND — React 18 + Vite + Tailwind + React Router            │
│                                                                  │
│  Presentation   pages · layout (sidebar/header/right rail)       │
│  State          TanStack Query (server)  ·  Zustand (UI/session) │
│  Domain logic   src/domain/*  ← compatibility, eligibility,      │
│                 status machines, distance, scoring   [pure fns]  │
│  Data access    src/api/*  (typed Supabase wrappers only)        │
└──────────────────────────────────────────────────────────────────┘
                    │  supabase-js  (anon key + user JWT)
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  SUPABASE                                                        │
│  Postgres  → tables, enums, FK integrity, GiST/PostGIS indexes   │
│  RLS       → every table denies by default; policies = the rules │
│  RPCs      → search_nearby_donors, unlock_donor_contact,         │
│              respond_to_request, verify_otp, availability…       │
│  Auth      → phone OTP (production) / dev OTP backdoor (dev only)│
│  Storage   → certificates, article images, avatars (private +    │
│              signed URLs, 24h)                                   │
│  Edge Fns  → send_sms, outbox dispatch, expiry cron, NID verify  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.1 Non-negotiable architectural rule
All blood logic lives in **`src/domain/` as pure functions**, and the database enforces the same rules via RLS/RPC.

> **The client is a UI convenience, never the security boundary.** A user can edit React state or call the Supabase REST API directly. Therefore: **every rule that matters is enforced in the database.** The TypeScript mirror of a rule exists only to give instant feedback and hide impossible choices — it is never the reason a rule holds.

This single rule is why search is an RPC rather than a table query, and why contact details live in a separate table.

---

## 3. Data model

### 3.1 Enums
```sql
create type blood_group       as enum ('A+','A-','B+','B-','AB+','AB-','O+','O-');
create type user_role         as enum ('admin','doctor','citizen');
create type verification_state as enum ('pending','verified','rejected','suspended');
create type request_status    as enum ('draft','open','matching','fulfilled','expired','cancelled');
create type request_urgency   as enum ('routine','urgent','critical');
create type consultation_status as enum ('requested','scheduled','in_progress','completed','cancelled','no_show');
create type complaint_target  as enum ('platform','doctor','blood_bank','user');
create type complaint_status  as enum ('open','in_review','resolved','dismissed');
create type donor_temp_status as enum ('available','unavailable','cooldown','travelling');
create type unlock_reason     as enum ('requestor','accepted_donor','admin');
```

### 3.2 Geography as real rows (fixes the "Upazila → District → Division" hierarchy)
v1 implied geographic strings. **Counting blood groups by district over free-text addresses is impossible.** Normalize geography once:

```sql
create table divisions (id serial primary key, name_en text, name_bn text, bbs_code text unique);
create table districts (id serial primary key, division_id int references divisions,
                        name_en text, name_bn text, bbs_code text unique);
create table upazilas  (id serial primary key, district_id int references districts,
                        name_en text, name_bn text, bbs_code text unique);
-- 8 divisions · 64 districts · ~495 upazilas (BBS codes, seeded as reference data)
```
- Users may have a `home_upazila_id` (present address) and `permanent_upazila_id`.
- Doctors **must** have `practice_upazila_id` (v1 called this the hierarchy).
- A request may point at an `upazila_id` **or** at raw coordinates (both allowed).

> Why: it powers "nearby Upazila/District doctors first" with an indexed `IN (...)`, and lets a district-level admin see a district blood-stock picture later. It also lets us display names in both Bengali and English from one source.

### 3.3 Core tables

**profiles** — 1:1 with `auth.users`, created by trigger on signup
```sql
id uuid pk references auth.users on delete cascade,
role user_role not null default 'citizen',
full_name text, full_name_bn text,
phone text unique not null,              -- E.164, e.g. +8801XXXXXXXXX
nid_hash text not null,                  -- HMAC-SHA256(nid, server_secret); NEVER the raw NID
nid_last4 text not null,                 -- display only, e.g. "••••1234"
date_of_birth date, gender text,
blood_group blood_group,                 -- nullable until verified/self-declared
blood_group_verified boolean default false,   -- true after lab/doctor/admin confirm
weight_kg numeric, height_cm numeric,
home_upazila_id int references upazilas,
permanent_upazila_id int references upazilas,
present_address text, permanent_address text,
home_geog geography(Point,4326),         -- PostGIS; NULL if user declines precise location
avatar_url text,
locale text default 'bn',
created_at timestamptz default now(), updated_at timestamptz default now(),
last_active_at timestamptz
```

**donors** — donor-specific state, kept out of `profiles` so a citizen isn't carrying donation fields
```sql
user_id uuid pk references profiles,
last_donation_date date,
total_donations int default 0,           -- maintained by trigger from `contributions`
temp_status donor_temp_status default 'unavailable',
available_from date,                     -- e.g. cooldown end, or "back in town on…"
travel_note text,                        -- "in Dhaka until 20 Oct"
weight_kg numeric,                       -- re-checked at request time (≥50kg rule)
chronic_conditions text,                 -- self-declared flag; drives soft warnings
medications text,
smoker boolean default false,
contact_visibility text default 'on_unlock', -- 'on_unlock' | 'private_admin'
notify_radius_km int default 10,
notifications_enabled boolean default true,
updated_at timestamptz default now()
```
> `donors` is readable **only by its owner and admins**. The public directory does not exist; discovery happens exclusively through the `search_nearby_donors` RPC, which returns a projection (§6).

**donor_availability** — weekly availability, separate from one-off `temp_status`
```sql
donor_id uuid references profiles, day_of_week smallint check (0..6),
is_available boolean, start_time time, end_time time,
primary key (donor_id, day_of_week)
```

**contributions** — the immutable record that makes cooldown computable
```sql
id uuid pk default gen_random_uuid(),
donor_id uuid references profiles,
request_id uuid references blood_requests,
donated_on date not null,
units int default 1,
verified_by uuid references profiles,   -- doctor/admin/blood-bank confirmation
verified_at timestamptz,
created_at timestamptz default now()
```

**blood_requests**
```sql
id uuid pk default gen_random_uuid(),
requestor_id uuid references profiles not null,
patient_name text, patient_age int, patient_gender text,
blood_group_needed blood_group not null,
units_needed int default 1 check (units_needed between 1 and 10),
component text default 'whole_blood',    -- whole_blood|prbc|platelets|plasma
urgency request_urgency not null default 'urgent',
status request_status not null default 'open',
needed_by timestamptz,
hospital_name text, hospital_contact text,
upazila_id int references upazilas,
geog geography(Point,4326),
address_text text,
hemoglobin numeric,                      -- optional clinical detail
reason text,                             -- surgery|thalassemia|accident|…
attachments text[],                      -- storage paths to prescriptions/reports
matched_donor_id uuid references profiles,
match_count int default 0,
expires_at timestamptz,                  -- set by trigger per urgency (§5.4)
created_at timestamptz default now(), updated_at timestamptz default now()
```
> v1's "5–7 question form" maps 1:1 onto `patient_name, patient_age, blood_group_needed, units_needed, urgency, hospital_name, needed_by, reason, address_text`. Auto-fill supplies `requestor_id`, `requestor`'s `home_upazila_id`, and `hospital_*` from last used.

**request_responses** — the linking table v1 was missing (one request → many candidates)
```sql
id uuid pk default gen_random_uuid(),
request_id uuid references blood_requests,
donor_id uuid references profiles,
state text not null default 'invited',   -- invited|accepted|declined|donated|no_show|expired
responded_at timestamptz,
donation_confirmed boolean default false,
unique (request_id, donor_id)
```

**contact_unlocks** — append-only audit of who saw whose number
```sql
id uuid pk default gen_random_uuid(),
request_id uuid references blood_requests,
unlocker_id uuid references profiles,
subject_id uuid references profiles,
reason unlock_reason,
unlocked_at timestamptz default now()
```

**doctors**
```sql
user_id uuid pk references profiles,
bmdc_reg_no text unique not null,
specialty_id int references specialties,
degrees text[],                         -- MBBS, FCPS, MD…
experience_years int,
practice_upazila_id int references upazilas,
practice_address text,
practice_geog geography(Point,4326),
consult_fee numeric,                    -- BDT; nullable = free
languages text[] default '{bn}',
verification verification_state default 'pending',
certificate_path text,                  -- Storage path (private bucket)
bio text, rating_avg numeric default 0, rating_count int default 0,
follow_up_free_days int default 7,
verified_at timestamptz, verified_by uuid references profiles,
created_at timestamptz default now()
```
**doctor_availability** — the schedule a patient picks from
```sql
id uuid pk default gen_random_uuid(),
doctor_id uuid references profiles, day_of_week smallint,
start_time time, end_time time, slot_minutes int default 20, is_active boolean default true
```

**consultations**
```sql
id uuid pk default gen_random_uuid(),
patient_id uuid references profiles, doctor_id uuid references doctors,
status consultation_status default 'requested',
symptom_summary text, consent_share_history boolean default false,
scheduled_for timestamptz, started_at timestamptz, ended_at timestamptz,
channel text default 'in_app',           -- in_app | audio (stub) | video (stub)
fee numeric, payment_status text default 'unpaid',
notes_private text,                      -- doctor-only
prescription text, follow_up_at timestamptz,
created_at timestamptz default now()
```
**consultation_messages** — the "Message" stub becomes real immediately (text is free & safe)
```sql
id uuid pk default gen_random_uuid(),
consultation_id uuid references consultations,
sender_id uuid references profiles,
body text, attachment_path text, read_at timestamptz,
created_at timestamptz default now()
```

**articles**
```sql
id uuid pk default gen_random_uuid(),
author_id uuid references doctors not null,
title text, title_bn text, slug text unique,
excerpt text, cover_image_path text,
content_md text, tags text[],
status text default 'draft',             -- draft|published|archived
published_at timestamptz,
view_count int default 0,
created_at timestamptz default now(), updated_at timestamptz default now()
```
**article_reactions** — `(article_id, user_id, reaction)` unique, for the feed's engagement.

**complaints**
```sql
id uuid pk default gen_random_uuid(),
complainant_id uuid references profiles,
target_type complaint_target, target_id uuid,   -- nullable for platform
subject text, description text, evidence_paths text[],
status complaint_status default 'open', severity smallint default 2,
assignee_id uuid references profiles,
resolution_note text,
created_at timestamptz default now(), resolved_at timestamptz
```

**Outbox + ops**
```sql
create table outbox (            -- every side-effect notification, dispatched by Edge Fn
  id bigserial pk, topic text, payload jsonb, attempts int default 0,
  status text default 'pending', scheduled_for timestamptz default now(),
  created_at timestamptz default now()
);
create table audit_log (         -- append-only; written by triggers, not by users
  id bigserial pk, actor_id uuid, action text, entity text, entity_id uuid,
  before jsonb, after jsonb, ip inet, created_at timestamptz default now()
);
create table notification_prefs (user_id uuid pk references profiles,
  sms boolean default true, push boolean default true, email boolean default false);
```
> The outbox pattern matters here specifically because **SMS costs money and phones are the primary channel**: a single `send_sms` Edge Function retries with backoff, and nothing else in the system is allowed to call the SMS gateway directly.

### 3.4 Integrity rules (constraints & triggers)
| Rule | Mechanism |
|---|---|
| Blood group can't be "verified" without a value | `check (not blood_group_verified or blood_group is not null)` |
| `last_donation_date` always reflects reality | Trigger on `contributions` → recompute `donors.last_donation_date`, `total_donations` |
| Requests auto-expire | Trigger on insert: `expires_at = now() + interval` per urgency (§5.4); nightly cron flips status |
| A verified doctor is always verified | `check (verification <> 'verified' or bmdc_reg_no is not null)` |
| `audit_log` is immutable | `revoke update, delete` from all non-service roles + trigger guard |
| One active request per donor-response | `unique (request_id, donor_id)` |

---

## 4. Matching logic — the core of the product

### 4.1 Blood compatibility matrix (this is not a heuristic; it is the medicine)
Recipient → acceptable donor groups (RBC):

| Recipient | Can receive from |
|---|---|
| **O−** | O− |
| **O+** | O−, O+ |
| **A−** | O−, A− |
| **A+** | O−, O+, A−, A+ |
| **B−** | O−, B− |
| **B+** | O−, O+, B−, B+ |
| **AB−** | O−, A−, B−, AB− |
| **AB+** | *all* (universal recipient) |

Donor → who they can give to: **O− = universal donor**, **AB+ = universal recipient**.

```ts
// src/domain/blood.ts  — single source of truth for rules; DO NOT duplicate elsewhere
export const COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-':  ['O-','O+','A-','A+','B-','B+','AB-','AB+'],
  'O+':  ['O+','A+','B+','AB+'],
  'A-':  ['A-','A+','AB-','AB+'],
  'A+':  ['A+','AB+'],
  'B-':  ['B-','B+','AB-','AB+'],
  'B+':  ['B+','AB+'],
  'AB-': ['AB-','AB+'],
  'AB+': ['AB+'],
};
export const canDonateTo = (donor: BloodGroup, recipient: BloodGroup) =>
  COMPATIBILITY[donor].includes(recipient);
export const acceptableDonorsFor = (recipient: BloodGroup): BloodGroup[] =>
  (Object.keys(COMPATIBILITY) as BloodGroup[]).filter(d => canDonateTo(d, recipient));
```
**Design consequence that v1 got wrong:** the request form asks for the *patient's* group, and search accepts **any donor whose group can donate to it** — so an AB+ patient correctly sees O−, A−, B−, AB− donors. Matching on string equality (`donor.blood_group = request.blood_group`) would quietly kill patients in emergencies. **This is the single most important correction in this document.**

Rh− donors are scarce in Bangladesh (≈<1–2% of the population is Rh− overall). Rare-group requests therefore get a **second, wider cascade ring** and a persistent "still needed" flag rather than expiring quietly (§5.3).

### 4.2 Donor eligibility engine
```ts
// src/domain/eligibility.ts
export const COOLDOWN_DAYS = { whole_blood: 90, platelets: 14, plasma: 28 } as const;
export const MIN_WEIGHT_KG = 50;
export const MIN_AGE = 18, MAX_AGE = 65;

export type EligibilityReason =
  | 'eligible' | 'age_too_young' | 'age_too_old' | 'underweight'
  | 'cooldown_active' | 'manual_cooldown' | 'chronic_condition'
  | 'recent_illness' | 'pregnant' | 'opted_out';

export function evaluateEligibility(d: DonorFact, when = new Date()): {
  eligible: boolean; reasons: EligibilityReason[]; nextEligibleOn: Date | null;
}
```
**Hard blocks** (never shown as a candidate): age outside 18–65, weight < 50 kg, cooldown active, `temp_status='cooldown'`, opted out.
**Soft warnings** (shown, but flagged to the requestor): chronic condition declared, smoker, recent illness, on medication — these are **not** exclusions we can adjudicate medically; we surface them and let the human decide, and we never present a soft-warned donor as "safe".

Also implemented, because v1's "5–7 question form" is only useful if the answers *do* something:
- **Eligibility is computed server-side at search time and again at accept time.** Between invite and accept, 6 hours may pass and a donation elsewhere can start a cooldown. A donor who was eligible at invite and is not at accept is caught by the RPC, not by a stale client.
- **Self-report blocking window:** any user can mark "I donated elsewhere" → 90-day cooldown. This is the closest realistic analogue of the national registry v1 dreams about, and it works today.
- **Donor reliability score (admin-visible only):** accepted→donated ratio over last 12 months. Never surfaced publicly — a public reliability score would punish people for having emergencies of their own.

### 4.3 Proximity & ranking
Distance is computed in Postgres with PostGIS (`ST_Distance` on `geography`, meters). Search expands in **rings**, which is what makes "nearby first" both fast and fair:

```
ring 0: ≤3 km      ring 1: ≤10 km     ring 2: ≤25 km
ring 3: same upazila   ring 4: same district   ring 5: same division   ring 6: national
```
Ring radius is **urgency-scaled** (critical expands to ring 6 immediately; routine stops at ring 1–2 and asks the requestor before spending SMS on strangers).

Ranking score, computed server-side in the RPC (documented, deterministic — no black box):
```
score = w_dist · (1 / (1 + distance_km))
      + w_avail · availability_now(1|0)
      + w_reliab · reliability(0..1)
      + w_recency · recency_of_last_donation
      − penalties (soft warnings, recently spammed with requests)
```
Weights live in `app_config` (admin-tunable) so the medical team can retune without a deploy.

### 4.4 Pure functions that must be unit-tested (these are the tests that matter)
- `acceptableDonorsFor()` covers all 64 (donor, recipient) pairs against the medical matrix.
- `evaluateEligibility()` boundary cases: exactly 90 days, 89 days 23 h, age on birthday, 49.9 kg.
- `nextEligibleOn()` after each component type.
- `rankDonors()` determinism and tie-breaking.
- Status-machine transitions (§5).

---

## 5. Lifecycle state machines (v1 had "status" fields and no transitions)

### 5.1 Blood request
```
draft ──submit──▶ open ──invites sent──▶ matching ──donor accepts──▶ (reserved)
  ▲                                        │
  └──────────── cancel ────────────────────┤
                                           ├─▶ fulfilled  (units_confirmed ≥ units_needed)
                                           └─▶ expired    (expires_at passed, no fulfilment)
open/matching ──cancel──▶ cancelled
```
Transitions that change `status` are performed by RPCs, never by direct `UPDATE`. `request_status` changes write `audit_log` rows.

### 5.2 Donor response
```
invited ──accept──▶ accepted ──confirmed by staff──▶ donated
   │                   │
   ├──decline──▶ declined
   ├──timeout──▶ expired          (see expiry windows per urgency)
   └──accepted, no show──▶ no_show  (feeds reliability score, never public)
```
**Declining is always free and never penalised.** A donor who declines must never lose standing — otherwise donors self-select out of the pool, which is the failure mode that kills blood platforms.

### 5.3 Critical escalation ladder (the logic that actually saves lives)
```
T+0    request created (critical) → ring 0–1 invite, SMS+push to on-duty ring
T+15m  no accept  → widen ring 2–3, notify district blood banks
T+1h   no accept  → widen ring 4–5, notify admin task queue (human calls begin)
T+4h   no accept  → national ring 6, public "still needed" card in the feed,
                    rare-group flag raised, admin outbound-call list generated
T+24h  → escalate to blood-bank stock match, suggest donation camps
```
Every rung is an `outbox` job with a template; the ladder is data (`app_config`), not code, so it can be tuned per division. **This is the piece most competing apps omit, and it is the difference between a directory and a service.**

### 5.4 Expiry windows
`routine → 7 days` · `urgent → 48 h` · `critical → 24 h` (then escalates, doesn't just die). Nightly cron sweeps, writes audit rows, and notifies the requestor with a "here's what we tried" summary instead of silence.

### 5.5 Consultation
```
requested ──doctor accepts──▶ scheduled ──slot──▶ in_progress ──end──▶ completed
    │                              │                    │
    ├─patient cancels─▶ cancelled  ├─no_show──▶ no_show  └─follow_up_at set─▶ (re-open allowed)
    └─doctor declines──▶ cancelled
```
Only `chat` is real in Phase 1. **Audio/video are stubs with an honest label** — a fake "Call" button in a medical app is worse than an absent one. The stub returns `{ available: false, reason: 'not_yet_available' }` and the UI says so.

### 5.6 Doctor verification
```
pending ──admin reviews BMDC + certificate──▶ verified
   │                                            │
   ├──▶ rejected (reason shown to the doctor)    └─suspended──▶ suspended ──▶ verified
```
A `pending` doctor can write drafts; only `verified` doctors appear in search and can publish. Articles by a suspended doctor are hidden from the feed but keep their URLs (no broken links/SEO loss).

---

## 6. Privacy & contact disclosure (v1 shipped a "Call" button; that's the dangerous part)

A public "Call" button next to a name, blood group and a rough address is a harassment and stalking vector — especially for women donors, who are the demographic most likely to be driven off a platform by it. The logic:

1. Donor search returns a **projection**, never a row: `display_name` (or initials, donor-controlled), `blood_group`, `distance_band` (`<1 km`, `1–3 km`, `3–10 km`, …), `upazila`/`district` name, `available_now`, `verified_badge`. No phone, no exact coordinates, no NID, no address text.
2. Contact appears **only after** one of:
   - the requestor has an **open** request matching the donor's group-compatibility, **and**
   - the donor **accepts** an invite (donor-initiated disclosure — the default and the right default), **or**
   - the requestor uses a **one-time unlock** (`unlock_donor_contact`) which is logged to `contact_unlocks` and rate-limited (§7).
3. `contact_visibility='private_admin'` means the donor's number is **never** shown to requestors; the admin relays via a masked call. Some donors will only participate this way, and having the option grows the donor pool.
4. Rate limits + cooldowns on unlocks; a requestor who unlocks 30 numbers in an hour gets throttled and appears in the admin dashboard.
5. Every disclosure is reversible in effect: the donor can see their own unlock history ("who has my number") in Settings.

---

## 7. Backend contract (the part v1 didn't specify, and the part that makes it secure)

### 7.1 RLS posture
- **Default deny on every table.** `alter table … enable row level security;` with no policy = nothing is readable. Policies are written explicitly, one per intent.
- `select` on public-facing tables (articles, verified doctors' public card) is `to authenticated`.
- `profiles`: a user may `select/update` their own row; admins may select all. **No one else can select a profile** — donor search goes through the RPC, which runs `security definer` and returns a projection.
- `donors`: owner + admin only.
- `contact_unlocks`, `audit_log`: append-only; readable by the subject (their own rows) and admins.
- Storage buckets: `certificates` **private**, `articles` public, `avatars` public — all with per-bucket policies; certificates served only via signed URLs (24 h).

### 7.2 RPC surface (the API the frontend actually calls)
| RPC | Signature (essentials) | Notes |
|---|---|---|
| `verify_otp` | `(phone text, code text) → {session}` | prod path; dev backdoor off by default |
| `register_profile` | `(nid, phone, dob, blood_group, upazila_id, …)` | hashes NID **server-side**; client never sees `nid_hash` |
| `search_nearby_donors` | `(recipient_group blood_group, lat, lng, radius_km, urgency, upazila_id?, component?) → donor_projection[]` | compatibility + eligibility + rings + ranking, all server-side |
| `create_blood_request` | `(…9 fields) → request` | sets `expires_at`, writes outbox invites, seeds `request_responses` |
| `unlock_donor_contact` | `(request_id, donor_id) → {phone, reason}` | writes `contact_unlocks`, enforces rate limit |
| `respond_to_request` | `(request_id, response) → response_row` | re-checks eligibility at accept time |
| `confirm_donation` | `(response_id, units) → contribution` | writes `contributions`, triggers cooldown |
| `record_external_donation` | `(date, component) → void` | self-reported cooldown, §4.2 |
| `set_donor_availability` | `(temp_status, available_from, note) → void` | owner-only |
| `request_consultation` / `respond_consultation` | `(doctor_id, symptom_summary, slot)` … | enforces schedule + verification |
| `publish_article` | `(…) → article` | verified doctors only |
| `file_complaint` | `(target_type, target_id, subject, description) → complaint` | |
| `verify_doctor` | `(user_id, decision, reason) → void` | admin only; audited |
| `admin_dashboard_stats` | `→ jsonb` | pre-aggregated counts; no raw PII |
| `track_article_view` | `(article_id) → void` | rate-limited |

### 7.3 Edge Functions
`send_sms` (outbox consumer) · `expire_requests` (cron, 5 min) · `dispatch_escalations` (cron, 15 min) · `verify_nid` (adapter — mock → Porichoy later) · `moderate_content` (report-driven, human-first).

### 7.4 Error contract
```json
{ "error": { "code": "COOLDOWN_ACTIVE",
             "message_bn": "আপনি এখনো রক্তদানের জন্য প্রস্তুত নন।",
             "message_en": "You are not yet eligible to donate.",
             "details": { "nextEligibleOn": "2026-01-12" } } }
```
Every domain failure returns a typed `code`, so the UI renders a specific, bilingual reason — never a raw Postgres error and never a generic "Something went wrong."

---

## 8. Feature logic, spec by spec

### 8.1 Blood donor search — the cascade
```
User taps "Find a donor"  /  রক্ত
  ├─ ⚠ emergency shortcut: "Right now / এখনই দরকার" → skips the form to a 3-field
  │   express request (group, hospital, urgency) and searches immediately
  ├─ read cached last search (offline-tolerant, with timestamp shown)
  ├─ read precise location with a consent prompt + "use my upazila instead"
  ├─ search_nearby_donors(recipient_group, …)
  │     ├─ MATCHES → cards: initials/name, distance band, available badge,
  │     │            "Accept/Interested" flow → reveal on acceptance
  │     │            + "Still can't find? Widening search…" secondary action
  │     └─ NO MATCHES → 5–7 question request form, prefilled from auth
  │            → create_blood_request → invite cascade (§5.3) → tracking screen
  └─ always show: how many were contacted, what happens next, and an explicit
     "I'll keep looking" exit that never dead-ends the user
```
Answers that *do* work (all consumed by the backend, not decoration): `units_needed` → fulfilment condition; `needed_by` + `urgency` → `expires_at` and ladder; `hospital_contact` → admin's outreach if the ladder stalls; `reason` → rare-group weighting; `component` → correct cooldown and compatibility path (platelet/plasma compatibility differs from RBC — the engine switches matrices).

### 8.2 Telemedicine
```
Filter: specialty ▾ · district ▾ · available-today ▸ · fee ▾ · language ▾
Sort: nearby first (upazila → district → division → national), then rating
Card: photo, name (bn/en), degrees, specialty, BMDC-verified badge, distance,
      next free slot today, fee (or "Free"), [Message] [Audio Call (coming soon)]
Doctor detail: bio, degrees, schedule grid, fee, follow-up-free window
Booking: pick slot → request → doctor accepts → chat opens (real)
```
- Ranking is **distance-first, then rating** — v1's ordering. Kept, but now distance comes from `practice_geog`/`practice_upazila_id`, so it's computable rather than guessed.
- Pre-consultation: symptom summary + (optional, consent-gated) share of recent blood requests — the reason the two halves of the app are one product, not two.
- Post-consultation: prescription text, follow-up reminder, one-tap "rate".
- **`specialties`** is a seeded reference table (Medicine, Pediatrics, Gynae, Cardiology, Dermatology, Ortho, ENT, Ophthalmology, Psychiatry, …) so filtering is by id, not by free text.

### 8.3 Content portal
- Feed = `published` articles, ranked by recency × engagement, with a **"matching your condition"** nudge using the user's own recent request reasons (privacy-preserving: computed on the client from their own data).
- Article states: `draft → published → archived`; only verified doctors publish; **medical review flag** for admin (a doctor-authored health article that is medically wrong is a real harm).
- Bilingual authoring: `title`/`title_bn`; one language may be empty.
- Reactions + view counts (rate-limited); comments are Phase 2 and will need moderation — noted now so the schema doesn't surprise us later.

### 8.4 Settings, profile, complaints
- Profile edit re-verifies if `nid` or `phone` changes (both are identity keys).
- Blood group change resets `blood_group_verified = false` and re-queues verification — otherwise a user could "upgrade" themselves to a rare group for attention.
- Privacy toggles: donor visibility, `contact_visibility`, notifications (per channel).
- **Complaint triage:** `platform` → admin queue; `doctor` → admin + (if verified) a warning on the doctor's record; `blood_bank` → admin; `user` → admin. Severity levels with an SLA, and a status timeline visible to the complainant. v1's "Complain form" exists so there is a real route for abuse; it needs a queue and a clock or it's theatre.

---

## 9. UI / layout (v1's structure, made buildable)

All v1 layout requirements are preserved. What's added is what happens inside each region.

```
┌───────────┬──────────────────────────────────────────────┬───────────────────┐
│ SIDEBAR   │  HEADER: [🔍 Search anything……] [Filter ▾]   │  BLOOD BANKS      │
│ Logo/Name │──────────────────────────────────────────────│  NEAR YOU         │
│ Jibon     │  ACTION GRID (bilingual, icon-led, ≥44px)    │  map placeholder  │
│ Rokkha    │  ┌────────────┐ ┌──────────┐ ┌────────────┐ │  + stock chips    │
│           │  │ Consult a  │ │ Blood    │ │ Donate     │ │                   │
│ ✉ email   │  │ doctor     │ │ রক্ত     │ │ Blood      │ ├───────────────────┤
│ socials   │  │ ডাক্তার    │ │          │ │ রক্তদান   │ │ SCHEDULES &       │
│           │  │ খুঁজুন     │ │          │ │            │ │ NEARBY EMERGENCIES│
│ MENU      │  └────────────┘ └──────────┘ └────────────┘ │ ─────────────────  │
│ • About   │──────────────────────────────────────────────│ A+ · 2 km · ICU   │
│ • Location│  ARTICLES (feed from verified doctors)       │ O− · 5 km · urgent│
│ • Dynamic │  ┌────────────────────────────────────────┐  │ B+ · today 6pm    │
│ • Workforce│ │ [cover] Title — Dr. X · Cardiology     │  │ … (full height)   │
│ • Contacts│ │ excerpt…  · 6 min read · 2h ago         │  │ [See all]         │
│ • Info    │ └────────────────────────────────────────┘  │                   │
│ • Language│                                              │                   │
│ • Settings│                                              │                   │
└───────────┴──────────────────────────────────────────────┴───────────────────┘
```
- **Right rail** = Blood banks near you (top) + full-height Schedules & Nearby Emergencies (bottom, `flex-1` + `overflow-y-auto` so it stretches, as v1 asked).
- **Emergency pane logic:** live `matching`/`open` critical requests within the user's district, sorted by urgency then distance, each with "I can help" (→ `respond_to_request`) and a red-dot if under 1 h. Shows **relative** location ("2 km · Dhanmondi") — never a home address.
- **Article region:** loading/empty/error states, and a skeleton that matches the final card height so layout doesn't jump.
- **Responsive:** sidebar → bottom tab bar <768px; right rail collapses into a slide-over; header search becomes a full-width sticky field. Bengali text needs measured line-height (~1.7) and a font stack (`Noto Sans Bengali`) loaded up front.
- **Design tokens (one place, both themes):** primary `#0E7C66` (medical teal), accent `#D7263D` (blood red — reserved **only** for blood/urgency so it keeps meaning), bg `#F7FAF9`, surface `#FFFFFF`, ink `#0B1F1A`, muted `#5B6F69`, warning `#C77700`, success `#1B9C6B`; radius 12px, shadows soft, spacing on a 4pt scale. Defined as CSS custom properties and mirrored in `tailwind.config`.
- **Accessibility (non-negotiable in a health app):** AA contrast on all text, focus-visible rings, keyboard-operable menus, `aria-live` for search results and incoming emergency items, no color-only meaning (the red accent always pairs with an icon or label). Donation/blood UI is used by stressed people on bad phones — this is not optional polish.

### 9.1 Screens & routes
```
/                       dashboard (the grid above)
/register  /login       onboarding (NID · phone · basic details) + OTP
/donors                 search (deep-linkable: ?group=A-&radius=10)
/requests/new           express + full request form
/requests/:id           tracking + escalation timeline
/requests/mine          my requests
/doctor/:id             doctor card + booking
/consultations          list  ·  /consultations/:id  chat
/articles  /articles/:slug
/settings               profile, privacy, donor availability, unlock history
/complain               complaint form + /complaints/mine status timeline
/admin/*                verification queue, complaints, escalations, analytics
```

---

## 10. Logic implementation map (file → responsibility)

```
src/domain/
  blood.ts          COMPATIBILITY, canDonateTo, acceptableDonorsFor, component matrices
  eligibility.ts    evaluateEligibility, nextEligibleOn, COOLDOWN_DAYS, MIN_WEIGHT_KG
  requests.ts       canTransition(), isFulfilled(), nextEscalationStep(), expiryFor(urgency)
  matching.ts       scoreDonor(), rankDonors(), distanceBand(), ringFor(urgency, ring)
  profile.ts        nidLast4(), maskPhone(), completenessScore()
  validation.ts     zod schemas shared by forms and mirrored server-side
src/api/
  donors.ts  requests.ts  doctors.ts  consultations.ts  articles.ts  complaints.ts
  client.ts  (typed supabase wrapper; unwraps the §7.4 error contract)
src/state/
  session.ts (zustand)  ·  queryKeys.ts  ·  optimistic helpers
supabase/
  migrations/0001_init.sql 0002_rls.sql 0003_rpc.sql 0004_seed_geo.sql 0005_triggers.sql
  migrations/0006_cron.sql
  functions/{send_sms,expire_requests,dispatch_escalations,verify_nid,moderate_content}
```

---

## 11. Auth flow (defined, with the OTP simulation made explicit and safe)

```
Register → phone + NID + DOB + upazila + (optional) blood group
        → register_profile RPC: NID hashed server-side, OTP dispatched
        → 6-digit OTP (5-min TTL, ≤5 attempts, then 15-min lockout)
        → verify_otp → session → profile completion → dashboard
Login   → phone → OTP → session
```
- **Dev OTP backdoor:** `app_config.dev_otp_mode` returns `123456` and logs a loud `DEV MODE` warning on every use. It is off by default, and `production` builds assert it is off at boot (fails fast on Vercel if misconfigured).
- **Real SMS** via the outbox (`send_sms`), provider pluggable; Bangladesh's cheapest reliable path is a local aggregator — keep it behind the Edge Function so switching providers is not a code change in the app.
- NID verification: `verify_nid` mock now → **Porichoy / Election Commission API** later. The interface is `(nid) → {verified, name, dob}` from day one so the swap is real.
- Sessions: `onAuthStateChange` drives the store; route guards by role; `last_active_at` heartbeat for the donor pool's freshness.

---

## 12. Security & abuse model (v1 had none; a health platform needs it)
| Threat | Mitigation |
|---|---|
| Scraping the donor list | donation-only discovery, no public directory, per-user rate limits, projections not rows, unlock audit |
| Harassment via revealed numbers | accept-first disclosure, `private_admin` option, unlock history visible to the donor, throttling + admin flag on patterns |
| Fake doctors / fake credentials | BMDC + certificate review queue, `verified` gate on search and publishing, suspension state |
| Blood-group fraud for attention | any group change resets verification (§8.4) |
| Spam requests / low-effort abuse | request rate limits, cooldown between own requests, admin override with audit |
| NID leakage | never stored in plaintext; HMAC + last4 only; server-side hashing only; logs scrubbed |
| SMS cost abuse | outbox quotas per request and per day; escalation ladder is capped in `app_config` |
| Malicious article content | verified-author gate + admin medical-review flag + report route |
| PII in analytics | `admin_dashboard_stats` returns aggregates; no PII in any dashboard query |

---

## 13. Performance & scale notes
- **PostGIS GiST indexes** on `profiles.home_geog`, `doctors.practice_geog`, `blood_requests.geog`; B-tree on `upazila_id`, `blood_group`, `status`; partial indexes for hot queries, e.g.
  `create index on blood_requests (geog) where status in ('open','matching');`
- **Search is an RPC**, so it's one round trip, one query plan, and it can't be paginated into a scrape.
- **Materialized view** `donor_counts_by_upazila_group` refreshed nightly → powers the emergency pane and "X donors near you" without scanning `donors`.
- **Realtime** (Supabase channels) only for: the emergency pane, chat messages, and my-request updates. Never for the donor directory.
- **Caching:** TanStack Query with stale-while-revalidate; article feed cached 5 min; donor search never cached across users (privacy) but cached per-session with a visible "as of HH:MM".
- **Cost control:** SMS is the dominant cost — every escalation rung has a hard budget in `app_config`.

---

## 14. Delivery plan

**Phase 0 — Foundations.** Vite + TS + Tailwind + Router; Supabase project; geography seed (8/64/~495 + BBS codes); `specialties` seed; enums, base tables, RLS skeleton; design tokens + bilingual string table; `src/domain` pure functions **with tests** (blood + eligibility first — they gate everything).

**Phase 1 — Blood (the vertical slice that proves the product).** register/login OTP → donor profile + availability → search RPC with rings/compatibility/eligibility/ranking → request form + cascade + tracking → accept → unlock + audit → confirm donation → cooldown. Ship the emergency pane. This phase alone is a working, life-saving product.

**Phase 2 — Doctors & content.** doctor signup + verification queue → search/filter/sort → scheduling → chat (real) + audio/video stubs (honest) → articles authoring + feed + reactions.

**Phase 3 — Trust & scale.** complaints triage + SLA, admin analytics, blood-bank stock + "supply gap" view, real NID adapter, escalation ladder tuning from data, PWA + web push.

---

## 15. Acceptance criteria (testable)
1. `acceptableDonorsFor('AB+')` returns all 8 groups; `acceptableDonorsFor('O-')` returns `['O-']`. All 64 pairs match the matrix.
2. A donor whose `last_donation_date` is 89 days ago is ineligible; 90 days ago is eligible; the UI states the exact eligible date in Bengali and English.
3. An `A+` requestor sees `O-` and `O+` donors, and **not** `B+`.
4. The donor directory cannot be queried by a raw `select` on `donors` from another user's session (RLS test).
5. `search_nearby_donors` returns no phone numbers, no exact coordinates, and no NID for any caller.
6. Contact is revealed **only** after donor acceptance or a logged, rate-limited unlock; the donor's Settings shows every unlock.
7. A `critical` request with no accept widens rings at 15 m / 1 h / 4 h and generates admin outreach at 4 h.
8. `expires_at` matches urgency; expired requests notify the requestor with a summary, never silently.
9. A `pending` doctor is absent from search and cannot publish; `verified` appears within their district first.
10. Changing blood group resets verification and re-queues it.
11. `dev_otp_mode` returns `123456` in dev and the production build refuses to boot with it enabled.
12. Every status transition writes one `audit_log` row with actor, before, after.
13. Emergency pane and search results are `aria-live`, keyboard-operable, and legible at 320 px width with Bengali text.

---

## 16. Open decisions (need a human answer before Phase 1 code freezes)
1. **SMS provider** — local aggregator (cheaper, BD-specific) vs Twilio (simpler, pricier). Recommend local, behind the Edge Function.
2. **Map provider** — Google Maps (accurate BD coverage, paid, free tier) vs MapLibre + OpenStreetMap (free, weaker rural detail). Recommend MapLibre first, Google later if budget allows.
3. **Are audio/video calls in scope at all for v1?** If yes they need WebRTC + TURN, a real budget, and a privacy review. Otherwise stubs stay stubs and the copy stays honest.
4. **`contact_visibility` default** — accept-first disclosure is recommended; confirm it's acceptable that donors are *not* instantly callable.
5. **Consultation pricing** — free/bKash/MFS now vs deferred. Affects `payment_status` handling and refunds.
6. **Data retention & access policy** — medical complaint records and consultation notes are sensitive; who may read them, for how long, and what does a deletion request actually delete?
7. **NID adapter timing** — is the Porichoy integration funded and legal-cleared, or is mock-only acceptable for the pilot?
```

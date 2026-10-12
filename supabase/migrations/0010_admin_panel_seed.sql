-- =============================================================================
-- Medilink — 0010_admin_panel_seed.sql
-- Moves the Admin Control Center demo dataset OUT of the UI and INTO the DB.
--
-- Why this file exists:
--   src/pages/Admin.tsx previously rendered hardcoded INITIAL_* arrays
--   (12 pending doctors, 6 verified doctors, 5 bulletins, 6 articles,
--   3 complaints). After running this script the same rows live in real
--   tables, so the UI can fetch them from the database and stay clean.
--
-- Run: paste the whole file into Supabase Dashboard > SQL Editor > Run.
-- Safe to re-run: every INSERT uses ON CONFLICT DO NOTHING with fixed UUIDs.
-- Age is NEVER inserted literally: profiles.age is computed automatically
-- by trg_profiles_calculate_age from date_of_birth (see 0009 / 0011).
-- All person names are full 3-word EN + BN (e.g. Dr. Sadia Afroze Sultana).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Prerequisites: specialties + canonical age trigger (idempotent)
-- -----------------------------------------------------------------------------
INSERT INTO specialties (id, slug, name_en, name_bn) VALUES
(1, 'cardiology', 'Cardiology', 'কার্ডিওলজি'),
(2, 'neurology', 'Neurology', 'নিউরোলজি'),
(3, 'orthopedics', 'Orthopedics', 'অর্থোপেডিক্স'),
(4, 'pediatrics', 'Pediatrics', 'শিশুরোগ'),
(5, 'general-medicine', 'General Medicine', 'জেনারেল মেডিসিন'),
(6, 'dermatology', 'Dermatology', 'চর্মরোগ'),
(7, 'gynecology', 'Gynecology', 'স্ত্রীরোগ'),
(8, 'ophthalmology', 'Ophthalmology', 'চক্ষুরোগ'),
(9, 'psychiatry', 'Psychiatry', 'মানসিক রোগ'),
(10, 'surgery', 'General Surgery', 'সার্জারি')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age int;

CREATE OR REPLACE FUNCTION public.calculate_profile_age()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    NEW.age := date_part('year', age(CURRENT_DATE, NEW.date_of_birth))::int;
  ELSE
    NEW.age := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_calculate_age ON public.profiles;
CREATE TRIGGER trg_profiles_calculate_age
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.calculate_profile_age();

-- -----------------------------------------------------------------------------
-- 1. auth.users stubs for the 12 PENDING doctors (FK parent of profiles.id)
--    Password hash is a dummy demo value; real login for pending queue is
--    handled by the admin review flow, not by these accounts.
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
('c0000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.sadia@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801723456781', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Sadia Afroze Sultana"}'::jsonb, now(), now()),
('c0000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.tanvir@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801823456782', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Mohammad Tanvir Ahmed"}'::jsonb, now(), now()),
('c0000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.nusrat@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801923456783', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Nusrat Jahan Chowdhury"}'::jsonb, now(), now()),
('c0000000-0000-0000-0000-000000000004'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.mahmudur@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801623456784', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Mahmudur Rahman Khan"}'::jsonb, now(), now()),
('c0000000-0000-0000-0000-000000000005'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.rehana@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801712345671', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Rehana Parvin Sultana"}'::jsonb, now(), now()),
('c0000000-0000-0000-0000-000000000006'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.shahriar@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801812345672', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Shahriar Kabir Ahmed"}'::jsonb, now(), now()),
('c0000000-0000-0000-0000-000000000007'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.farzana@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801912345673', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Syeda Farzana Yasmin"}'::jsonb, now(), now()),
('c0000000-0000-0000-0000-000000000008'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.tariqul@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801612345674', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Mohammad Tariqul Islam"}'::jsonb, now(), now()),
('c0000000-0000-0000-0000-000000000009'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.mehedi@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801734567891', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Mehedi Hasan Khan"}'::jsonb, now(), now()),
('c0000000-0000-0000-0000-000000000010'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.sharmin@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801834567892', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Sharmin Sultana Ritu"}'::jsonb, now(), now()),
('c0000000-0000-0000-0000-000000000011'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.moniruzzaman@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801934567893', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Kazi Moniruzzaman Khan"}'::jsonb, now(), now()),
('c0000000-0000-0000-0000-000000000012'::uuid, (SELECT id FROM auth.instances LIMIT 1), 'authenticated', 'authenticated', 'pending.anika@health.gov.bd', crypt('Doctor2026!', gen_salt('bf', 4)), now(), '8801634567894', now(), '{"provider":"email"}'::jsonb, '{"role":"doctor","full_name":"Dr. Anika Tabassum Nipa"}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. profiles for the 12 PENDING doctors — full 3-word EN + BN + DOB.
--    NOTE: no `age` column here on purpose; the trigger computes it.
-- -----------------------------------------------------------------------------
INSERT INTO profiles (id, role, full_name, full_name_bn, phone, nid_hash, nid_last4, date_of_birth, gender, locale)
VALUES
('c0000000-0000-0000-0000-000000000001'::uuid, 'doctor', 'Dr. Sadia Afroze Sultana', 'ডা. সাদিয়া আফরোজ সুলতানা', '8801723456781', 'nid-pend-91021-hash', '1021', '1990-03-14', 'female', 'bn'),
('c0000000-0000-0000-0000-000000000002'::uuid, 'doctor', 'Dr. Mohammad Tanvir Ahmed', 'ডা. মোহাম্মদ তানভীর আহমেদ', '8801823456782', 'nid-pend-92144-hash', '2144', '1985-07-22', 'male', 'bn'),
('c0000000-0000-0000-0000-000000000003'::uuid, 'doctor', 'Dr. Nusrat Jahan Chowdhury', 'ডা. নুসরাত জাহান চৌধুরী', '8801923456783', 'nid-pend-93012-hash', '3012', '1992-11-05', 'female', 'bn'),
('c0000000-0000-0000-0000-000000000004'::uuid, 'doctor', 'Dr. Mahmudur Rahman Khan', 'ডা. মাহমুদুর রহমান খান', '8801623456784', 'nid-pend-94185-hash', '4185', '1987-05-18', 'male', 'bn'),
('c0000000-0000-0000-0000-000000000005'::uuid, 'doctor', 'Dr. Rehana Parvin Sultana', 'ডা. রেহানা পারভীন সুলতানা', '8801712345671', 'nid-pend-95301-hash', '5301', '1983-09-30', 'female', 'bn'),
('c0000000-0000-0000-0000-000000000006'::uuid, 'doctor', 'Dr. Shahriar Kabir Ahmed', 'ডা. শাহরিয়ার কবির আহমেদ', '8801812345672', 'nid-pend-96420-hash', '6420', '1988-02-12', 'male', 'bn'),
('c0000000-0000-0000-0000-000000000007'::uuid, 'doctor', 'Dr. Syeda Farzana Yasmin', 'ডা. সৈয়দা ফারজানা ইয়াসমিন', '8801912345673', 'nid-pend-97155-hash', '7155', '1991-08-19', 'female', 'bn'),
('c0000000-0000-0000-0000-000000000008'::uuid, 'doctor', 'Dr. Mohammad Tariqul Islam', 'ডা. মোহাম্মদ তারিকুল ইসলাম', '8801612345674', 'nid-pend-98234-hash', '8234', '1980-04-25', 'male', 'bn'),
('c0000000-0000-0000-0000-000000000009'::uuid, 'doctor', 'Dr. Mehedi Hasan Khan', 'ডা. মেহেদী হাসান খান', '8801734567891', 'nid-pend-89412-hash', '9412', '1986-12-08', 'male', 'bn'),
('c0000000-0000-0000-0000-000000000010'::uuid, 'doctor', 'Dr. Sharmin Sultana Ritu', 'ডা. শারমিন সুলতানা ঋতু', '8801834567892', 'nid-pend-90188-hash', '0188', '1989-06-15', 'female', 'bn'),
('c0000000-0000-0000-0000-000000000011'::uuid, 'doctor', 'Dr. Kazi Moniruzzaman Khan', 'ডা. কাজী মনিরুজ্জামান খান', '8801934567893', 'nid-pend-92841-hash', '2841', '1984-10-03', 'male', 'bn'),
('c0000000-0000-0000-0000-000000000012'::uuid, 'doctor', 'Dr. Anika Tabassum Nipa', 'ডা. আনিকা তাবাসসুম নিপা', '8801634567894', 'nid-pend-94762-hash', '4762', '1993-01-27', 'female', 'bn')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. doctors rows (verification = pending) for the 12 applicants
-- -----------------------------------------------------------------------------
INSERT INTO doctors (user_id, bmdc_reg_no, specialty_id, degrees, experience_years, practice_address, consult_fee, languages, verification, bio)
VALUES
('c0000000-0000-0000-0000-000000000001'::uuid, 'BMDC-A-91021', 7, '{"MBBS","FCPS (Gynae & Obs)"}', 8, 'Dhaka Medical College Hospital', 0.00, '{bn,en}', 'pending', 'Applicant: Gynecology & Obstetrics.'),
('c0000000-0000-0000-0000-000000000002'::uuid, 'BMDC-A-92144', 1, '{"MBBS","MD (Cardiology)"}', 12, 'NICVD, Dhaka', 0.00, '{bn,en}', 'pending', 'Applicant: Cardiology.'),
('c0000000-0000-0000-0000-000000000003'::uuid, 'BMDC-A-93012', 4, '{"MBBS","DCH","FCPS"}', 6, 'Dhaka Shishu Hospital', 0.00, '{bn,en}', 'pending', 'Applicant: Pediatrics.'),
('c0000000-0000-0000-0000-000000000004'::uuid, 'BMDC-A-94185', 5, '{"MBBS","FCPS (Medicine)"}', 10, 'Sir Salimullah Medical College', 0.00, '{bn,en}', 'pending', 'Applicant: Internal Medicine.'),
('c0000000-0000-0000-0000-000000000005'::uuid, 'BMDC-A-95301', 3, '{"MBBS","MS (Orthopedics)"}', 14, 'NITOR (Pongu Hospital), Dhaka', 0.00, '{bn,en}', 'pending', 'Applicant: Orthopedics.'),
('c0000000-0000-0000-0000-000000000006'::uuid, 'BMDC-A-96420', 2, '{"MBBS","MD (Neurology)"}', 9, 'NINS, Agargaon, Dhaka', 0.00, '{bn,en}', 'pending', 'Applicant: Neurology.'),
('c0000000-0000-0000-0000-000000000007'::uuid, 'BMDC-A-97155', 6, '{"MBBS","DDV","FCPS"}', 7, 'BSMMU, Shahbag, Dhaka', 0.00, '{bn,en}', 'pending', 'Applicant: Dermatology.'),
('c0000000-0000-0000-0000-000000000008'::uuid, 'BMDC-A-98234', 10, '{"MBBS","FCPS (Surgery)"}', 15, 'Chittagong Medical College Hospital', 0.00, '{bn,en}', 'pending', 'Applicant: General Surgery.'),
('c0000000-0000-0000-0000-000000000009'::uuid, 'BMDC-A-89412', 5, '{"MBBS","MD (Nephrology)"}', 11, 'National Institute of Kidney Diseases', 0.00, '{bn,en}', 'pending', 'Applicant: Nephrology.'),
('c0000000-0000-0000-0000-000000000010'::uuid, 'BMDC-A-90188', 8, '{"MBBS","FCPS (Ophthalmology)"}', 8, 'National Institute of Ophthalmology', 0.00, '{bn,en}', 'pending', 'Applicant: Ophthalmology.'),
('c0000000-0000-0000-0000-000000000011'::uuid, 'BMDC-A-92841', 5, '{"MBBS","DLO","MS (ENT)"}', 13, 'Shaheed Suhrawardy Medical College', 0.00, '{bn,en}', 'pending', 'Applicant: ENT & Head Neck Surgery.'),
('c0000000-0000-0000-0000-000000000012'::uuid, 'BMDC-A-94762', 5, '{"MBBS","FCPS (Hematology)"}', 5, 'Dhaka Medical College Hospital', 0.00, '{bn,en}', 'pending', 'Applicant: Hematology.')
ON CONFLICT (user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. national_updates — the 5 bulletins shown in Admin TAB 2 + homepage rail
-- -----------------------------------------------------------------------------
INSERT INTO national_updates (id, title, title_bn, body, body_bn, kind, source, effective_from, expires_at)
VALUES
('f0000000-0000-0000-0000-000000000001'::uuid, 'National Dengue Call-to-Action 2026', 'জাতীয় ডেঙ্গু প্রতিরোধ ও বিশেষ সতর্কতা ২০২৬', 'All 64 district hospitals instructed to maintain 24/7 dedicated dengue corners. Platelet stocks and emergency NS1 testing are prioritized.', 'সকল জেলা সদর হাসপাতালে ২৪/৭ ডেঙ্গু কর্নার সচল রাখতে স্বাস্থ্য অধিদপ্তরের বিশেষ নির্দেশনা। প্লাটিলেট মজুদ ও এনএস১ পরীক্ষা জোরদার করা হয়েছে।', 'alert', 'DGHS', now() - INTERVAL '2 hours', '2026-11-30'),
('f0000000-0000-0000-0000-000000000002'::uuid, 'IEDCR Nipah Virus Precautionary Guidelines', 'আইইডিসিআর নিপাহ ভাইরাস প্রতিরোধ ও সুরক্ষা নির্দেশিকা', 'Strict advisory against consuming raw date palm sap or partially eaten fruits. Report suspected fever and encephalitis immediately.', 'কাঁচা খেজুরের রস পান বা বাদুড়ে খাওয়া ফল খাওয়া থেকে সম্পূর্ণ বিরত থাকুন। জ্বর ও স্নায়বিক লক্ষণ দেখা দিলে দ্রুত নিকটস্থ হাসপাতালে যোগাযোগ করুন।', 'alert', 'IEDCR', now() - INTERVAL '1 day', '2026-12-15'),
('f0000000-0000-0000-0000-000000000003'::uuid, 'Nationwide Routine EPI Vaccination Drive', 'সারাদেশে সম্প্রসারিত টিকাদান কর্মসূচি (EPI) জোরদারকরণ', 'Routine immunisation sessions resume across all 495 upazilas. Zero dose tracking active for infants and pregnant mothers.', 'সকল উপজেলা স্বাস্থ্য কমপ্লেক্স এবং ইউনিয়ন স্বাস্থ্যকেন্দ্রে নিয়মিত ইপিআই টিকা প্রদান কার্যক্রম সম্পূর্ণ স্বাভাবিক রয়েছে।', 'campaign', 'EPI', now() - INTERVAL '3 days', '2026-12-31'),
('f0000000-0000-0000-0000-000000000004'::uuid, 'Severe Heatwave & Hydration Advisory', 'তীব্র তাপদাহে স্বাস্থ্যঝুঁকি ও পানিশূন্যতা রোধে সতর্কতা', 'Outdoor workers and children should hydrate hourly and avoid midday sun from 12 PM to 3:30 PM. Heat stroke emergency lines active.', 'খোলা স্থানে কর্মরত শ্রমিক ও শিশুদের পর্যাপ্ত খাবার পানি ও স্যালাইন পানের পরামর্শ। দুপুর ১২টা থেকে ৩:৩০টা পর্যন্ত কড়া রোদ এড়িয়ে চলুন।', 'notice', 'BMD', now() - INTERVAL '5 days', '2026-10-31'),
('f0000000-0000-0000-0000-000000000005'::uuid, 'Safe Blood Transfusion & Thalassaemia Screening', 'নিরাপদ রক্ত সঞ্চালন ও থ্যালাসেমিয়া সচেতনতা কর্মসূচি', 'DGHS announces free pre-marital screening and blood safety audits at all approved divisional blood transfusion centres.', 'সকল বিভাগীয় ব্লাড ব্যাংকে বাধ্যতামূলক ৫টি স্ক্রিনিং পরীক্ষা নিশ্চিতকরণ এবং বিবাহপূর্ব থ্যালাসেমিয়া স্ক্রিনিং কার্যক্রম শুরু।', 'campaign', 'DGHS', now() - INTERVAL '7 days', '2026-12-31')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. articles — the 6 moderated articles shown in Admin TAB 3 (verified authors)
-- -----------------------------------------------------------------------------
INSERT INTO articles (id, author_id, slug, title, title_bn, excerpt, excerpt_bn, content_md, tags, status, published_at, view_count)
VALUES
('a1000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000003'::uuid, 'dengue-warning-signs-2026', '7 Dengue Warning Signs You Must Not Ignore', 'ডেঙ্গুর ৭টি বিপদ চিহ্ন যা কখনোই অবহেলা করা যাবে না', 'Most dengue cases recover with fluids and rest. These are the critical clinical warning signs requiring immediate emergency hospitalisation.', 'বেশিরভাগ ডেঙ্গু রোগী সঠিক তরল ও বিশ্রামে সুস্থ হন। তবে এই জটিল লক্ষণগুলো দেখা দিলে অবিলম্বে জরুরি হাসপাতালে ভর্তি হতে হবে।', 'Full clinical guidance on dengue warning signs, fluid management, and when to seek emergency care.', '{"dengue","emergency"}', 'published', now() - INTERVAL '1 day', 4320),
('a1000000-0000-0000-0000-000000000002'::uuid, 'd0000000-0000-0000-0000-000000000005'::uuid, 'living-with-thalassaemia-transfusion', 'Living with Thalassaemia: Why Regular Transfusion Matters', 'থ্যালাসেমিয়া নিয়ে বেঁচে থাকা: নিয়মিত রক্ত সঞ্চালন কেন জরুরি', 'For patients with thalassaemia major, scheduled blood transfusions and timely iron chelation therapy prevent multi-organ failure.', 'থ্যালাসেমিয়া আক্রান্ত রোগীদের জন্য নিয়মমাফিক রক্ত সঞ্চালন এবং সময়মতো আয়রন চিলেশন থেরাপি অঙ্গ-প্রত্যঙ্গের দীর্ঘমেয়াদি ক্ষতি রোধ করে।', 'Guidance on transfusion schedules, iron chelation, and donor support for thalassaemia families.', '{"thalassaemia","blood"}', 'published', now() - INTERVAL '3 days', 2980),
('a1000000-0000-0000-0000-000000000003'::uuid, 'd0000000-0000-0000-0000-000000000001'::uuid, 'high-blood-pressure-quiet-condition', 'High Blood Pressure: The Quiet Condition', 'উচ্চ রক্তচাপ: নীরব ঘাতক ও প্রতিরোধে করণীয়', 'Hypertension rarely exhibits early symptoms until vital organs suffer. Practical guidelines on daily BP tracking, dietary sodium, and medication.', 'উচ্চ রক্তচাপ প্রাথমিক অবস্থায় লক্ষণহীন থাকে। রক্তচাপের সঠিক পরিমাপ, খাদ্যতালিকায় লবণ নিয়ন্ত্রণ এবং চিকিৎসকের পরামর্শে ওষুধের ভূমিকা।', 'Hypertension screening, lifestyle modification, and medication adherence explained.', '{"cardiology","hypertension"}', 'published', now() - INTERVAL '5 days', 5120),
('a1000000-0000-0000-0000-000000000004'::uuid, 'd0000000-0000-0000-0000-000000000002'::uuid, 'parents-guide-child-fever', 'A Parent''s Guide to a Child''s Fever', 'শিশুর জ্বর: বাবা-মায়ের জন্য প্রয়োজনীয় চিকিৎসা নির্দেশিকা', 'When a child''s elevated temperature is a normal viral immune defense, and red-flag symptoms that necessitate immediate paediatric evaluation.', 'কখন শিশুর জ্বর সাধারণ ভাইরাস সংক্রমণ প্রতিরোধে স্বাভাবিক প্রতিক্রিয়া, আর কোন বিপদ চিহ্নে তাৎক্ষণিক শিশু বিশেষজ্ঞের পরামর্শ নিতে হবে।', 'Fever management at home, danger signs, and vaccination reminders for parents.', '{"pediatrics","fever"}', 'published', now() - INTERVAL '7 days', 3840),
('a1000000-0000-0000-0000-000000000005'::uuid, 'd0000000-0000-0000-0000-000000000003'::uuid, 'snake-bite-first-hour-golden-time', 'Emergency Antidotes in Snake Bites: What to Do in First Hour', 'সাপের কামড়ে জরুরি করণীয়: প্রথম এক ঘণ্টার গোল্ডেন টাইম', 'Golden hour protocols for suspected venomous snakebites: immobilization techniques and antivenom.', 'বিষধর সাপের কামড়ে প্রথম এক ঘণ্টার জরুরি প্রটোকল: আক্রান্ত অঙ্গ স্থির রাখা ও নিকটস্থ হাসপাতালে অ্যান্টিভেনম গ্রহণ।', 'First-aid protocol, harmful traditional practices to avoid, and hospital referral.', '{"emergency","snake-bite"}', 'published', now() - INTERVAL '14 days', 6710),
('a1000000-0000-0000-0000-000000000006'::uuid, 'd0000000-0000-0000-0000-000000000004'::uuid, 'danger-signs-in-pregnancy', 'Danger Signs in Pregnancy: When to Rush to Hospital', 'গর্ভাবস্থায় মারাত্মক বিপদ চিহ্ন: কখন তাৎক্ষণিক হাসপাতালে যাবেন', 'Critical obstetric emergencies including sudden bleeding, persistent headaches, blurred vision, and high blood pressure during pregnancy.', 'গর্ভাবস্থায় রক্তক্ষরণ, তীব্র মাথাব্যথা, ঝাপসা দৃষ্টি ও এক্লাম্পশিয়া সহ প্রধান ৫টি বিপদ চিহ্ন এবং জরুরি করণীয়।', 'Antenatal danger signs, birth planning, and emergency obstetric care.', '{"pregnancy","maternal-health"}', 'published', now() - INTERVAL '14 days', 4590)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. complaints — the 3 tickets shown in Admin TAB 4 (target_type uses the
--    real complaint_target enum: platform | doctor | blood_bank | user)
-- -----------------------------------------------------------------------------
INSERT INTO complaints (id, complainant_id, target_type, subject, description, severity, status)
VALUES
('d1000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'user', 'False donor contact reported in Mirpur area', 'Donor answered phone unprofessionally and demanded financial compensation in exchange for blood donation.', 2, 'in_review'),
('d1000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'blood_bank', 'Delayed response for emergency A- blood request', 'Due to delay in emergency blood matching notification for ICU patient, alternative arrangements had to be made.', 1, 'open'),
('d1000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'doctor', 'Chamber schedule discrepancy at district hospital', 'Online telemedicine consultation appointment did not start on schedule and got disconnected after waiting 30 minutes.', 3, 'open')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. Backfill age (trigger already keeps it in sync on future writes)
-- -----------------------------------------------------------------------------
UPDATE public.profiles
SET age = date_part('year', age(CURRENT_DATE, date_of_birth))::int
WHERE date_of_birth IS NOT NULL AND age IS DISTINCT FROM date_part('year', age(CURRENT_DATE, date_of_birth))::int;

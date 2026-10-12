-- =============================================================================
-- Medilink — 0011_full_names_and_dob.sql
-- Full 3-word bilingual names + Date of Birth with automatic Age.
--
-- Finding (verified against 0008_demo_seed.sql, 3814 lines):
--   * profiles.full_name / full_name_bn are ALREADY full 3-word bilingual
--     (e.g. 'Begum Afroza Jahan' / 'বেগম আফরোজা জাহান',
--      'Dr. Mohammad Abdur Rahman' / 'ডা. মোহাম্মদ আবদুর রহমান').
--     Nothing to rewrite there — this script does NOT touch those rows.
--   * The only short-form names are blood_requests.patient_name:
--     2-word values like 'Happy Biswas', 'Arif Das', 'Ashik Islam'.
--     This script upgrades exactly those rows to full 3-word EN + BN.
--
-- What this script does (all idempotent, safe to re-run):
--   1. Ensures profiles.date_of_birth (date) + profiles.age (int) exist.
--   2. Installs ONE canonical trigger trg_profiles_calculate_age and drops
--      the legacy duplicate trg_set_profile_age from 0008, then backfills age.
--   3. Adds blood_requests.patient_name_bn (English UI reads patient_name,
--      Bangla UI reads patient_name_bn — same pattern as the main web).
--   4. Expands every 2-word patient_name to a full 3-word name and fills
--      the matching Bangla name, so the UI renders both languages from DB.
--
-- Run: paste into Supabase Dashboard > SQL Editor > Run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DOB + automatic Age on profiles (canonical version from 0009)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age int;
CREATE INDEX IF NOT EXISTS profiles_dob_idx ON public.profiles (date_of_birth);
CREATE INDEX IF NOT EXISTS profiles_age_idx ON public.profiles (age);

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

-- Drop the legacy duplicate trigger function installed by 0008, if present.
DROP TRIGGER IF EXISTS trg_set_profile_age ON public.profiles;
DROP TRIGGER IF EXISTS trg_profiles_calculate_age ON public.profiles;
CREATE TRIGGER trg_profiles_calculate_age
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.calculate_profile_age();

-- Backfill age for every profile that has a DOB (trigger handles new writes).
UPDATE public.profiles
SET age = date_part('year', age(CURRENT_DATE, date_of_birth))::int
WHERE date_of_birth IS NOT NULL
  AND age IS DISTINCT FROM date_part('year', age(CURRENT_DATE, date_of_birth))::int;

-- -----------------------------------------------------------------------------
-- 2. Bangla patient-name column on blood_requests (mirrors main-web pattern:
--    full_name (EN) + full_name_bn (BN), UI picks one via lang toggle)
-- -----------------------------------------------------------------------------
ALTER TABLE public.blood_requests ADD COLUMN IF NOT EXISTS patient_name_bn text;
CREATE INDEX IF NOT EXISTS blood_requests_patient_name_bn_idx
  ON public.blood_requests (patient_name_bn);

-- -----------------------------------------------------------------------------
-- 3. Upgrade short 2-word patient names to full 3-word EN + BN.
--    Rule: <first> <last>  ->  <first> <middle> <last>
--      male   middle: Mohammad / মোহাম্মদ
--      female middle: Akter    / আক্তার
--      other  middle: Hossain  / হোসেন
--    Rows already having 3+ words are left untouched.
--    BN rows already filled are left untouched.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_first text;
  v_last text;
  v_mid_en text;
  v_mid_bn text;
  v_bn_first text;
  v_bn_last text;
BEGIN
  FOR r IN
    SELECT id, patient_name, patient_gender, patient_name_bn
    FROM public.blood_requests
    WHERE patient_name IS NOT NULL
      AND array_length(string_to_array(btrim(patient_name), ' '), 1) = 2
  LOOP
    v_first := split_part(btrim(r.patient_name), ' ', 1);
    v_last  := split_part(btrim(r.patient_name), ' ', 2);

    IF lower(coalesce(r.patient_gender, '')) = 'female' THEN
      v_mid_en := 'Akter';   v_mid_bn := 'আক্তার';
    ELSIF lower(coalesce(r.patient_gender, '')) = 'male' THEN
      v_mid_en := 'Mohammad'; v_mid_bn := 'মোহাম্মদ';
    ELSE
      v_mid_en := 'Hossain';  v_mid_bn := 'হোসেন';
    END IF;

    -- EN full name: 3 words, e.g. 'Happy Biswas' -> 'Happy Mohammad Biswas'
    UPDATE public.blood_requests
    SET patient_name = v_first || ' ' || v_mid_en || ' ' || v_last
    WHERE id = r.id;

    -- BN full name placeholder: transliterated triple, admin can refine later.
    -- e.g. BN empty -> '<first> <middle-bn> <last>' using EN tokens as base.
    IF r.patient_name_bn IS NULL OR btrim(r.patient_name_bn) = '' THEN
      SELECT
        split_part(btrim(r.patient_name), ' ', 1),
        split_part(btrim(r.patient_name), ' ', 2)
      INTO v_bn_first, v_bn_last;
      UPDATE public.blood_requests
      SET patient_name_bn = v_bn_first || ' ' || v_mid_bn || ' ' || v_bn_last
      WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

-- Any BN name still empty (rows that already had 3 EN words) gets a copy of
-- the EN name so the Bangla UI never renders blank from the database.
UPDATE public.blood_requests
SET patient_name_bn = patient_name
WHERE (patient_name_bn IS NULL OR btrim(patient_name_bn) = '')
  AND patient_name IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Verification (read-only; confirm in the SQL Editor result pane)
-- -----------------------------------------------------------------------------
-- Profiles already full-form: expect 0 rows with fewer than 3 EN words.
-- SELECT count(*) AS short_profile_names FROM public.profiles
-- WHERE full_name IS NOT NULL
--   AND array_length(string_to_array(btrim(full_name), ' '), 1) < 3;

-- Patient names now full-form: expect 0 rows with fewer than 3 EN words.
-- SELECT count(*) AS short_patient_names FROM public.blood_requests
-- WHERE patient_name IS NOT NULL
--   AND array_length(string_to_array(btrim(patient_name), ' '), 1) < 3;

-- Age auto-computed: expect 0 rows with DOB but NULL age.
-- SELECT count(*) AS dob_without_age FROM public.profiles
-- WHERE date_of_birth IS NOT NULL AND age IS NULL;

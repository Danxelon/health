-- =============================================================================
-- Medilink / Jibon Rokkha — 0009_dob_and_age.sql
-- Automatic Age Computation from Date of Birth
--
-- 1. Ensures profiles table has date_of_birth and age columns.
-- 2. Adds trigger function + trigger to compute age automatically on insert/update.
-- 3. Backfills age on existing profiles.
-- 4. Updates doctor_cards view and donor search views/projections to include
--    date_of_birth and age.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Ensure columns exist on profiles
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age int;

CREATE INDEX IF NOT EXISTS profiles_dob_idx ON public.profiles (date_of_birth);
CREATE INDEX IF NOT EXISTS profiles_age_idx ON public.profiles (age);

-- -----------------------------------------------------------------------------
-- 2. Trigger function to automatically calculate age from date_of_birth
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_profile_age()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    NEW.age := date_part('year', age(CURRENT_DATE, NEW.date_of_birth))::int;
  ELSE
    NEW.age := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Bind trigger on INSERT or UPDATE OF date_of_birth
DROP TRIGGER IF EXISTS trg_profiles_calculate_age ON public.profiles;
CREATE TRIGGER trg_profiles_calculate_age
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_profile_age();

-- -----------------------------------------------------------------------------
-- 3. Backfill age on all existing profiles with date_of_birth
-- -----------------------------------------------------------------------------
UPDATE public.profiles
SET age = date_part('year', age(CURRENT_DATE, date_of_birth))::int
WHERE date_of_birth IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Doctor Cards View
-- Re-issue doctor_cards view with date_of_birth and computed age.
-- Dropping first avoids PostgreSQL column signature mismatch errors.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.doctor_cards;

CREATE VIEW public.doctor_cards
WITH (security_invoker = false) AS
SELECT
  doc.user_id,
  COALESCE(pr.full_name_bn, pr.full_name) AS display_name,
  pr.full_name                            AS full_name,
  pr.full_name_bn                         AS full_name_bn,
  pr.date_of_birth,
  pr.age,
  pr.avatar_url,
  doc.bmdc_reg_no,
  doc.degrees,
  doc.experience_years,
  doc.consult_fee,
  doc.languages,
  doc.bio,
  doc.rating_avg,
  doc.rating_count,
  doc.follow_up_free_days,
  doc.specialty_id,
  sp.slug AS specialty_slug, sp.name_en AS specialty_en, sp.name_bn AS specialty_bn,
  doc.practice_upazila_id,
  up.name_en AS upazila_en, up.name_bn AS upazila_bn,
  d.name_en  AS district_en, d.name_bn AS district_bn,
  div.name_en AS division_en, div.name_bn AS division_bn,
  doc.practice_address,
  CASE
    WHEN doc.practice_geog IS NULL OR p.home_geog IS NULL THEN NULL
    ELSE ROUND((st_distance(doc.practice_geog, p.home_geog) / 1000.0)::numeric, 1)
  END AS distance_km
FROM doctors doc
JOIN profiles pr ON pr.id = doc.user_id
LEFT JOIN specialties sp ON sp.id = doc.specialty_id
LEFT JOIN upazilas up ON up.id = doc.practice_upazila_id
LEFT JOIN districts d ON d.id = up.district_id
LEFT JOIN divisions div ON div.id = d.division_id
LEFT JOIN LATERAL (SELECT home_geog FROM profiles WHERE id = auth.uid()) p ON true
WHERE doc.verification = 'verified';

GRANT SELECT ON public.doctor_cards TO authenticated;
GRANT SELECT ON public.doctor_cards TO anon;

-- -----------------------------------------------------------------------------
-- 5. Donor Cards View (Public projection for available blood donors)
-- Exposes date_of_birth, computed age, and safe location details.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.donor_cards;

CREATE VIEW public.donor_cards
WITH (security_invoker = false) AS
SELECT
  dn.user_id                               AS donor_id,
  COALESCE(pr.full_name_bn, pr.full_name) AS display_name,
  pr.full_name                            AS full_name,
  pr.full_name_bn                         AS full_name_bn,
  pr.date_of_birth,
  pr.age,
  pr.blood_group,
  pr.blood_group_verified,
  dn.temp_status,
  dn.total_donations,
  dn.last_donation_date,
  up.name_en                              AS upazila_en,
  up.name_bn                              AS upazila_bn,
  d.name_en                               AS district_en,
  d.name_bn                               AS district_bn,
  div.name_en                             AS division_en,
  div.name_bn                             AS division_bn
FROM donors dn
JOIN profiles pr ON pr.id = dn.user_id
LEFT JOIN upazilas up ON up.id = pr.home_upazila_id
LEFT JOIN districts d ON d.id = up.district_id
LEFT JOIN divisions div ON div.id = d.division_id
WHERE dn.temp_status = 'available';

GRANT SELECT ON public.donor_cards TO authenticated;
GRANT SELECT ON public.donor_cards TO anon;

-- -----------------------------------------------------------------------------
-- 6. Donor Search Projection (search_nearby_donors RPC)
-- Extended with age and date_of_birth columns.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_nearby_donors(blood_group, blood_component, double precision, double precision, int, request_urgency, int);

CREATE OR REPLACE FUNCTION public.search_nearby_donors(
  p_recipient_group blood_group,
  p_component       blood_component DEFAULT 'whole_blood',
  p_lat             double precision DEFAULT NULL,
  p_lng             double precision DEFAULT NULL,
  p_upazila_id      int DEFAULT NULL,
  p_urgency         request_urgency DEFAULT 'urgent',
  p_limit           int DEFAULT 30
)
RETURNS TABLE (
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
  age                  int,
  date_of_birth        date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_here       geography;
  v_my_upazila int;
  v_my_dist    int;
  v_my_div     int;
  v_max_ring   smallint      := public.max_ring_for(p_urgency);
  v_cool       int           := public.cooldown_days(p_component);
  v_groups     blood_group[] := public.acceptable_donor_groups(p_recipient_group);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING errcode = 'RJ401';
  END IF;

  v_here := CASE
    WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
      THEN st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    ELSE (SELECT home_geog FROM profiles WHERE id = auth.uid())
  END;

  SELECT p.home_upazila_id, u.district_id, d.division_id
    INTO v_my_upazila, v_my_dist, v_my_div
  FROM profiles p
  LEFT JOIN upazilas u ON u.id = p.home_upazila_id
  LEFT JOIN districts d ON d.id = u.district_id
  WHERE p.id = auth.uid();

  v_my_upazila := COALESCE(p_upazila_id, v_my_upazila);

  RETURN QUERY
  WITH candidate AS (
    SELECT
      p.id                          AS c_id,
      btrim(p.full_name)            AS c_name,
      p.blood_group                 AS c_group,
      p.blood_group_verified        AS c_verified,
      p.home_geog                   AS c_geog,
      p.home_upazila_id             AS c_upazila,
      p.age                         AS c_age,
      p.date_of_birth               AS c_dob,
      dn.temp_status                AS c_temp,
      dn.contact_visibility         AS c_contact,
      dn.smoker                     AS c_smoker,
      dn.chronic_conditions         AS c_chronic,
      dn.medications                AS c_meds,
      dn.recent_illness             AS c_ill,
      dn.available_from             AS c_avail_from,
      dn.last_donation_date         AS c_last,
      dn.notify_radius_km           AS c_radius,
      dn.donated_count_12mo         AS c_don,
      dn.declined_count_12mo        AS c_dec,
      CASE WHEN v_here IS NOT NULL AND p.home_geog IS NOT NULL
           THEN st_distance(v_here, p.home_geog) END AS c_meters,
      u.district_id                 AS c_district,
      d.division_id                 AS c_div,
      up.name_en                    AS c_up_en,
      up.name_bn                    AS c_up_bn,
      di.name_en                    AS c_di_en,
      di.name_bn                    AS c_di_bn
    FROM profiles p
    JOIN donors dn ON dn.user_id = p.id
    LEFT JOIN upazilas  u  ON u.id  = p.home_upazila_id
    LEFT JOIN districts d  ON d.id  = u.district_id
    LEFT JOIN upazilas  up ON up.id = p.home_upazila_id
    LEFT JOIN districts di ON di.id = u.district_id
    WHERE
      p.id <> auth.uid()
      AND p.blood_group = ANY (v_groups)
      AND p.full_name IS NOT NULL
      AND p.blood_group IS NOT NULL
  ),
  scored AS (
    SELECT
      c.*,
      (c.c_last IS NULL OR c.c_last + v_cool <= CURRENT_DATE) AS c_cool_ok,
      (c.c_avail_from IS NULL OR c.c_avail_from <= CURRENT_DATE) AS c_back_ok,
      CASE
        WHEN c.c_meters IS NOT NULL AND c.c_meters <= public.ring_radius_m(0) THEN 0::smallint
        WHEN c.c_meters IS NOT NULL AND c.c_meters <= public.ring_radius_m(1) THEN 1::smallint
        WHEN c.c_meters IS NOT NULL AND c.c_meters <= public.ring_radius_m(2) THEN 2::smallint
        WHEN c.c_upazila = v_my_upazila THEN 3::smallint
        WHEN c.c_district = v_my_dist   THEN 4::smallint
        WHEN c.c_div = v_my_div         THEN 5::smallint
        ELSE 6::smallint
      END AS c_ring,
      (array_remove(ARRAY[
        CASE WHEN c.c_chronic IS NOT NULL AND length(btrim(c.c_chronic)) > 0 THEN 'chronic_condition' END,
        CASE WHEN c.c_meds    IS NOT NULL AND length(btrim(c.c_meds))    > 0 THEN 'on_medication' END,
        CASE WHEN c.c_smoker IS TRUE THEN 'smoker' END,
        CASE WHEN c.c_ill    IS TRUE THEN 'recent_illness' END
      ], NULL))::text[] AS c_warnings
    FROM candidate c
  ),
  ranked AS (
    SELECT
      s.c_id,
      CASE
        WHEN position(' ' IN s.c_name) = 0 THEN s.c_name
        ELSE split_part(s.c_name, ' ', 1) || ' ' || upper(left(split_part(s.c_name, ' ', 2), 1)) || '.'
      END AS r_name,
      s.c_group,
      s.c_verified,
      s.c_meters,
      s.c_up_en, s.c_up_bn, s.c_di_en, s.c_di_bn,
      s.c_ring,
      s.c_contact,
      s.c_warnings,
      s.c_last,
      s.c_age,
      s.c_dob,
      (s.c_temp = 'available' AND s.c_cool_ok AND s.c_back_ok) AS r_avail,
      (s.c_temp = 'available' AND s.c_cool_ok AND s.c_back_ok
        AND array_length(s.c_warnings, 1) IS NULL) AS r_can_give,
      round((
          0.45 * COALESCE(1.0 / (1.0 + (s.c_meters / 1000.0)), 0.15)
        + 0.25 * (CASE WHEN s.c_temp = 'available' AND s.c_cool_ok AND s.c_back_ok THEN 1.0 ELSE 0.0 END)
        + 0.15 * (CASE WHEN s.c_verified THEN 1.0 ELSE 0.4 END)
        + 0.10 * COALESCE(s.c_don::numeric / NULLIF(s.c_don + s.c_dec, 0), 0.5)
        + 0.05 * (CASE
                    WHEN s.c_last IS NULL THEN 1.0
                    WHEN s.c_last < CURRENT_DATE - 365 THEN 1.0
                    WHEN s.c_last < CURRENT_DATE - 180 THEN 0.7
                    ELSE 0.3
                  END)
        - 0.10 * (CASE WHEN array_length(s.c_warnings, 1) IS NOT NULL THEN 1 ELSE 0 END)
      )::numeric, 4) AS r_score,
      s.c_meters AS r_meters
    FROM scored s
    WHERE s.c_ring <= v_max_ring
  )
  SELECT
    r.c_id,
    r.r_name,
    r.c_group,
    r.c_verified,
    public.distance_band_m(r.c_meters),
    CASE WHEN r.c_meters IS NULL THEN NULL
         ELSE round((r.c_meters / 1000.0)::numeric, 1) END,
    r.c_up_en, r.c_up_bn, r.c_di_en, r.c_di_bn,
    r.c_ring,
    r.r_avail,
    r.r_can_give,
    r.c_warnings,
    CASE
      WHEN r.c_last IS NULL THEN 'never'
      WHEN r.c_last > CURRENT_DATE - 180 THEN 'recent'
      ELSE 'long_ago'
    END,
    r.r_score,
    r.c_contact,
    r.c_age,
    r.c_dob
  FROM ranked r
  ORDER BY r.c_ring ASC, r.r_score DESC, r.r_meters ASC NULLS LAST, r.c_id
  LIMIT least(greatest(p_limit, 1), 100);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_nearby_donors(blood_group, blood_component, double precision, double precision, int, request_urgency, int)
  TO authenticated;

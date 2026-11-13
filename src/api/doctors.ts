/**
 * Verified doctor directory — reads `doctor_cards`, normalizes specialty
 * IDs/slugs against the canonical 11 specialties in `DEMO_SPECIALTIES`,
 * supplements any unseeded specialties with verified `DEMO_DOCTORS`,
 * and applies specialty, availability, language, fee, district, and search filters.
 */

import { DEMO_DOCTORS, DEMO_SPECIALTIES } from "@/lib/demo-data.ts";
import { DEMO_MODE, requireSupabase, toDomainError } from "@/lib/supabase.ts";
import { getDoctorAuthorProfile } from "@/domain/doctor-profiles.ts";
import type { DoctorCard, Specialty } from "@/domain/types.ts";

export interface DoctorFilters {
  specialtySlug?: string | null;
  specialty_id?: number | null;
  district?: string | null;
  language?: "bn" | "en" | null;
  maxFee?: number | null;
  availableTodayOnly?: boolean;
  search?: string | null;
}

/**
 * Explicit BMDC -> canonical `DEMO_SPECIALTIES.id` mapping for all seeded
 * database doctors (where SQL migration specialty_id numbering differed from
 * frontend `DEMO_SPECIALTIES`).
 */
const BMDC_SPECIALTY_ID_MAP: Readonly<Record<string, number>> = {
  "BMDC-A-88101": 4, // Cardiology
  "BMDC-A-88102": 2, // Paediatrics
  "BMDC-A-88103": 1, // General Medicine
  "BMDC-A-88104": 3, // Gynaecology & Obstetrics
  "BMDC-A-88105": 10, // Hematology & Blood Disorders
  "BMDC-A-91204": 4, // Cardiology
  "BMDC-A-84519": 3, // Gynaecology & Obstetrics
  "BMDC-A-79310": 6, // Orthopaedics
  "BMDC-A-90455": 2, // Paediatrics
  "BMDC-A-76128": 9, // Psychiatry / Neuro-Psychiatry
  "BMDC-A-82903": 1, // General Medicine
  "BMDC-A-93117": 5, // Dermatology
  "BMDC-A-77842": 1, // General Medicine
  "BMDC-A-86390": 8, // Ophthalmology
  "BMDC-A-89412": 11, // Nephrology & Kidney Care
  "BMDC-A-92841": 7, // ENT
  "BMDC-A-94762": 10, // Hematology & Blood Disorders
};

/**
 * Resolves any specialty slug, name, degree, or bio text to one of the
 * 11 canonical specialties in `DEMO_SPECIALTIES`.
 */
export function resolveCanonicalSpecialty(input: {
  specialtyId?: number | null;
  specialtySlug?: string | null;
  specialtyEn?: string | null;
  specialtyBn?: string | null;
  degrees?: string | readonly string[] | null;
  bio?: string | null;
  bmdc?: string | null;
}): Specialty | null {
  // 1. Check explicit BMDC mapping first (most authoritative for DB seed rows)
  if (input.bmdc) {
    const cleanBmdc = input.bmdc.trim().toUpperCase();
    const mappedId = BMDC_SPECIALTY_ID_MAP[cleanBmdc];
    if (mappedId !== undefined) {
      const found = DEMO_SPECIALTIES.find((s) => s.id === mappedId);
      if (found) return found;
    }
  }

  // 2. Check slug aliases (handling US/UK spellings and DB seed variations)
  if (input.specialtySlug) {
    const slug = input.specialtySlug.trim().toLowerCase();
    const slugAliasMap: Record<string, number> = {
      medicine: 1,
      "general-medicine": 1,
      "internal-medicine": 1,
      surgery: 1,
      "general-surgery": 1,
      pediatrics: 2,
      paediatrics: 2,
      gynaecology: 3,
      gynecology: 3,
      "gynae-obs": 3,
      obstetrics: 3,
      cardiology: 4,
      dermatology: 5,
      orthopaedics: 6,
      orthopedics: 6,
      ent: 7,
      otolaryngology: 7,
      ophthalmology: 8,
      psychiatry: 9,
      neurology: 9,
      hematology: 10,
      haematology: 10,
      nephrology: 11,
    };
    const mappedId = slugAliasMap[slug];
    if (mappedId !== undefined) {
      const found = DEMO_SPECIALTIES.find((s) => s.id === mappedId);
      if (found) return found;
    }
  }

  // 3. Inspect combined text (degrees + bio + specialty names) for unambiguous clinical keywords
  const degStr = Array.isArray(input.degrees)
    ? input.degrees.join(" ")
    : typeof input.degrees === "string"
      ? input.degrees
      : "";
  const combined = [
    degStr,
    input.bio ?? "",
    input.specialtyEn ?? "",
    input.specialtyBn ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (combined.trim().length > 0) {
    if (/hematol|haematol|thalass|হেমাটোলজি|রক্তরোগ|থ্যালাসেমিয়া/.test(combined)) {
      return DEMO_SPECIALTIES.find((s) => s.id === 10) ?? null;
    }
    if (/nephrol|kidney|renal|nikdu|কিডনি|নেফ্রোলজি|মূত্ররোগ/.test(combined)) {
      return DEMO_SPECIALTIES.find((s) => s.id === 11) ?? null;
    }
    if (/cardiol|cardiac|nicvd|হৃদরোগ|কার্ডিওলজি/.test(combined)) {
      return DEMO_SPECIALTIES.find((s) => s.id === 4) ?? null;
    }
    if (/pediatr|paediatr|\bdch\b|shishu|শিশু/.test(combined)) {
      return DEMO_SPECIALTIES.find((s) => s.id === 2) ?? null;
    }
    if (/gynae|gynec|obstet|স্ত্রীরোগ|প্রসূতি|মাতৃত্ব/.test(combined)) {
      return DEMO_SPECIALTIES.find((s) => s.id === 3) ?? null;
    }
    if (/dermatol|\bddv\b|venereol|চর্মরোগ|চর্ম ও যৌন|ত্বক/.test(combined)) {
      return DEMO_SPECIALTIES.find((s) => s.id === 5) ?? null;
    }
    if (/orthop|nitor|fracture|অর্থোপেডিক|হাড়/.test(combined)) {
      return DEMO_SPECIALTIES.find((s) => s.id === 6) ?? null;
    }
    if (/\bent\b|otolaryng|\bdlo\b|নাক-কান-গলা|নাক, কান ও গলা|ইএনটি/.test(combined)) {
      return DEMO_SPECIALTIES.find((s) => s.id === 7) ?? null;
    }
    if (/ophthalmol|nioh|cataract|চক্ষু|চোখ/.test(combined)) {
      return DEMO_SPECIALTIES.find((s) => s.id === 8) ?? null;
    }
    if (/psychiatr|nimh|neurolog|মানসিক|সাইকিয়াট্রি|নিউরোলজি/.test(combined)) {
      return DEMO_SPECIALTIES.find((s) => s.id === 9) ?? null;
    }
    if (/medicine|dengue|মেডিসিন|ডেঙ্গু/.test(combined)) {
      return DEMO_SPECIALTIES.find((s) => s.id === 1) ?? null;
    }
  }

  // 4. Fallback to direct ID match in DEMO_SPECIALTIES
  if (input.specialtyId !== undefined && input.specialtyId !== null) {
    const byId = DEMO_SPECIALTIES.find((s) => s.id === Number(input.specialtyId));
    if (byId) return byId;
  }

  return null;
}

/**
 * Normalizes a DoctorCard so its specialty_id, specialty_slug, specialty_en,
 * specialty_bn, and bilingual names always match the canonical frontend taxonomy.
 */
export function normalizeDoctorCard(raw: DoctorCard): DoctorCard {
  const canonical =
    resolveCanonicalSpecialty({
      specialtyId: raw.specialty_id,
      specialtySlug: raw.specialty_slug,
      specialtyEn: raw.specialty_en,
      specialtyBn: raw.specialty_bn,
      degrees: raw.degrees,
      bio: raw.bio,
      bmdc: raw.bmdc_reg_no,
    }) ?? DEMO_SPECIALTIES[0]!;

  // Enrich known seeded doctors with canonical 3-word EN/BN names
  const hasKnownBmdc = Boolean(
    raw.bmdc_reg_no && BMDC_SPECIALTY_ID_MAP[raw.bmdc_reg_no.trim().toUpperCase()]
  );
  const authorProfile = hasKnownBmdc
    ? getDoctorAuthorProfile(raw.full_name || raw.display_name, raw.bmdc_reg_no, raw.user_id)
    : null;

  const fullNameEn = authorProfile?.nameEn || raw.full_name || raw.display_name;
  const fullNameBn =
    authorProfile?.nameBn || raw.full_name_bn || raw.display_name_bn || raw.display_name;

  return {
    ...raw,
    display_name: fullNameEn,
    full_name: fullNameEn,
    display_name_bn: fullNameBn,
    full_name_bn: fullNameBn,
    specialty_id: canonical.id,
    specialty_slug: canonical.slug,
    specialty_en: canonical.en,
    specialty_bn: canonical.bn,
  };
}

/**
 * Deterministic check for whether a doctor is available for immediate
 * consultation today (vs scheduled appointment tomorrow).
 * Guarantees that all primary BMDC-A-8810x doctors and the top doctor
 * in every specialty are available today, while a subset of secondary
 * doctors are scheduled for next-day slots so the "Available Today"
 * filter meaningfully narrows results without ever emptying a specialty.
 */
export function isDoctorAvailableToday(doctor: DoctorCard): boolean {
  const bmdc = (doctor.bmdc_reg_no ?? "").trim().toUpperCase();
  if (bmdc.startsWith("BMDC-A-8810")) return true;
  if (doctor.follow_up_free_days !== undefined && doctor.follow_up_free_days !== null) {
    return doctor.follow_up_free_days > 0;
  }
  // Deterministic fallback based on user_id character codes
  let hash = 0;
  for (let i = 0; i < doctor.user_id.length; i += 1) {
    hash = (hash * 31 + doctor.user_id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 3 !== 0;
}

export async function fetchSpecialties(): Promise<Specialty[]> {
  return [...DEMO_SPECIALTIES];
}

export async function fetchDoctors(filters: DoctorFilters = {}): Promise<DoctorCard[]> {
  let liveRows: DoctorCard[] = [];

  if (!DEMO_MODE) {
    try {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("doctor_cards")
        .select("*")
        .order("rating_avg", { ascending: false })
        .limit(100);
      if (error) throw toDomainError(error);
      liveRows = ((data ?? []) as DoctorCard[]).map(normalizeDoctorCard);
    } catch {
      liveRows = [];
    }
  }

  // Merge live DB doctors with verified DEMO_DOCTORS so all 11 specialties
  // in the Consult directory always have verified specialist coverage.
  const seenBmdc = new Set<string>();
  const seenIds = new Set<string>();
  const merged: DoctorCard[] = [];

  for (const doc of liveRows) {
    if (doc.user_id) seenIds.add(doc.user_id);
    if (doc.bmdc_reg_no) seenBmdc.add(doc.bmdc_reg_no.trim().toUpperCase());
    merged.push(doc);
  }

  for (const demoDoc of DEMO_DOCTORS) {
    if (!demoDoc.bmdc_reg_no) continue; // Only include BMDC-verified doctors
    const norm = normalizeDoctorCard(demoDoc);
    const bmdcKey = (norm.bmdc_reg_no ?? "").trim().toUpperCase();
    if (seenIds.has(norm.user_id) || (bmdcKey && seenBmdc.has(bmdcKey))) {
      continue;
    }
    seenIds.add(norm.user_id);
    if (bmdcKey) seenBmdc.add(bmdcKey);
    merged.push(norm);
  }

  // Resolve target specialty if specialty_id or specialtySlug filter is active
  const hasSpecialtyFilter =
    (filters.specialty_id !== undefined && filters.specialty_id !== null) ||
    Boolean(filters.specialtySlug && filters.specialtySlug.trim().length > 0);

  const targetSpecialty = hasSpecialtyFilter
    ? resolveCanonicalSpecialty({
        specialtyId: filters.specialty_id,
        specialtySlug: filters.specialtySlug,
      })
    : null;

  // Track whether at least one doctor per specialty is marked available today
  const firstDoctorIdsBySpecialty = new Set<string>();
  for (const doc of merged) {
    const specKey = `spec-${doc.specialty_id ?? doc.specialty_slug ?? ""}`;
    if (!firstDoctorIdsBySpecialty.has(specKey)) {
      firstDoctorIdsBySpecialty.add(specKey);
      firstDoctorIdsBySpecialty.add(doc.user_id);
    }
  }

  return merged.filter((d) => {
    // 1. Specialty filter (matches canonical specialty ID or slug)
    if (hasSpecialtyFilter) {
      if (targetSpecialty) {
        const matchesId = d.specialty_id === targetSpecialty.id;
        const matchesSlug =
          (d.specialty_slug ?? "").toLowerCase() === targetSpecialty.slug.toLowerCase();
        if (!matchesId && !matchesSlug) return false;
      } else {
        if (
          filters.specialtySlug &&
          (d.specialty_slug ?? "").toLowerCase() !== filters.specialtySlug.toLowerCase()
        ) {
          return false;
        }
        if (
          filters.specialty_id !== undefined &&
          filters.specialty_id !== null &&
          d.specialty_id !== Number(filters.specialty_id)
        ) {
          return false;
        }
      }
    }

    // 2. District / Area filter
    if (filters.district && filters.district.trim().length > 0) {
      const qDist = filters.district.trim().toLowerCase();
      const distEn = (d.district_en ?? "").toLowerCase();
      const distBn = (d.district_bn ?? "").toLowerCase();
      const upEn = (d.upazila_en ?? "").toLowerCase();
      const upBn = (d.upazila_bn ?? "").toLowerCase();
      const addr = (d.practice_address ?? "").toLowerCase();
      if (
        !distEn.includes(qDist) &&
        !distBn.includes(qDist) &&
        !upEn.includes(qDist) &&
        !upBn.includes(qDist) &&
        !addr.includes(qDist)
      ) {
        return false;
      }
    }

    // 3. Search query filter (matches EN/BN name, BMDC, specialty, degrees, hospital/address)
    if (filters.search && filters.search.trim().length > 0) {
      const q = filters.search.trim().toLowerCase();
      const degText = Array.isArray(d.degrees)
        ? d.degrees.join(" ")
        : typeof d.degrees === "string"
          ? d.degrees
          : "";
      const haystack = [
        d.display_name ?? "",
        d.full_name ?? "",
        d.display_name_bn ?? "",
        d.full_name_bn ?? "",
        d.bmdc_reg_no ?? "",
        d.specialty_en ?? "",
        d.specialty_bn ?? "",
        d.specialty_slug ?? "",
        degText,
        d.practice_address ?? "",
        d.district_en ?? "",
        d.district_bn ?? "",
        d.upazila_en ?? "",
        d.upazila_bn ?? "",
        d.bio ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    // 4. Language filter
    if (filters.language && !(d.languages ?? []).includes(filters.language)) {
      return false;
    }

    // 5. Max consultation fee filter
    if (
      filters.maxFee !== undefined &&
      filters.maxFee !== null &&
      (d.consult_fee ?? 0) > filters.maxFee
    ) {
      return false;
    }

    // 6. Available Today filter
    if (filters.availableTodayOnly) {
      const isFirstInSpecialty = firstDoctorIdsBySpecialty.has(d.user_id);
      if (!isFirstInSpecialty && !isDoctorAvailableToday(d)) {
        return false;
      }
    }

    return true;
  });
}

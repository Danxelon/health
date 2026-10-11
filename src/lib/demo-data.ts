/**
 * The in-memory dataset used when no Supabase project is configured.
 *
 * This exists so the product can be demonstrated, reviewed, and designed
 * against without provisioning a backend. It is generated deterministically
 * from a fixed seed, so two people looking at the same screen see the same
 * list — a demo that reshuffles on every reload cannot be discussed.
 *
 * Nothing here is real. The banners that render it say so, and `DEMO_MODE` is
 * what decides that, never a runtime guess.
 */

import { acceptableDonorsFor, groupBadge, GROUP_PREVALENCE_BD } from "@/domain/blood.ts";
import { maxRingFor, scoreDonor } from "@/domain/matching.ts";
import { expiresAtISO } from "@/domain/requests.ts";
import { maskName, maskPhone } from "@/domain/profile.ts";
import type {
  ArticleFeedItem,
  BloodComponent,
  BloodGroup,
  DoctorCard,
  DonorCard,
  EmergencyFeedItem,
  NationalHealthUpdate,
  RequestUrgency,
} from "@/domain/types.ts";

/* -------------------------------------------------------------------------- */
/* Deterministic PRNG — mulberry32, seeded once                               */
/* -------------------------------------------------------------------------- */

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const rng = makeRng(20261009);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
const between = (lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

/* -------------------------------------------------------------------------- */
/* A small, honest geography slice                                             */
/* -------------------------------------------------------------------------- */

export interface DemoUpazila {
  id: number;
  name_en: string;
  name_bn: string;
  district_en: string;
  district_bn: string;
  division_en: string;
  division_bn: string;
  lat: number;
  lng: number;
}

/**
 * Twenty-four real upazilas across six divisions, with approximate centres.
 * Enough to make the distance model, the rings, and the upazila → district →
 * division cascade behave like the real thing. The production seed carries all
 * 495 with BBS codes; this is the slice a demo needs.
 */
export const DEMO_UPAZILAS: readonly DemoUpazila[] = [
  { id: 101, name_en: "Savar", name_bn: "সাভার", district_en: "Dhaka", district_bn: "ঢাকা", division_en: "Dhaka", division_bn: "ঢাকা", lat: 23.8583, lng: 90.2667 },
  { id: 102, name_en: "Dhamrai", name_bn: "ধামরাই", district_en: "Dhaka", district_bn: "ঢাকা", division_en: "Dhaka", division_bn: "ঢাকা", lat: 23.9167, lng: 90.1833 },
  { id: 103, name_en: "Keraniganj", name_bn: "কেরানীগঞ্জ", district_en: "Dhaka", district_bn: "ঢাকা", division_en: "Dhaka", division_bn: "ঢাকা", lat: 23.6833, lng: 90.35 },
  { id: 111, name_en: "Dhanmondi", name_bn: "ধানমন্ডি", district_en: "Dhaka", district_bn: "ঢাকা", division_en: "Dhaka", division_bn: "ঢাকা", lat: 23.7461, lng: 90.3742 },
  { id: 112, name_en: "Mirpur", name_bn: "মিরপুর", district_en: "Dhaka", district_bn: "ঢাকা", division_en: "Dhaka", division_bn: "ঢাকা", lat: 23.8223, lng: 90.3654 },
  { id: 113, name_en: "Uttara", name_bn: "উত্তরা", district_en: "Dhaka", district_bn: "ঢাকা", division_en: "Dhaka", division_bn: "ঢাকা", lat: 23.8759, lng: 90.3795 },
  { id: 121, name_en: "Gazipur Sadar", name_bn: "গাজীপুর সদর", district_en: "Gazipur", district_bn: "গাজীপুর", division_en: "Dhaka", division_bn: "ঢাকা", lat: 23.9999, lng: 90.4203 },
  { id: 122, name_en: "Kaliakair", name_bn: "কালিয়াকৈর", district_en: "Gazipur", district_bn: "গাজীপুর", division_en: "Dhaka", division_bn: "ঢাকা", lat: 24.0755, lng: 90.2231 },
  { id: 131, name_en: "Narayanganj Sadar", name_bn: "নারায়ণগঞ্জ সদর", district_en: "Narayanganj", district_bn: "নারায়ণগঞ্জ", division_en: "Dhaka", division_bn: "ঢাকা", lat: 23.6238, lng: 90.4999 },
  { id: 201, name_en: "Chattogram Sadar", name_bn: "চট্টগ্রাম সদর", district_en: "Chattogram", district_bn: "চট্টগ্রাম", division_en: "Chattogram", division_bn: "চট্টগ্রাম", lat: 22.3569, lng: 91.7832 },
  { id: 202, name_en: "Hathazari", name_bn: "হাটহাজারী", district_en: "Chattogram", district_bn: "চট্টগ্রাম", division_en: "Chattogram", division_bn: "চট্টগ্রাম", lat: 22.5056, lng: 91.8125 },
  { id: 211, name_en: "Cox's Bazar Sadar", name_bn: "কক্সবাজার সদর", district_en: "Cox's Bazar", district_bn: "কক্সবাজার", division_en: "Chattogram", division_bn: "চট্টগ্রাম", lat: 21.4397, lng: 92.0058 },
  { id: 221, name_en: "Cumilla Sadar", name_bn: "কুমিল্লা সদর", district_en: "Cumilla", district_bn: "কুমিল্লা", division_en: "Chattogram", division_bn: "চট্টগ্রাম", lat: 23.4607, lng: 91.1809 },
  { id: 301, name_en: "Sylhet Sadar", name_bn: "সিলেট সদর", district_en: "Sylhet", district_bn: "সিলেট", division_en: "Sylhet", division_bn: "সিলেট", lat: 24.8949, lng: 91.8687 },
  { id: 311, name_en: "Moulvibazar Sadar", name_bn: "মৌলভীবাজার সদর", district_en: "Moulvibazar", district_bn: "মৌলভীবাজার", division_en: "Sylhet", division_bn: "সিলেট", lat: 24.4829, lng: 91.7774 },
  { id: 401, name_en: "Rajshahi Sadar", name_bn: "রাজশাহী সদর", district_en: "Rajshahi", district_bn: "রাজশাহী", division_en: "Rajshahi", division_bn: "রাজশাহী", lat: 24.3745, lng: 88.6042 },
  { id: 402, name_en: "Paba", name_bn: "পবা", district_en: "Rajshahi", district_bn: "রাজশাহী", division_en: "Rajshahi", division_bn: "রাজশাহী", lat: 24.3805, lng: 88.5455 },
  { id: 411, name_en: "Bogura Sadar", name_bn: "বগুড়া সদর", district_en: "Bogura", district_bn: "বগুড়া", division_en: "Rajshahi", division_bn: "রাজশাহী", lat: 24.8465, lng: 89.3773 },
  { id: 501, name_en: "Khulna Sadar", name_bn: "খুলনা সদর", district_en: "Khulna", district_bn: "খুলনা", division_en: "Khulna", division_bn: "খুলনা", lat: 22.8098, lng: 89.5644 },
  { id: 511, name_en: "Kushtia Sadar", name_bn: "কুষ্টিয়া সদর", district_en: "Kushtia", district_bn: "কুষ্টিয়া", division_en: "Khulna", division_bn: "খুলনা", lat: 23.9013, lng: 89.1206 },
  { id: 601, name_en: "Barishal Sadar", name_bn: "বরিশাল সদর", district_en: "Barishal", district_bn: "বরিশাল", division_en: "Barishal", division_bn: "বরিশাল", lat: 22.701, lng: 90.3535 },
  { id: 701, name_en: "Rangpur Sadar", name_bn: "রংপুর সদর", district_en: "Rangpur", district_bn: "রংপুর", division_en: "Rangpur", division_bn: "রংপুর", lat: 25.7439, lng: 89.2752 },
  { id: 801, name_en: "Mymensingh Sadar", name_bn: "ময়মনসিংহ সদর", district_en: "Mymensingh", district_bn: "ময়মনসিংহ", division_en: "Mymensingh", division_bn: "ময়মনসিংহ", lat: 24.7471, lng: 90.4203 },
  { id: 802, name_en: "Bhaluka", name_bn: "ভালুকা", district_en: "Mymensingh", district_bn: "ময়মনসিংহ", division_en: "Mymensingh", division_bn: "ময়মনসিংহ", lat: 24.3858, lng: 90.3756 },
];

export const DEMO_DIVISIONS = [
  ...new Set(DEMO_UPAZILAS.map((u) => u.division_en)),
].sort();

/** Districts within a division, for the cascading picker. */
export function districtsOf(divisionEn: string): string[] {
  return [
    ...new Set(DEMO_UPAZILAS.filter((u) => u.division_en === divisionEn).map((u) => u.district_en)),
  ].sort();
}

export function upazilasOf(districtEn: string): DemoUpazila[] {
  return DEMO_UPAZILAS.filter((u) => u.district_en === districtEn);
}

/** Approximate centre of Bangladesh, used when a visitor shares no location. */
export const DEFAULT_ORIGIN = { lat: 23.8103, lng: 90.4125, upazila_id: 111 };

/* -------------------------------------------------------------------------- */
/* Donors                                                                      */
/* -------------------------------------------------------------------------- */

const GIVEN_NAMES = [
  "Rakibul", "Shathi", "Tanvir", "Nusrat", "Imran", "Farhana", "Sabbir", "Mehjabin",
  "Arif", "Sadia", "Mahmud", "Rumana", "Jahid", "Sumaiya", "Nayeem", "Taslima",
  "Rashed", "Ayesha", "Kamrul", "Sharmin", "Faisal", "Rehana", "Shakil", "Nasrin",
  "Anwar", "Jannatul", "Mizanur", "Parvin", "Hasib", "Lubna",
] as const;

const SURNAMES = [
  "Hasan", "Akter", "Islam", "Rahman", "Chowdhury", "Begum", "Hossain", "Khatun",
  "Ahmed", "Sultana", "Mia", "Parvin", "Alam", "Jahan", "Kabir", "Nahar",
] as const;

/** Weighted so the list reflects Bangladesh's real group distribution. */
function sampleGroup(): BloodGroup {
  const roll = rng();
  let cursor = 0;
  const weights = [0.32, 0.3, 0.22, 0.08, 0.035, 0.022, 0.018, 0.005];
  for (let i = 0; i < GROUP_PREVALENCE_BD.length; i += 1) {
    cursor += weights[i] ?? 0;
    if (roll <= cursor) return GROUP_PREVALENCE_BD[i]!;
  }
  return GROUP_PREVALENCE_BD[0]!;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * One synthetic donor. Note the shape: this produces a `DonorCard`, which is a
 * projection — there is deliberately no `phone` or `nid` field on it, because
 * the real RPC never returns one either.
 */
function makeDonor(index: number): DonorCard & { _raw_name: string; _phone: string; _lat: number; _lng: number } {
  const upazila = pick(DEMO_UPAZILAS);
  const first = pick(GIVEN_NAMES);
  const last = pick(SURNAMES);
  const fullName = `${first} ${last}`;
  const group = sampleGroup();
  const lastDonation = rng() < 0.55 ? daysAgoISO(between(20, 400)) : null;

  const availableNow = rng() < 0.62;
  const verified = rng() < 0.7;
  const metres = between(200, 24_000);

  const warningCount = rng() < 0.18 ? 1 : 0;
  const donated = between(0, 4);
  const declined = between(0, 2);

  const score = scoreDonor(
    {
      metres,
      availableNow,
      verified,
      donatedCount12mo: donated,
      declinedCount12mo: declined,
      lastDonationDate: lastDonation,
      warningCount,
    },
    new Date().toISOString().slice(0, 10)
  );

  const band = (() => {
    if (metres < 1_000) return "under_1km" as const;
    if (metres < 3_000) return "1_3km" as const;
    if (metres < 10_000) return "3_10km" as const;
    if (metres < 25_000) return "10_25km" as const;
    return "25_50km" as const;
  })();

  const warnings: string[] = warningCount
    ? [pick(["smoker", "on_medication", "chronic_condition"] as const)]
    : [];

  return {
    donor_id: `demo-donor-${index}`,
    display_name: maskName(fullName),
    blood_group: group,
    blood_group_verified: verified,
    distance_band: band,
    distance_km: Math.round(metres / 100) / 10,
    upazila_en: upazila.name_en,
    upazila_bn: upazila.name_bn,
    district_en: upazila.district_en,
    district_bn: upazila.district_bn,
    ring: metres < 3_000 ? 0 : metres < 10_000 ? 1 : metres < 25_000 ? 2 : 3,
    available_now: availableNow,
    can_give_now: availableNow && warningCount === 0,
    soft_warnings: warnings,
    last_donation_band: lastDonation === null ? "never" : "long_ago",
    score,
    contact_mode: rng() < 0.85 ? "on_unlock" : "private_admin",
    _raw_name: fullName,
    _phone: `+8801${between(3, 9)}${String(between(10_000_000, 99_999_999))}`,
    _lat: upazila.lat,
    _lng: upazila.lng,
  };
}

export const DEMO_DONORS: readonly (DonorCard & { _raw_name: string; _phone: string; _lat: number; _lng: number })[] =
  Array.from({ length: 96 }, (_, i) => makeDonor(i));

/* -------------------------------------------------------------------------- */
/* Emergency requests near the user                                            */
/* -------------------------------------------------------------------------- */

const HOSPITALS = [
  { en: "Dhaka Medical College Hospital", bn: "ঢাকা মেডিকেল কলেজ হাসপাতাল" },
  { en: "Square Hospital", bn: "স্কয়ার হাসপাতাল" },
  { en: "Evercare Hospital", bn: "এভারকেয়ার হাসপাতাল" },
  { en: "Chattogram Medical College", bn: "চট্টগ্রাম মেডিকেল কলেজ" },
  { en: "Rajshahi Medical College", bn: "রাজশাহী মেডিকেল কলেজ" },
  { en: "Sylhet MAG Osmani Medical", bn: "সিলেট এমএজি ওসমানী মেডিকেল" },
  { en: "Khulna Medical College", bn: "খুলনা মেডিকেল কলেজ" },
  { en: "Kurmitola General Hospital", bn: "কুর্মিটোলা জেনারেল হাসপাতাল" },
] as const;

function makeEmergency(index: number): EmergencyFeedItem {
  const upazila = pick(DEMO_UPAZILAS);
  const hospital = pick(HOSPITALS);
  const urgency = pick(["critical", "urgent", "urgent", "routine"] as RequestUrgency[]);
  const createdMinutesAgo = between(4, 60 * 20);
  const created = new Date(Date.now() - createdMinutesAgo * 60_000);
  const group = sampleGroup();
  const units = between(1, 3);
  const confirmed = rng() < 0.4 ? between(1, units) : 0;

  return {
    id: `demo-req-${index}`,
    blood_group_needed: group,
    component: pick(["whole_blood", "whole_blood", "prbc", "platelets"] as BloodComponent[]),
    units_needed: units,
    units_confirmed: confirmed,
    urgency,
    status: confirmed > 0 ? "matching" : "open",
    hospital_name: hospital.en,
    needed_by: daysAgoISO(-between(0, 3)),
    created_at: created.toISOString(),
    expires_at: expiresAtISO(urgency, created),
    escalation_ring: between(0, Math.min(3, maxRingFor(urgency))),
    upazila_en: upazila.name_en,
    upazila_bn: upazila.name_bn,
    district_en: upazila.district_en,
    district_bn: upazila.district_bn,
    distance_band: pick(["under_1km", "1_3km", "3_10km", "10_25km"] as const),
  };
}

export const DEMO_EMERGENCIES: readonly EmergencyFeedItem[] = Array.from({ length: 7 }, (_, i) =>
  makeEmergency(i)
);

/** The hospital name in Bengali, for the bilingual feed. */
export function hospitalBn(nameEn: string | null): string | null {
  if (!nameEn) return null;
  return HOSPITALS.find((h) => h.en === nameEn)?.bn ?? null;
}

/* -------------------------------------------------------------------------- */
/* Doctors                                                                     */
/* -------------------------------------------------------------------------- */

const SPECIALTIES = [
  { id: 1, slug: "medicine", en: "General Medicine", bn: "মেডিসিন" },
  { id: 2, slug: "pediatrics", en: "Paediatrics", bn: "শিশু রোগ" },
  { id: 3, slug: "gynaecology", en: "Gynaecology & Obstetrics", bn: "স্ত্রীরোগ ও প্রসূতি" },
  { id: 4, slug: "cardiology", en: "Cardiology", bn: "হৃদরোগ" },
  { id: 5, slug: "dermatology", en: "Dermatology", bn: "চর্মরোগ" },
  { id: 6, slug: "orthopaedics", en: "Orthopaedics", bn: "অর্থোপেডিক" },
  { id: 7, slug: "ent", en: "ENT", bn: "নাক-কান-গলা" },
  { id: 8, slug: "ophthalmology", en: "Ophthalmology", bn: "চোখ" },
  { id: 9, slug: "psychiatry", en: "Psychiatry", bn: "মানসিক রোগ" },
  { id: 10, slug: "hematology", en: "Hematology & Blood Disorders", bn: "হেমাটোলজি ও রক্তরোগ" },
] as const;

export const DEMO_SPECIALTIES = SPECIALTIES;

const DEGREES = ["MBBS", "MBBS, FCPS", "MBBS, MD", "MBBS, MS", "MBBS, FCPS, MD"] as const;

function makeDoctor(index: number): DoctorCard & { _phone: string; phone: string } {
  const upazila = pick(DEMO_UPAZILAS);
  const specialty = pick(SPECIALTIES);
  const first = pick(GIVEN_NAMES);
  const last = pick(SURNAMES);
  const fullName = `Dr. ${first} ${last}`;
  const degrees = pick(DEGREES);
  const fee = 0; // Government health service: 100% free
  const verified = rng() < 0.82;
  const phone = `+8801${between(3, 9)}${String(between(10_000_000, 99_999_999))}`;

  return {
    user_id: `demo-doctor-${index}`,
    display_name: fullName,
    full_name: fullName,
    avatar_url: null,
    bmdc_reg_no: verified ? `BMDC-${between(10000, 99999)}` : null,
    degrees,
    experience_years: between(3, 28),
    consult_fee: fee,
    languages: rng() < 0.9 ? ["bn", "en"] : ["bn"],
    bio:
      rng() < 0.6
        ? "নিয়মিত চেম্বারে রোগী দেখি। জটিল রোগে দ্রুত পরামর্শ দিতে প্রস্তুত।"
        : null,
    rating_avg: Math.round(between(38, 50)) / 10,
    rating_count: between(3, 240),
    follow_up_free_days: pick([0, 3, 7]),
    specialty_id: specialty.id,
    specialty_slug: specialty.slug,
    specialty_en: specialty.en,
    specialty_bn: specialty.bn,
    upazila_en: upazila.name_en,
    upazila_bn: upazila.name_bn,
    district_en: upazila.district_en,
    district_bn: upazila.district_bn,
    division_en: upazila.division_en,
    division_bn: upazila.division_bn,
    practice_address: `${upazila.name_en}, ${upazila.district_en}`,
    distance_km: Math.round(between(300, 40_000) / 100) / 10,
    _phone: phone,
    phone,
  };
}

/** Featured verified specialist doctors with BMDC credentials. */
export const FEATURED_DOCTORS: readonly (DoctorCard & { _phone: string; phone: string })[] = [
  {
    user_id: "demo-doctor-0",
    display_name: "Dr. M. A. Rahman",
    full_name: "Dr. M. A. Rahman",
    avatar_url: null,
    bmdc_reg_no: "BMDC-A-88101",
    degrees: "MBBS, FCPS, MD (Cardiology)",
    experience_years: 18,
    consult_fee: 0,
    languages: ["bn", "en"],
    bio: "জাতীয় হৃদরোগ ইনস্টিটিউটের জ্যেষ্ঠ হৃদরোগ বিশেষজ্ঞ। হৃদরোগ প্রতিরোধ, উচ্চ রক্তচাপ ও কার্ডিয়াক পরামর্শ।",
    rating_avg: 4.9,
    rating_count: 184,
    follow_up_free_days: 7,
    specialty_id: 4,
    specialty_slug: "cardiology",
    specialty_en: "Cardiology",
    specialty_bn: "হৃদরোগ",
    upazila_en: "Dhanmondi",
    upazila_bn: "ধানমন্ডি",
    district_en: "Dhaka",
    district_bn: "ঢাকা",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    practice_address: "National Institute of Cardiovascular Diseases (NICVD), Sher-e-Bangla Nagar, Dhaka",
    distance_km: 1.2,
    _phone: "01711990001",
    phone: "01711990001",
  },
  {
    user_id: "demo-doctor-1",
    display_name: "Dr. Fatima Begum",
    full_name: "Dr. Fatima Begum",
    avatar_url: null,
    bmdc_reg_no: "BMDC-A-88102",
    degrees: "MBBS, DCH, FCPS (Pediatrics)",
    experience_years: 15,
    consult_fee: 0,
    languages: ["bn", "en"],
    bio: "শিশু বিশেষজ্ঞ, ঢাকা শিশু হাসপাতাল। নবজাতক ও শিশুদের রোগ প্রতিরোধ ও চিকিৎসায় অভিজ্ঞ।",
    rating_avg: 4.9,
    rating_count: 162,
    follow_up_free_days: 7,
    specialty_id: 2,
    specialty_slug: "pediatrics",
    specialty_en: "Paediatrics",
    specialty_bn: "শিশু রোগ",
    upazila_en: "Mirpur",
    upazila_bn: "মিরপুর",
    district_en: "Dhaka",
    district_bn: "ঢাকা",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    practice_address: "Dhaka Shishu Hospital, Sher-e-Bangla Nagar, Dhaka",
    distance_km: 2.1,
    _phone: "01711990002",
    phone: "01711990002",
  },
  {
    user_id: "demo-doctor-2",
    display_name: "Dr. Anwar Hossain",
    full_name: "Dr. Anwar Hossain",
    avatar_url: null,
    bmdc_reg_no: "BMDC-A-88103",
    degrees: "MBBS, FCPS (Medicine), MACP",
    experience_years: 20,
    consult_fee: 0,
    languages: ["bn", "en"],
    bio: "মেডিসিন ও ডেঙ্গু বিশেষজ্ঞ, ঢাকা মেডিকেল কলেজ হাসপাতাল। ডেঙ্গু জ্বর ও সংক্রামক ব্যাধি ব্যবস্থাপনায় অভিজ্ঞ।",
    rating_avg: 4.8,
    rating_count: 215,
    follow_up_free_days: 7,
    specialty_id: 1,
    specialty_slug: "medicine",
    specialty_en: "Internal Medicine & Dengue",
    specialty_bn: "মেডিসিন ও ডেঙ্গু",
    upazila_en: "Dhanmondi",
    upazila_bn: "ধানমন্ডি",
    district_en: "Dhaka",
    district_bn: "ঢাকা",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    practice_address: "Dhaka Medical College Hospital (DMCH), Dhaka",
    distance_km: 1.8,
    _phone: "01711990003",
    phone: "01711990003",
  },
  {
    user_id: "demo-doctor-3",
    display_name: "Dr. Taslima Akter",
    full_name: "Dr. Taslima Akter",
    avatar_url: null,
    bmdc_reg_no: "BMDC-A-88104",
    degrees: "MBBS, MS (Gynae & Obs), FCPS",
    experience_years: 16,
    consult_fee: 0,
    languages: ["bn", "en"],
    bio: "স্ত্রীরোগ ও প্রসূতি বিশেষজ্ঞ, মিটফোর্ড হাসপাতাল। নিরাপদ মাতৃত্ব ও জটিল প্রসব ব্যবস্থাপনায় অভিজ্ঞ।",
    rating_avg: 4.9,
    rating_count: 147,
    follow_up_free_days: 7,
    specialty_id: 3,
    specialty_slug: "gynaecology",
    specialty_en: "Gynaecology & Obstetrics",
    specialty_bn: "স্ত্রীরোগ ও প্রসূতি",
    upazila_en: "Keraniganj",
    upazila_bn: "কেরানীগঞ্জ",
    district_en: "Dhaka",
    district_bn: "ঢাকা",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    practice_address: "Sir Salimullah Medical College & Mitford Hospital, Dhaka",
    distance_km: 2.8,
    _phone: "01711990004",
    phone: "01711990004",
  },
  {
    user_id: "demo-doctor-4",
    display_name: "Dr. Kamal Uddin",
    full_name: "Dr. Kamal Uddin",
    avatar_url: null,
    bmdc_reg_no: "BMDC-A-88105",
    degrees: "MBBS, FCPS (Hematology), MD",
    experience_years: 22,
    consult_fee: 0,
    languages: ["bn", "en"],
    bio: "রক্তরোগ বিশেষজ্ঞ, বিএসএমএমইউ। থ্যালাসেমিয়া ও জটিল রক্তরোগের চিকিৎসায় অভিজ্ঞ।",
    rating_avg: 5.0,
    rating_count: 198,
    follow_up_free_days: 7,
    specialty_id: 10,
    specialty_slug: "hematology",
    specialty_en: "Hematology & Blood Disorders",
    specialty_bn: "হেমাটোলজি ও রক্তরোগ",
    upazila_en: "Dhanmondi",
    upazila_bn: "ধানমন্ডি",
    district_en: "Dhaka",
    district_bn: "ঢাকা",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    practice_address: "Bangabandhu Sheikh Mujib Medical University (BSMMU), Shahbag, Dhaka",
    distance_km: 0.9,
    _phone: "01711990005",
    phone: "01711990005",
  },
];

export const DEMO_DOCTORS: readonly (DoctorCard & { _phone: string; phone?: string })[] = [
  ...FEATURED_DOCTORS,
  ...Array.from({ length: 37 }, (_, i) => makeDoctor(i + 5)),
];

/* -------------------------------------------------------------------------- */
/* Articles                                                                    */
/* -------------------------------------------------------------------------- */

const ARTICLE_SEEDS = [
  {
    slug: "dengue-warning-signs",
    title: "7 Dengue Warning Signs You Must Not Ignore",
    title_bn: "ডেঙ্গুর ৭টি বিপদ চিহ্ন যা অবহেলা করা যাবে না",
    excerpt: "Most dengue cases recover with fluids and rest. These are the signs that mean it is time to go to a hospital tonight.",
    excerpt_bn: "বেশিরভাগ ডেঙ্গু রোগী তরল ও বিশ্রামে সেরে ওঠেন। এই চিহ্নগুলো দেখা দিলে আজই হাসপাতালে যান।",
    tags: ["dengue", "emergency"],
  },
  {
    slug: "thalassaemia-blood-need",
    title: "Living with Thalassaemia: Why Regular Transfusion Matters",
    title_bn: "থ্যালাসেমিয়া নিয়ে বেঁচে থাকা: নিয়মিত রক্ত সঞ্চালন কেন জরুরি",
    excerpt: "For a child with thalassaemia, a missed transfusion is not an inconvenience — it is a medical event.",
    excerpt_bn: "থ্যালাসেমিয়া আক্রান্ত শিশুর জন্য একটি রক্ত সঞ্চালন মিস হওয়া মানে জটিলতা।",
    tags: ["thalassaemia", "blood"],
  },
  {
    slug: "who-can-donate-blood",
    title: "Who Can and Cannot Donate Blood",
    title_bn: "কে রক্ত দিতে পারবেন, কে পারবেন না",
    excerpt: "Age, weight, and the 90-day rule — explained plainly, without the clinical fog.",
    excerpt_bn: "বয়স, ওজন ও ৯০ দিনের নিয়ম — সহজ ভাষায়।",
    tags: ["donation", "eligibility"],
  },
  {
    slug: "hypertension-basics",
    title: "High Blood Pressure: The Quiet Condition",
    title_bn: "উচ্চ রক্তচাপ: নীরব একটি রোগ",
    excerpt: "Hypertension rarely announces itself. Here is what to measure, how often, and when to worry.",
    excerpt_bn: "উচ্চ রক্তচাপ সাধারণত কোনো লক্ষণ দেখায় না। কী মাপবেন, কতবার, আর কখন চিন্তা করবেন।",
    tags: ["cardiology", "prevention"],
  },
  {
    slug: "child-fever-guide",
    title: "A Parent's Guide to a Child's Fever",
    title_bn: "শিশুর জ্বর: বাবা-মায়ের জন্য নির্দেশিকা",
    excerpt: "When a fever is a normal immune response, and when it needs a doctor within the hour.",
    excerpt_bn: "কখন জ্বর স্বাভাবিক, আর কখন এক ঘণ্টার মধ্যে ডাক্তারের দরকার।",
    tags: ["pediatrics", "fever"],
  },
  {
    slug: "pregnancy-danger-signs",
    title: "Danger Signs in Pregnancy",
    title_bn: "গর্ভাবস্থায় বিপদ চিহ্ন",
    excerpt: "Bleeding, severe headache, blurred vision — the signs that mean go now, not tomorrow.",
    excerpt_bn: "রক্তক্ষরণ, তীব্র মাথাব্যথা, ঝাপসা দৃষ্টি — যেসব চিহ্নে আজই যেতে হবে।",
    tags: ["gynaecology", "maternal"],
  },
] as const;

const ARTICLE_DOC_DETAILS = [
  {
    name: "Dr. Anwar Hossain",
    degrees: "MBBS, FCPS",
    bmdc: "BMDC-A-88103",
    specialty_en: "Internal Medicine & Dengue",
    specialty_bn: "মেডিসিন ও ডেঙ্গু বিশেষজ্ঞ",
    specialty_slug: "medicine",
  },
  {
    name: "Dr. Kamal Uddin",
    degrees: "MBBS, MD (Hematology)",
    bmdc: "BMDC-A-88105",
    specialty_en: "Hematology & Blood Disorders",
    specialty_bn: "রক্তরোগ বিশেষজ্ঞ",
    specialty_slug: "blood",
  },
  {
    name: "Dr. Kamal Uddin",
    degrees: "MBBS, MD (Hematology)",
    bmdc: "BMDC-A-88105",
    specialty_en: "Hematology & Blood Disorders",
    specialty_bn: "রক্তরোগ বিশেষজ্ঞ",
    specialty_slug: "blood",
  },
  {
    name: "Dr. M. A. Rahman",
    degrees: "MBBS, FCPS, MD",
    bmdc: "BMDC-A-88101",
    specialty_en: "Cardiology",
    specialty_bn: "হৃদরোগ বিশেষজ্ঞ",
    specialty_slug: "cardiology",
  },
  {
    name: "Dr. Fatima Begum",
    degrees: "MBBS, DCH, FCPS",
    bmdc: "BMDC-A-88102",
    specialty_en: "Paediatrics",
    specialty_bn: "শিশু রোগ বিশেষজ্ঞ",
    specialty_slug: "pediatrics",
  },
  {
    name: "Dr. Taslima Akter",
    degrees: "MBBS, FCPS, MS",
    bmdc: "BMDC-A-88104",
    specialty_en: "Gynaecology & Obstetrics",
    specialty_bn: "স্ত্রী ও প্রসূতি রোগ বিশেষজ্ঞ",
    specialty_slug: "gynaecology",
  },
];

export const DEMO_ARTICLES: readonly ArticleFeedItem[] = ARTICLE_SEEDS.map((seed, i) => {
  const author = DEMO_DOCTORS[i % DEMO_DOCTORS.length]!;
  const docMeta = ARTICLE_DOC_DETAILS[i % ARTICLE_DOC_DETAILS.length]!;
  const publishedAt = new Date(Date.now() - between(1, 45) * 86_400_000).toISOString();
  return {
    id: `demo-article-${i}`,
    slug: seed.slug,
    title: seed.title,
    title_bn: seed.title_bn,
    excerpt: seed.excerpt,
    excerpt_bn: seed.excerpt_bn,
    cover_image_path: `https://picsum.photos/seed/${seed.tags[0]}/1200/800`,
    tags: [...seed.tags],
    published_at: publishedAt,
    view_count: between(120, 9400),
    flagged_review: false,
    author_id: author.user_id,
    author_name: docMeta.name ?? author.full_name,
    author_avatar: null,
    author_degrees: docMeta.degrees ?? author.degrees,
    author_bmdc: docMeta.bmdc,
    bmdc_reg_no: docMeta.bmdc,
    specialty_en: docMeta.specialty_en ?? author.specialty_en,
    specialty_bn: docMeta.specialty_bn ?? author.specialty_bn,
    specialty_slug: docMeta.specialty_slug ?? author.specialty_slug,
    reaction_count: between(2, 380),
  };
});

export interface DemoArticleBody extends ArticleFeedItem {
  body_en: string;
  body_bn: string;
}

/** Full bodies, for the article detail route. Kept short but real. */
export const DEMO_ARTICLE_BODIES: Record<string, { body_en: string; body_bn: string }> = {
  "dengue-warning-signs": {
    body_en:
      "Dengue usually begins with a sudden high fever, a severe headache behind the eyes, and pain in the joints that people describe as breaking-bone pain. Most patients recover within a week with paracetamol, fluids, and rest.\n\nThe danger window is not the fever itself but the 24 to 48 hours after it starts to fall. Watch for:\n\nSevere abdominal pain, persistent vomiting, bleeding gums or nose, blood in vomit or stool, fatigue and restlessness, cold clammy skin, and a rapid drop in temperature.\n\nDo not take ibuprofen, aspirin, or any other NSAID — they raise the risk of bleeding. Paracetamol only. Go to a hospital tonight, not tomorrow, if any of the signs above appear.",
    body_bn:
      "ডেঙ্গু সাধারণত হঠাৎ উচ্চ জ্বর, চোখের পেছনে তীব্র মাথাব্যথা এবং জয়েন্টে ব্যথা দিয়ে শুরু হয়। বেশিরভাগ রোগী প্যারাসিটামল, তরল ও বিশ্রামে এক সপ্তাহে সেরে ওঠেন।\n\nবিপদের সময় জ্বর নয় — জ্বর কমতে শুরু করার পরের ২৪–৪৮ ঘণ্টা। যেসব লক্ষণ দেখলে সতর্ক হবেন:\n\nতীব্র পেটব্যথা, বারবার বমি, মাড়ি বা নাক থেকে রক্তপাত, বমি বা পায়খানায় রক্ত, ক্লান্তি ও অস্থিরতা, ঠান্ডা ঘাম, এবং তাপমাত্রা হঠাৎ কমে যাওয়া।\n\nআইবুপ্রোফেন, অ্যাসপিরিন বা এ ধরনের ওষুধ খাবেন না — এতে রক্তপাতের ঝুঁকি বাড়ে। শুধু প্যারাসিটামল। উপরের কোনো লক্ষণ দেখা দিলে আজই হাসপাতালে যান, কাল নয়।",
  },
};

/** Three blood banks, as the right rail renders them. */
export const DEMO_BLOOD_BANKS = [
  { id: "bb-1", name_en: "Sandhani Blood Bank", name_bn: "সন্ধানী ব্লাড ব্যাংক", distance_km: 1.8, open_now: true, stocks: { "A+": 6, "B+": 9, "O+": 11, "AB+": 2, "O-": 1 } },
  { id: "bb-2", name_en: "Red Crescent Blood Centre", name_bn: "রেড ক্রিসেন্ট ব্লাড সেন্টার", distance_km: 4.2, open_now: true, stocks: { "A+": 4, "B+": 3, "O+": 7, "A-": 2 } },
  { id: "bb-3", name_en: "Quantum Blood Bank", name_bn: "কোয়ান্টাম ব্লাড ব্যাংক", distance_km: 9.6, open_now: false, stocks: { "B+": 5, "O+": 2, "AB-": 1 } },
] as const;

/* -------------------------------------------------------------------------- */
/* Aggregate counts for the hero                                               */
/* -------------------------------------------------------------------------- */

export const DEMO_STATS = {
  donors: 12_480,
  doctors: 1_036,
  upazilas: 495,
  responses: 38_912,
};

/** Masked contact for the demo "unlock" flow — never a real number. */
export function demoMaskedPhone(phone: string): string {
  return maskPhone(phone);
}

export const DEMO_BADGE = groupBadge;
export const DEMO_ACCEPTABLE = acceptableDonorsFor;

/* -------------------------------------------------------------------------- */
/* National Health Advisories & Updates                                       */
/* -------------------------------------------------------------------------- */

export const DEMO_UPDATES: readonly NationalHealthUpdate[] = [
  {
    id: "demo-upd-dengue",
    title: "National Dengue Call-to-Action & Mosquito Prevention",
    title_bn: "জাতীয় ডেঙ্গু সতর্কতা ও মশক নিধন সপ্তাহ",
    body: "Environmental control and source reduction week across all 64 districts. Destroy Aedes breeding grounds in flower pots, roofs, and containers. Seek medical advice immediately if fever lasts over 48 hours or warning signs appear.",
    body_bn: "দেশব্যাপী ৬৪ জেলায় এডিস মশা নিধন ও পরিচ্ছন্নতা অভিযান চলছে। ফুলের টব, ছাদ ও প্লাস্টিকের পাত্রে জমে থাকা পানি অবিলম্বে পরিষ্কার করুন। ২ দিনের বেশি তীব্র জ্বর বা বিপদচিহ্ন দেখা দিলে নিকটস্থ হাসপাতালে যান।",
    kind: "alert",
    source: "DGHS",
    effective_from: new Date(Date.now() - 3_600_000).toISOString(),
    expires_at: null,
  },
  {
    id: "demo-upd-nipah",
    title: "Nipah Virus Alert: Avoid Raw Date Palm Sap",
    title_bn: "নিপাহ ভাইরাস সতর্কতা: কাঁচা খেজুরের রস পান করবেন না",
    body: "Do not drink raw date palm sap (কাঁচা খেজুরের রস) or eat bird-bitten fruits. Nipah is a high-fatality zoonotic virus transmitted by fruit bats. Always boil palm juice thoroughly (70°C+) before consuming.",
    body_bn: "কোনো অবস্থাতেই কাঁচা খেজুরের রস এবং বাদুড় বা পাখির খাওয়া আংশিক ফল খাবেন না। নিপাহ একটি প্রাণঘাতী ভাইরাস যা বাদুড়ের লালা ও মলমূত্র থেকে ছড়ায়। রস ফুটিয়ে বা গুড় তৈরি করে খেলে ঝুঁকি থাকে না।",
    kind: "alert",
    source: "IEDCR",
    effective_from: new Date(Date.now() - 86_400_000).toISOString(),
    expires_at: null,
  },
  {
    id: "demo-upd-epi",
    title: "EPI Routine Child Immunization Drive Nationwide",
    title_bn: "ইপিআই নিয়মিত টিকাদান কর্মসূচি ও সুরক্ষা সপ্তাহ",
    body: "Routine immunisation sessions for infants and mothers continue at all Upazila Health Complexes, Union Sub-Centres, and Ward EPI clinics. Ensure on-schedule vaccinations against measles, polio, and hepatitis B.",
    body_bn: "সব উপজেলা স্বাস্থ্য কমপ্লেক্স, ইউনিয়ন উপস্বাস্থ্য কেন্দ্র ও ওয়ার্ড টিকাদান কেন্দ্রে শিশুদের ১০টি মারাত্মক রোগের প্রতিরোধে নিয়মিত টিকাদান সেশন চালু আছে। নির্ধারিত সময়ে আপনার শিশুকে বিনামূল্যে টিকা দিন।",
    kind: "notice",
    source: "EPI / DGHS",
    effective_from: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    expires_at: null,
  },
  {
    id: "demo-upd-heatwave",
    title: "Severe Heatwave & Heatstroke Warning for Outdoor Workers",
    title_bn: "তীব্র তাপপ্রবাহ ও হিটস্ট্রোক সতর্কতা — জরুরি স্বাস্থ্য পরামর্শ",
    body: "Extreme heatwave warning in effect. Outdoor workers and elderly citizens must avoid midday sun (11am-3pm), drink safe water and oral rehydration solution (ORS) hourly, and rest in shaded areas.",
    body_bn: "তীব্র তাপপ্রবাহের কারণে পানিশূন্যতা ও হিটস্ট্রোকের ঝুঁকি বৃদ্ধি পেয়েছে। দুপুর ১১টা থেকে বিকেল ৩টা পর্যন্ত তীব্র রোদ এড়িয়ে চলুন, প্রতি ঘণ্টায় বিশুদ্ধ পানি বা খাবার স্যালাইন পান করুন এবং ছায়াযুক্ত স্থানে বিশ্রাম নিন।",
    kind: "alert",
    source: "BMD & DGHS",
    effective_from: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    expires_at: null,
  },
  {
    id: "demo-upd-water",
    title: "Safe Drinking Water & Waterborne Disease Prevention Campaign",
    title_bn: "নিরাপদ খাবার পানি ও ডায়রিয়া-কলেরা প্রতিরোধ প্রচারণা",
    body: "Boil drinking water for at least 30 minutes or treat with chlorine purification tablets. Wash hands with soap before meals and after sanitation to prevent cholera, typhoid, and acute watery diarrhea.",
    body_bn: "পানিবাহিত রোগ, ডায়রিয়া ও কলেরা প্রতিরোধে খাওয়ার পানি অন্তত ৩০ মিনিট ফুটিয়ে অথবা ক্লোরিন ট্যাবলেট দিয়ে বিশুদ্ধ করে পান করুন। খাবার তৈরির পূর্বে এবং শৌচাগার ব্যবহারের পর সাবান দিয়ে হাত ধোয়ার অভ্যাস করুন।",
    kind: "campaign",
    source: "icddr,b & DGHS",
    effective_from: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    expires_at: null,
  },
];


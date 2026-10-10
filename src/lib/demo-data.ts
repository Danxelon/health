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
import { expiresAtISO, URGENCY_META } from "@/domain/requests.ts";
import { maskName, maskPhone } from "@/domain/profile.ts";
import type {
  ArticleFeedItem,
  BloodComponent,
  BloodGroup,
  DoctorCard,
  DonorCard,
  EmergencyFeedItem,
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
] as const;

export const DEMO_SPECIALTIES = SPECIALTIES;

const DEGREES = ["MBBS", "MBBS, FCPS", "MBBS, MD", "MBBS, MS", "MBBS, FCPS, MD"] as const;

function makeDoctor(index: number): DoctorCard & { _phone: string } {
  const upazila = pick(DEMO_UPAZILAS);
  const specialty = pick(SPECIALTIES);
  const first = pick(GIVEN_NAMES);
  const last = pick(SURNAMES);
  const fullName = `Dr. ${first} ${last}`;
  const degrees = pick(DEGREES);
  const fee = pick([0, 300, 500, 500, 800, 1000]);
  const verified = rng() < 0.82;

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
    _phone: `+8801${between(3, 9)}${String(between(10_000_000, 99_999_999))}`,
  };
}

export const DEMO_DOCTORS: readonly (DoctorCard & { _phone: string })[] = Array.from(
  { length: 42 },
  (_, i) => makeDoctor(i)
);

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

export const DEMO_ARTICLES: readonly ArticleFeedItem[] = ARTICLE_SEEDS.map((seed, i) => {
  const author = DEMO_DOCTORS[i % DEMO_DOCTORS.length]!;
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
    author_name: author.full_name,
    author_avatar: null,
    author_degrees: author.degrees,
    specialty_en: author.specialty_en,
    specialty_bn: author.specialty_bn,
    specialty_slug: author.specialty_slug,
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

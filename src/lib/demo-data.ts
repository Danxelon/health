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

import { acceptableDonorsFor, groupBadge, GROUP_PREVALENCE_BD } from "../domain/blood.ts";
import { maxRingFor, scoreDonor } from "../domain/matching.ts";
import { expiresAtISO } from "../domain/requests.ts";
import { maskName, maskNameBn, maskPhone } from "../domain/profile.ts";
import { ageInYears } from "../domain/eligibility.ts";
import type {
  ArticleFeedItem,
  BloodComponent,
  BloodGroup,
  DoctorCard,
  DonorCard,
  EmergencyFeedItem,
  NationalHealthUpdate,
  RequestUrgency,
  Specialty,
} from "../domain/types.ts";
import { BD_UPAZILAS } from "./geo-bd.ts";

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
/* National geography — full cascade                                         */
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
 * Full national geography: 8 divisions, 64 districts, 494 upazilas with
 * bilingual names (see `@/lib/geo-bd.ts` for the source dataset and
 * attribution). The `DEMO_` name is kept so every picker, cascade, and the
 * demo donor/doctor generators automatically cover the whole country with
 * zero call-site changes.
 */
export const DEMO_UPAZILAS: readonly DemoUpazila[] = BD_UPAZILAS;

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
export const DEFAULT_ORIGIN = { lat: 23.8103, lng: 90.4125, upazila_id: 149 };

/* -------------------------------------------------------------------------- */
/* Donors                                                                      */
/* -------------------------------------------------------------------------- */

interface BilingualNamePart {
  readonly en: string;
  readonly bn: string;
}

const MALE_FIRST_NAMES: readonly BilingualNamePart[] = [
  { en: "Mohammad", bn: "মোহাম্মদ" },
  { en: "Tanvir", bn: "তানভীর" },
  { en: "Rakibul", bn: "রাকিবুল" },
  { en: "Arif", bn: "আরিফ" },
  { en: "Mahmud", bn: "মাহমুদ" },
  { en: "Sabbir", bn: "সাব্বির" },
  { en: "Imran", bn: "ইমরান" },
  { en: "Jahid", bn: "জাহিদ" },
  { en: "Nayeem", bn: "নাঈম" },
  { en: "Rashed", bn: "রাশেদ" },
  { en: "Kamrul", bn: "কামরুল" },
  { en: "Faisal", bn: "ফয়সাল" },
  { en: "Shakil", bn: "শাকিল" },
  { en: "Mizanur", bn: "মিজানুর" },
  { en: "Hasib", bn: "হাসিব" },
  { en: "Kazi", bn: "কাজী" },
  { en: "Tariqul", bn: "তারিকুল" },
  { en: "Ashraful", bn: "আশরাফুল" },
  { en: "Shahidul", bn: "শহীদুল" },
  { en: "Ziaur", bn: "জিয়াউর" },
  { en: "Monirul", bn: "মনিরুল" },
  { en: "Habibur", bn: "হাবিবুর" },
];

const MALE_MIDDLE_NAMES: readonly BilingualNamePart[] = [
  { en: "Hasan", bn: "হাসান" },
  { en: "Hossain", bn: "হোসেন" },
  { en: "Abdur", bn: "আবদুর" },
  { en: "Anwar", bn: "আনোয়ার" },
  { en: "Kamal", bn: "কামাল" },
  { en: "Jahangir", bn: "জাহাঙ্গীর" },
  { en: "Ashraf", bn: "আশরাফ" },
  { en: "Monir", bn: "মনির" },
  { en: "Tariq", bn: "তারিক" },
  { en: "Zia", bn: "জিয়া" },
  { en: "Nasir", bn: "নাসির" },
  { en: "Sadek", bn: "সাদেক" },
  { en: "Habib", bn: "হাবিব" },
  { en: "Enam", bn: "এনাম" },
  { en: "Mahbub", bn: "মাহবুব" },
  { en: "Shahid", bn: "শহীদ" },
  { en: "Faruk", bn: "ফারুক" },
  { en: "Salim", bn: "সেলিম" },
];

const MALE_LAST_NAMES: readonly BilingualNamePart[] = [
  { en: "Rahman", bn: "রহমান" },
  { en: "Chowdhury", bn: "চৌধুরী" },
  { en: "Ahmed", bn: "আহমেদ" },
  { en: "Islam", bn: "ইসলাম" },
  { en: "Uddin", bn: "উদ্দিন" },
  { en: "Alam", bn: "আলম" },
  { en: "Kabir", bn: "কবির" },
  { en: "Mia", bn: "মিয়া" },
  { en: "Khan", bn: "খান" },
  { en: "Haque", bn: "হক" },
  { en: "Sikder", bn: "সিকদার" },
  { en: "Talukder", bn: "তালুকদার" },
  { en: "Bhuiyan", bn: "ভূঁইয়া" },
  { en: "Sheikh", bn: "শেখ" },
];

const FEMALE_FIRST_NAMES: readonly BilingualNamePart[] = [
  { en: "Nusrat", bn: "নুসরাত" },
  { en: "Farhana", bn: "ফারহানা" },
  { en: "Sadia", bn: "সাদিয়া" },
  { en: "Rumana", bn: "রুমানা" },
  { en: "Sumaiya", bn: "সুমাইয়া" },
  { en: "Taslima", bn: "তাসলিমা" },
  { en: "Ayesha", bn: "আয়েশা" },
  { en: "Sharmin", bn: "শারমিন" },
  { en: "Rehana", bn: "রেহানা" },
  { en: "Nasrin", bn: "নাসরিন" },
  { en: "Jannatul", bn: "জান্নাতুল" },
  { en: "Mehjabin", bn: "মেহজাবিন" },
  { en: "Shathi", bn: "সাথী" },
  { en: "Lubna", bn: "লুবনা" },
  { en: "Syeda", bn: "সৈয়দা" },
  { en: "Sabina", bn: "সাবিনা" },
  { en: "Tahmina", bn: "তাহমিনা" },
  { en: "Nazma", bn: "নাজমা" },
  { en: "Dilruba", bn: "দিলরুবা" },
  { en: "Rokeya", bn: "রোকেয়া" },
];

const FEMALE_MIDDLE_NAMES: readonly BilingualNamePart[] = [
  { en: "Jahan", bn: "জাহান" },
  { en: "Akter", bn: "আক্তার" },
  { en: "Sultana", bn: "সুলতানা" },
  { en: "Parvin", bn: "পারভীন" },
  { en: "Fatima", bn: "ফাতেমা" },
  { en: "Begum", bn: "বেগম" },
  { en: "Ferdous", bn: "ফেরদৌস" },
  { en: "Yasmin", bn: "ইয়াসমিন" },
  { en: "Nahar", bn: "নাহার" },
  { en: "Khatun", bn: "খাতুন" },
  { en: "Nasrin", bn: "নাসরিন" },
  { en: "Sharmin", bn: "শারমিন" },
  { en: "Noor", bn: "নূর" },
  { en: "Ara", bn: "আরা" },
];

const FEMALE_LAST_NAMES: readonly BilingualNamePart[] = [
  { en: "Chowdhury", bn: "চৌধুরী" },
  { en: "Begum", bn: "বেগম" },
  { en: "Akter", bn: "আক্তার" },
  { en: "Khatun", bn: "খাতুন" },
  { en: "Sultana", bn: "সুলতানা" },
  { en: "Jahan", bn: "জাহান" },
  { en: "Nahar", bn: "নাহার" },
  { en: "Parvin", bn: "পারভীন" },
  { en: "Banu", bn: "বানু" },
  { en: "Ferdous", bn: "ফেরদৌস" },
  { en: "Khanom", bn: "খানম" },
  { en: "Ahmed", bn: "আহমেদ" },
  { en: "Rahman", bn: "রহমান" },
];

export function sample3WordName(isFemale: boolean): { en: string; bn: string } {
  if (isFemale) {
    const f = pick(FEMALE_FIRST_NAMES);
    let m = pick(FEMALE_MIDDLE_NAMES);
    while (m.en === f.en) {
      m = pick(FEMALE_MIDDLE_NAMES);
    }
    let l = pick(FEMALE_LAST_NAMES);
    while (l.en === m.en || l.en === f.en) {
      l = pick(FEMALE_LAST_NAMES);
    }
    return {
      en: `${f.en} ${m.en} ${l.en}`,
      bn: `${f.bn} ${m.bn} ${l.bn}`,
    };
  }
  const f = pick(MALE_FIRST_NAMES);
  let m = pick(MALE_MIDDLE_NAMES);
  while (m.en === f.en) {
    m = pick(MALE_MIDDLE_NAMES);
  }
  let l = pick(MALE_LAST_NAMES);
  while (l.en === m.en || l.en === f.en) {
    l = pick(MALE_LAST_NAMES);
  }
  return {
    en: `${f.en} ${m.en} ${l.en}`,
    bn: `${f.bn} ${m.bn} ${l.bn}`,
  };
}

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
function makeDonor(index: number): DonorCard & {
  _raw_name: string;
  _raw_name_bn: string;
  _phone: string;
  _lat: number;
  _lng: number;
  full_name: string;
  full_name_bn: string;
  display_name_bn: string;
  date_of_birth: string;
  age: number;
} {
  const upazila = pick(DEMO_UPAZILAS);
  const isFemale = rng() < 0.38;
  const name = sample3WordName(isFemale);
  const fullName = name.en;
  const fullNameBn = name.bn;
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

  const h = (index * 7 % 48) + 1;
  const r = (index * 3 % 18) + 1;
  const b = ["A", "B", "C", "D", "E", "F"][index % 6];
  const streetVariants = [
    { en: `House #${h}, Road #${r}, Block ${b}`, bn: `বাসা #${h}, রোড #${r}, ব্লক ${b}` },
    { en: `Holding #${h}, Sector #${r}`, bn: `হোল্ডিং #${h}, সেক্টর #${r}` },
    { en: `College Road, Ward #${r}`, bn: `কলেজ রোড, ${r} নং ওয়ার্ড` },
    { en: `Hospital Road, Holding #${h}`, bn: `হাসপাতাল রোড, হোল্ডিং #${h}` },
    { en: `Station Road, Near Rail Gate`, bn: `স্টেশন রোড, রেলগেটের কাছে` },
    { en: `Main Bazar Road, House #${h}`, bn: `মেইন বাজার রোড, বাসা #${h}` },
  ];
  const street = streetVariants[index % streetVariants.length]!;
  const addressEn = `${street.en}, ${upazila.name_en}, ${upazila.district_en}`;
  const addressBn = `${street.bn}, ${upazila.name_bn}, ${upazila.district_bn}`;
  const donorLat = Number((upazila.lat + (((index * 13) % 20) - 10) * 0.0015).toFixed(4));
  const donorLng = Number((upazila.lng + (((index * 17) % 20) - 10) * 0.0015).toFixed(4));

  const targetAge = between(19, 54);
  const birthYear = 2026 - targetAge;
  const birthMonth = String(between(1, 12)).padStart(2, "0");
  const birthDay = String(between(1, 28)).padStart(2, "0");
  const dob = `${birthYear}-${birthMonth}-${birthDay}`;
  const calculatedAge = ageInYears(dob, "2026-10-12") ?? targetAge;

  return {
    donor_id: `demo-donor-${index}`,
    display_name: maskName(fullName),
    display_name_bn: maskNameBn(fullNameBn, "রক্তদাতা"),
    full_name: fullName,
    full_name_bn: fullNameBn,
    date_of_birth: dob,
    age: calculatedAge,
    blood_group: group,
    blood_group_verified: verified,
    distance_band: band,
    distance_km: Math.round(metres / 100) / 10,
    upazila_en: upazila.name_en,
    upazila_bn: upazila.name_bn,
    district_en: upazila.district_en,
    district_bn: upazila.district_bn,
    division_en: upazila.division_en,
    division_bn: upazila.division_bn,
    address_en: addressEn,
    address_bn: addressBn,
    lat: donorLat,
    lng: donorLng,
    ring: metres < 3_000 ? 0 : metres < 10_000 ? 1 : metres < 25_000 ? 2 : 3,
    available_now: availableNow,
    can_give_now: availableNow && warningCount === 0,
    soft_warnings: warnings,
    last_donation_band: lastDonation === null ? "never" : "long_ago",
    score,
    contact_mode: rng() < 0.85 ? "on_unlock" : "private_admin",
    _raw_name: fullName,
    _raw_name_bn: fullNameBn,
    _phone: `+8801${between(3, 9)}${String(between(10_000_000, 99_999_999))}`,
    _lat: donorLat,
    _lng: donorLng,
  };
}

export const DEMO_DONORS: readonly (DonorCard & {
  _raw_name: string;
  _raw_name_bn: string;
  _phone: string;
  _lat: number;
  _lng: number;
  full_name: string;
  full_name_bn: string;
  display_name_bn: string;
  date_of_birth: string;
  age: number;
})[] = Array.from({ length: 96 }, (_, i) => makeDonor(i));

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

const SPECIALTIES: readonly Specialty[] = [
  {
    id: 1,
    slug: "medicine",
    en: "General Medicine",
    bn: "মেডিসিন",
    symptoms_bn: "জ্বর, সর্দি, কাশি, ডেঙ্গু, মাথা ব্যথা, পেটের সমস্যা, শারীরিক দুর্বলতা, সংক্রমণ",
    symptoms_en: "Fever, cold, cough, dengue, headache, stomach issues, physical weakness, infections",
    description_bn: "সাধারণ রোগব্যাধি, সংক্রামক ব্যাধি ও প্রাথমিক চিকিৎসার বিশেষজ্ঞ পরামর্শ ও সেবা।",
    description_en: "Diagnosis and treatment for common illnesses, infectious diseases, and internal medicine conditions.",
    common_concerns_bn: ["জ্বর ও সর্দি", "ডেঙ্গু ও দুর্বলতা", "মাথা ও পেট ব্যথা"],
    icon_name: "Stethoscope",
  },
  {
    id: 2,
    slug: "pediatrics",
    en: "Paediatrics",
    bn: "শিশু রোগ",
    symptoms_bn: "নবজাতক ও শিশুর জ্বর, নিউমোনিয়া, পাতলা পায়খানা, টিকা, শিশুর সঠিক বিকাশ",
    symptoms_en: "Infant and child fever, pneumonia, diarrhea, vaccination, healthy child growth and development",
    description_bn: "নবজাতক ও শিশুদের রোগ প্রতিরোধ, শারীরিক ও মানসিক বিকাশ এবং জটিল রোগের সমন্বিত চিকিৎসা।",
    description_en: "Comprehensive medical care, developmental assessment, and treatment for infants, children, and adolescents.",
    common_concerns_bn: ["শিশুর জ্বর", "নিউমোনিয়া ও ঠান্ডা", "টিকা ও শিশুর বিকাশ"],
    icon_name: "Baby",
  },
  {
    id: 3,
    slug: "gynaecology",
    en: "Gynaecology & Obstetrics",
    bn: "স্ত্রীরোগ ও প্রসূতি",
    symptoms_bn: "গর্ভাবস্থা, প্রসবপূর্ব সেবা, অনিয়মিত ঋতুস্রাব, জরায়ুর সমস্যা, বন্ধ্যাত্ব",
    symptoms_en: "Pregnancy, prenatal care, irregular menstruation, uterine complications, infertility",
    description_bn: "নারীর প্রজনন স্বাস্থ্য, নিরাপদ মাতৃত্ব, গর্ভকালীন সেবা এবং জটিল স্ত্রীরোগের নির্ভরযোগ্য চিকিৎসা।",
    description_en: "Compassionate women's health services covering prenatal care, safe maternity, and gynecological treatments.",
    common_concerns_bn: ["গর্ভাবস্থা ও প্রসব", "অনিয়মিত মাসিক", "জরায়ু ও বন্ধ্যাত্ব"],
    icon_name: "User",
  },
  {
    id: 4,
    slug: "cardiology",
    en: "Cardiology",
    bn: "হৃদরোগ",
    symptoms_bn: "বুকে ব্যথা, বুক ধড়ফড়ানি, শ্বাসকষ্ট, উচ্চ রক্তচাপ, হার্ট অ্যাটাক পরবর্তী যত্ন",
    symptoms_en: "Chest pain, shortness of breath, palpitations, high blood pressure, heart attack risk",
    description_bn: "হৃদপিণ্ড, রক্তনালী ও রক্তচাপ সংক্রান্ত সকল জটিলতার বিশেষজ্ঞ পরামর্শ ও চিকিৎসা।",
    description_en: "Diagnosis and treatment for heart, cardiovascular system, and hypertension issues.",
    common_concerns_bn: ["বুকে চাপ", "উচ্চ প্রেশার", "দ্রুত শ্বাস"],
    icon_name: "HeartPulse",
  },
  {
    id: 5,
    slug: "dermatology",
    en: "Dermatology",
    bn: "চর্মরোগ",
    symptoms_bn: "ত্বকের চুলকানি, অ্যালার্জি, দাউদ, একজিমা, সোরায়াসিস, চুল পড়া, যৌন রোগ",
    symptoms_en: "Skin itching, allergies, ringworm, eczema, psoriasis, hair fall, sexually transmitted infections",
    description_bn: "ত্বক, চুল, নখ ও অ্যালার্জির নানা দীর্ঘমেয়াদী ও তাৎক্ষণিক সমস্যার বিশেষজ্ঞ চিকিৎসা ও সমাধান।",
    description_en: "Specialist dermatological care for skin allergies, fungal infections, hair loss, and complex dermatoses.",
    common_concerns_bn: ["ত্বকে চুলকানি ও অ্যালার্জি", "চুল পড়া", "দাউদ ও একজিমা"],
    icon_name: "Sparkles",
  },
  {
    id: 6,
    slug: "orthopaedics",
    en: "Orthopaedics",
    bn: "অর্থোপেডিক",
    symptoms_bn: "হাড় ভাঙা, মচকানো, জয়েন্টে বা হাঁটুতে তীব্র ব্যথা, বাত, মেরুদণ্ড ও কোমরে ব্যথা",
    symptoms_en: "Bone fractures, sprains, severe joint or knee pain, arthritis, spinal and lower back pain",
    description_bn: "হাড়, জোড়, মাংসপেশি, লিগামেন্ট ও মেরুদণ্ডের সকল প্রকার ব্যথা ও আঘাতের আধুনিক চিকিৎসা।",
    description_en: "Advanced orthopedic care for bone fractures, joint problems, sports injuries, and spinal disorders.",
    common_concerns_bn: ["কোমরে ও পিঠে ব্যথা", "হাঁটু ও জয়েন্টে ব্যথা", "হাড় ভাঙা ও মচকানো"],
    icon_name: "Bone",
  },
  {
    id: 7,
    slug: "ent",
    en: "ENT",
    bn: "নাক-কান-গলা",
    symptoms_bn: "কানে কম শোনা বা পুঁজ পড়া, টনসিল, সাইনাস, গলায় ব্যথা, নাক বন্ধ থাকা",
    symptoms_en: "Hearing loss, ear discharge, tonsillitis, sinusitis, throat pain, nasal blockage",
    description_bn: "নাক, কান ও গলার সংক্রমণ, টনসিল, অ্যালার্জি ও শ্রবণ সমস্যার আধুনিক ও কার্যকরী চিকিৎসা।",
    description_en: "Expert diagnosis and surgical care for ear, nose, throat conditions, sinus problems, and hearing impairment.",
    common_concerns_bn: ["কানে কম শোনা বা পুঁজ", "টনসিল ও গলাব্যথা", "সাইনাস ও নাক বন্ধ"],
    icon_name: "Ear",
  },
  {
    id: 8,
    slug: "ophthalmology",
    en: "Ophthalmology",
    bn: "চোখ",
    symptoms_bn: "চোখে ঝাপসা দেখা, চোখ লাল হওয়া বা পানি পড়া, ছানি, চোখের প্রেসার",
    symptoms_en: "Blurred vision, red or watery eyes, cataracts, glaucoma, eye pressure",
    description_bn: "দৃষ্টিশক্তির সমস্যা, চোখের ছানি, গ্লুকোমা ও চোখের সংক্রমণের বিশেষজ্ঞ পরীক্ষা ও চিকিৎসা।",
    description_en: "Comprehensive eye care including vision correction, cataract evaluation, glaucoma management, and optical health.",
    common_concerns_bn: ["চোখে ঝাপসা দেখা", "চোখ লাল ও পানি পড়া", "ছানি ও চোখের প্রেসার"],
    icon_name: "Eye",
  },
  {
    id: 9,
    slug: "psychiatry",
    en: "Psychiatry",
    bn: "মানসিক রোগ",
    symptoms_bn: "অতিরিক্ত দুশ্চিন্তা, বিষণ্ণতা, ঘুমের সমস্যা, প্যানিক অ্যাটাক, মানসিক চাপ",
    symptoms_en: "Excessive anxiety, depression, insomnia, panic attacks, psychological stress",
    description_bn: "মানসিক স্বাস্থ্য, উদ্বেগ, বিষণ্ণতা এবং মানসিক ভারসাম্য রক্ষায় সহমর্মিতাপূর্ণ কাউন্সেলিং ও চিকিৎসা।",
    description_en: "Clinical psychiatric care, psychotherapeutic counseling, and management for mood and anxiety disorders.",
    common_concerns_bn: ["অতিরিক্ত দুশ্চিন্তা", "ঘুমের সমস্যা ও অনিদ্রা", "বিষণ্ণতা ও প্যানিক অ্যাটাক"],
    icon_name: "Brain",
  },
  {
    id: 10,
    slug: "hematology",
    en: "Hematology & Blood Disorders",
    bn: "হেমাটোলজি ও রক্তরোগ",
    symptoms_bn: "থ্যালাসেমিয়া, রক্তস্বল্পতা/অ্যানিমিয়া, রক্তে প্লাটিলেট কমে যাওয়া, রক্তক্ষরণ সমস্যা",
    symptoms_en: "Thalassemia, anemia, low platelet count, abnormal bleeding, clotting disorders",
    description_bn: "রক্তস্বল্পতা, থ্যালাসেমিয়া, ব্লাড ক্যান্সার ও রক্তক্ষরণজনিত সকল জটিল রোগের নির্ভুল পরামর্শ ও সেবা।",
    description_en: "Expert diagnosis and clinical care for thalassemia, anemia, platelet disorders, and hematologic malignancies.",
    common_concerns_bn: ["রক্তস্বল্পতা ও অ্যানিমিয়া", "থ্যালাসেমিয়া", "প্লাটিলেট কমে যাওয়া"],
    icon_name: "Droplet",
  },
  {
    id: 11,
    slug: "nephrology",
    en: "Nephrology & Kidney Care",
    bn: "কিডনি ও মূত্ররোগ",
    symptoms_bn: "প্রস্রাবে জ্বালাপোড়া বা রক্ত, শরীর ও পা ফোলা, পিঠের পাশে তীব্র ব্যথা, কিডনিতে পাথর",
    symptoms_en: "Burning urination, blood in urine, swelling in feet/body, flank pain, kidney stones",
    description_bn: "কিডনি রোগ, প্রস্রাবের ইনফেকশন, ডায়ালাইসিস ও কিডনির পাথর সংক্রান্ত রোগের বিশেষায়িত চিকিৎসা।",
    description_en: "Expert diagnosis and care for kidney disorders, urinary tract issues, stones, and renal health.",
    common_concerns_bn: ["প্রস্রাবে জ্বালাপোড়া ও ইনফেকশন", "পা ও শরীর ফোলা", "কিডনিতে পাথর"],
    icon_name: "Activity",
  },
];

export const DEMO_SPECIALTIES = SPECIALTIES;

const DEGREES = ["MBBS", "MBBS, FCPS", "MBBS, MD", "MBBS, MS", "MBBS, FCPS, MD"] as const;

function makeDoctor(index: number): DoctorCard & {
  _phone: string;
  phone: string;
  display_name_bn: string;
  full_name_bn: string;
  date_of_birth: string;
  age: number;
} {
  const upazila = pick(DEMO_UPAZILAS);
  const specialty = pick(SPECIALTIES);
  const isFemale = rng() < 0.35;
  const name = sample3WordName(isFemale);
  const fullName = `Dr. ${name.en}`;
  const fullNameBn = `ডা. ${name.bn}`;
  const degrees = pick(DEGREES);
  const fee = 0; // Government health service: 100% free
  const verified = rng() < 0.82;
  const phone = `+8801${between(3, 9)}${String(between(10_000_000, 99_999_999))}`;
  const experienceYears = between(3, 28);
  const baseAge = 26 + experienceYears + between(1, 4);
  const birthYear = 2026 - baseAge;
  const birthMonth = String(between(1, 12)).padStart(2, "0");
  const birthDay = String(between(1, 28)).padStart(2, "0");
  const dob = `${birthYear}-${birthMonth}-${birthDay}`;
  const calculatedAge = ageInYears(dob, "2026-10-12") ?? baseAge;

  return {
    user_id: `demo-doctor-${index}`,
    display_name: fullName,
    full_name: fullName,
    display_name_bn: fullNameBn,
    full_name_bn: fullNameBn,
    date_of_birth: dob,
    age: calculatedAge,
    avatar_url: null,
    bmdc_reg_no: verified ? `BMDC-${between(10000, 99999)}` : null,
    degrees,
    experience_years: experienceYears,
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
export const FEATURED_DOCTORS: readonly (DoctorCard & {
  _phone: string;
  phone: string;
  display_name_bn: string;
  full_name_bn: string;
  date_of_birth: string;
  age: number;
})[] = [
  {
    user_id: "demo-doctor-0",
    display_name: "Dr. Mohammad Abdur Rahman",
    full_name: "Dr. Mohammad Abdur Rahman",
    display_name_bn: "ডা. মোহাম্মদ আবদুর রহমান",
    full_name_bn: "ডা. মোহাম্মদ আবদুর রহমান",
    date_of_birth: "1978-04-12",
    age: 48,
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
    display_name: "Dr. Syeda Fatima Begum",
    full_name: "Dr. Syeda Fatima Begum",
    display_name_bn: "ডা. সৈয়দা ফাতেমা বেগম",
    full_name_bn: "ডা. সৈয়দা ফাতেমা বেগম",
    date_of_birth: "1982-08-25",
    age: 44,
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
    display_name: "Dr. Mohammad Anwar Hossain",
    full_name: "Dr. Mohammad Anwar Hossain",
    display_name_bn: "ডা. মোহাম্মদ আনোয়ার হোসেন",
    full_name_bn: "ডা. মোহাম্মদ আনোয়ার হোসেন",
    date_of_birth: "1974-02-18",
    age: 52,
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
    display_name: "Dr. Syeda Taslima Akter",
    full_name: "Dr. Syeda Taslima Akter",
    display_name_bn: "ডা. সৈয়দা তাসলিমা আক্তার",
    full_name_bn: "ডা. সৈয়দা তাসলিমা আক্তার",
    date_of_birth: "1984-11-05",
    age: 42,
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
    display_name: "Dr. Mohammad Kamal Uddin",
    full_name: "Dr. Mohammad Kamal Uddin",
    display_name_bn: "ডা. মোহাম্মদ কামাল উদ্দিন",
    full_name_bn: "ডা. মোহাম্মদ কামাল উদ্দিন",
    date_of_birth: "1980-06-30",
    age: 46,
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

export const DEMO_DOCTORS: readonly (DoctorCard & {
  _phone: string;
  phone?: string;
  display_name_bn: string;
  full_name_bn: string;
  date_of_birth: string;
  age: number;
})[] = [
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
    name: "Dr. Mohammad Anwar Hossain",
    name_bn: "ডা. মোহাম্মদ আনোয়ার হোসেন",
    degrees: "MBBS, FCPS",
    bmdc: "BMDC-A-88103",
    specialty_en: "Internal Medicine & Dengue",
    specialty_bn: "মেডিসিন ও ডেঙ্গু বিশেষজ্ঞ",
    specialty_slug: "medicine",
  },
  {
    name: "Dr. Mohammad Kamal Uddin",
    name_bn: "ডা. মোহাম্মদ কামাল উদ্দিন",
    degrees: "MBBS, MD (Hematology)",
    bmdc: "BMDC-A-88105",
    specialty_en: "Hematology & Blood Disorders",
    specialty_bn: "রক্তরোগ বিশেষজ্ঞ",
    specialty_slug: "blood",
  },
  {
    name: "Dr. Mohammad Kamal Uddin",
    name_bn: "ডা. মোহাম্মদ কামাল উদ্দিন",
    degrees: "MBBS, MD (Hematology)",
    bmdc: "BMDC-A-88105",
    specialty_en: "Hematology & Blood Disorders",
    specialty_bn: "রক্তরোগ বিশেষজ্ঞ",
    specialty_slug: "blood",
  },
  {
    name: "Dr. Mohammad Abdur Rahman",
    name_bn: "ডা. মোহাম্মদ আবদুর রহমান",
    degrees: "MBBS, FCPS, MD",
    bmdc: "BMDC-A-88101",
    specialty_en: "Cardiology",
    specialty_bn: "হৃদরোগ বিশেষজ্ঞ",
    specialty_slug: "cardiology",
  },
  {
    name: "Dr. Syeda Fatima Begum",
    name_bn: "ডা. সৈয়দা ফাতেমা বেগম",
    degrees: "MBBS, DCH, FCPS",
    bmdc: "BMDC-A-88102",
    specialty_en: "Paediatrics",
    specialty_bn: "শিশু রোগ বিশেষজ্ঞ",
    specialty_slug: "pediatrics",
  },
  {
    name: "Dr. Syeda Taslima Akter",
    name_bn: "ডা. সৈয়দা তাসলিমা আক্তার",
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
    author_name_bn: docMeta.name_bn,
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


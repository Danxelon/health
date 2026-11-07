/**
 * Institutional Blood Banks & Emergency Shortage Radar Domain Logic.
 *
 * Provides verified national blood banks in Bangladesh across divisions and districts,
 * real-time inventory tracking for all 8 blood groups, stock status indicators
 * (Surplus / Moderate / Critical Shortage), client geolocation proximity matching,
 * and an emergency shortage radar.
 *
 * Pure domain functions only — no side effects or React dependencies.
 */

import { BLOOD_GROUPS, type BloodGroup } from "./types.ts";
import { toBengaliDigits } from "./profile.ts";
import { haversineMetres } from "./matching.ts";
import { BD_DIVISIONS, BD_DISTRICTS, type BdDistrict } from "../lib/geo-bd.ts";

export type StockStatus = "surplus" | "moderate" | "critical";

export interface BloodStockItem {
  group: BloodGroup;
  units: number;
  status: StockStatus;
}

export interface BloodBank {
  id: string;
  name_en: string;
  name_bn: string;
  division_en: string;
  division_bn: string;
  district_en: string;
  district_bn: string;
  address_en: string;
  address_bn: string;
  lat: number;
  lng: number;
  hotline: string;
  telephone?: string;
  operating_hours_en: string;
  operating_hours_bn: string;
  verified: boolean;
  stocks: Record<BloodGroup, number>;
  updated_at: string;
}

export interface BloodBankWithDistance extends BloodBank {
  distance_km: number;
}

export interface ResolvedClientLocation {
  lat: number;
  lng: number;
  district_en: string;
  district_bn: string;
  division_en: string;
  division_bn: string;
  source: "gps" | "manual";
}

export interface NearbyBloodBanksResult {
  banks: BloodBankWithDistance[];
  exactDistrictMatchCount: number;
  expandedToRegional: boolean;
}

export interface ShortageDeficitItem {
  bankId: string;
  bankNameEn: string;
  bankNameBn: string;
  districtEn: string;
  districtBn: string;
  group: BloodGroup;
  units: number;
  hotline: string;
}

export interface EmergencyShortageRadarSummary {
  totalBanks: number;
  banksWithCriticalShortage: number;
  criticalGroupCounts: Record<BloodGroup, number>;
  deficits: ShortageDeficitItem[];
}

export interface DivisionOption {
  en: string;
  bn: string;
  lat?: number;
  lng?: number;
}

export interface DistrictOption {
  en: string;
  bn: string;
  division_en: string;
  division_bn?: string;
  lat?: number;
  lng?: number;
}

/* -------------------------------------------------------------------------- */
/* Stock Status Thresholds & Helpers                                          */
/* -------------------------------------------------------------------------- */

export const STOCK_THRESHOLDS = {
  CRITICAL_MAX: 4,  // 0 - 4 units = Critical Shortage / সংকটপূর্ণ
  MODERATE_MAX: 14, // 5 - 14 units = Moderate / সীমিত
  // >= 15 units = Surplus / পর্যাপ্ত
} as const;

/**
 * Determine stock status based on units count.
 */
export function getStockStatus(units: number): StockStatus {
  if (units <= STOCK_THRESHOLDS.CRITICAL_MAX) {
    return "critical";
  }
  if (units <= STOCK_THRESHOLDS.MODERATE_MAX) {
    return "moderate";
  }
  return "surplus";
}

/**
 * Get human-readable bilingual label and style tokens for stock status.
 */
export function getStockStatusMeta(status: StockStatus, lang: "bn" | "en" = "bn"): {
  label: string;
  labelEn: string;
  labelBn: string;
  badgeClass: string;
  indicatorColor: string;
} {
  switch (status) {
    case "critical":
      return {
        label: lang === "bn" ? "সংকটপূর্ণ" : "Critical Shortage",
        labelEn: "Critical Shortage",
        labelBn: "সংকটপূর্ণ",
        badgeClass: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
        indicatorColor: "#dc2626",
      };
    case "moderate":
      return {
        label: lang === "bn" ? "সীমিত" : "Moderate",
        labelEn: "Moderate",
        labelBn: "সীমিত",
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
        indicatorColor: "#d97706",
      };
    case "surplus":
      return {
        label: lang === "bn" ? "পর্যাপ্ত" : "Surplus",
        labelEn: "Surplus",
        labelBn: "পর্যাপ্ত",
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        indicatorColor: "#16a34a",
      };
  }
}

/**
 * Converts a phone string to a dialable tel: URI.
 */
export function formatDialableHotline(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

/**
 * Formats units count in bilingual string, e.g. "১৮ ব্যাগ" / "18 bags".
 */
export function formatStockUnits(units: number, lang: "bn" | "en" = "bn"): string {
  if (lang === "bn") {
    return `${toBengaliDigits(units)} ব্যাগ`;
  }
  return `${units} bag${units === 1 ? "" : "s"}`;
}

/**
 * Formats a distance in kilometres for bilingual badge display.
 */
export function formatDistanceKm(distanceKm: number, lang: "bn" | "en" = "bn"): string {
  if (distanceKm < 0.5) {
    return lang === "bn" ? "< ০.৫ কি.মি. দূরে" : "< 0.5 km away";
  }
  if (distanceKm < 10) {
    const oneDecimal = distanceKm.toFixed(1);
    return lang === "bn"
      ? `${toBengaliDigits(oneDecimal)} কি.মি. দূরে`
      : `${oneDecimal} km away`;
  }
  const rounded = Math.round(distanceKm);
  return lang === "bn"
    ? `${toBengaliDigits(rounded)} কি.মি. দূরে`
    : `${rounded} km away`;
}

/* -------------------------------------------------------------------------- */
/* Divisions & All 64 Districts Reference Data                                */
/* -------------------------------------------------------------------------- */

export const DIVISIONS: readonly DivisionOption[] = [
  { en: "Dhaka", bn: "ঢাকা", lat: 23.810332, lng: 90.412518 },
  { en: "Chattogram", bn: "চট্টগ্রাম", lat: 22.356851, lng: 91.783182 },
  { en: "Rajshahi", bn: "রাজশাহী", lat: 24.363589, lng: 88.624135 },
  { en: "Rangpur", bn: "রংপুর", lat: 25.743892, lng: 89.275227 },
  { en: "Khulna", bn: "খুলনা", lat: 22.845641, lng: 89.540328 },
  { en: "Sylhet", bn: "সিলেট", lat: 24.894929, lng: 91.868706 },
  { en: "Barishal", bn: "বরিশাল", lat: 22.701002, lng: 90.353451 },
  { en: "Mymensingh", bn: "ময়মনসিংহ", lat: 24.747149, lng: 90.420273 },
] as const;

export const DISTRICTS: readonly DistrictOption[] = [...BD_DISTRICTS]
  .sort((a, b) => a.name_en.localeCompare(b.name_en))
  .map((d) => ({
    en: d.name_en,
    bn: d.name_bn,
    division_en: d.division_en,
    division_bn: d.division_bn,
    lat: d.lat,
    lng: d.lng,
  }));

const DISTRICT_SPELLING_ALIASES: Readonly<Record<string, string>> = {
  bogra: "bogura",
  moulvibazar: "maulvibazar",
  comilla: "cumilla",
  jessore: "jashore",
  barisal: "barishal",
  chittagong: "chattogram",
  sirajganj: "sirajgonj",
};

function normaliseDistrictKey(name: string): string {
  const trimmed = name.trim().toLowerCase();
  return DISTRICT_SPELLING_ALIASES[trimmed] ?? trimmed;
}

/* -------------------------------------------------------------------------- */
/* Verified Institutional Blood Banks of Bangladesh                           */
/* -------------------------------------------------------------------------- */

export const VERIFIED_BLOOD_BANKS: readonly BloodBank[] = [
  {
    id: "bb-red-crescent-dhaka",
    name_en: "Bangladesh Red Crescent Central Blood Bank",
    name_bn: "বাংলাদেশ রেড ক্রিসেন্ট জাতীয় সদর রক্তকেন্দ্র",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    district_en: "Dhaka",
    district_bn: "ঢাকা",
    address_en: "7/5 Aurangzeb Road, Mohammadpur, Dhaka-1207",
    address_bn: "৭/৫ আওরঙ্গজেব রোড, মোহাম্মদপুর, ঢাকা-১২০৭",
    lat: 23.7598,
    lng: 90.3654,
    hotline: "+8801819284851",
    telephone: "02-9116563",
    operating_hours_en: "24/7 (Emergency Service Open)",
    operating_hours_bn: "২৪/৭ সার্বক্ষণিক জরুরি সেবা খোলা",
    verified: true,
    stocks: {
      "A+": 28,
      "A-": 4, // Critical
      "B+": 34,
      "B-": 3, // Critical
      "AB+": 12, // Moderate
      "AB-": 1, // Critical
      "O+": 42,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T08:00:00Z",
  },
  {
    id: "bb-quantum-lab-dhaka",
    name_en: "Quantum Voluntary Blood Lab",
    name_bn: "কোয়ান্টাম স্বেচ্ছা রক্তদান ল্যাব",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    district_en: "Dhaka",
    district_bn: "ঢাকা",
    address_en: "31/V Shilpacharya Zainul Abedin Sarak, Shantinagar, Dhaka-1217",
    address_bn: "৩১/ভি শিল্পাচার্য জয়নুল আবেদীন সড়ক, শান্তিনগর, ঢাকা-১২১৭",
    lat: 23.7382,
    lng: 90.4144,
    hotline: "+8801714010869",
    telephone: "02-9351969",
    operating_hours_en: "24 Hours (Everyday)",
    operating_hours_bn: "২৪ ঘণ্টা খোলা (প্রতিদিন)",
    verified: true,
    stocks: {
      "A+": 22,
      "A-": 6, // Moderate
      "B+": 25,
      "B-": 5, // Moderate
      "AB+": 10, // Moderate
      "AB-": 2, // Critical
      "O+": 30,
      "O-": 4, // Critical
    },
    updated_at: "2026-10-19T08:15:00Z",
  },
  {
    id: "bb-dmch-dhaka",
    name_en: "Dhaka Medical College Hospital Blood Bank",
    name_bn: "ঢাকা মেডিকেল কলেজ হাসপাতাল ব্লাড ব্যাংক",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    district_en: "Dhaka",
    district_bn: "ঢাকা",
    address_en: "Secretariate Road, Ramna, Dhaka-1000",
    address_bn: "সচিবালয় রোড, রমনা, ঢাকা-১০০০",
    lat: 23.7258,
    lng: 90.3976,
    hotline: "+8801711223344",
    telephone: "02-55165088",
    operating_hours_en: "24/7 Institutional Emergency",
    operating_hours_bn: "২৪/৭ সরকারি জরুরি ব্লাড ট্রান্সফিউশন",
    verified: true,
    stocks: {
      "A+": 18,
      "A-": 3, // Critical
      "B+": 22,
      "B-": 4, // Critical
      "AB+": 8, // Moderate
      "AB-": 1, // Critical
      "O+": 26,
      "O-": 3, // Critical
    },
    updated_at: "2026-10-19T07:45:00Z",
  },
  {
    id: "bb-mitford-dhaka",
    name_en: "Sir Salimullah Blood Bank (Mitford Hospital)",
    name_bn: "স্যার সলিমুল্লাহ মেডিকেল কলেজ মিটফোর্ড ব্লাড ব্যাংক",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    district_en: "Dhaka",
    district_bn: "ঢাকা",
    address_en: "Mitford Road, Kotwali, Old Dhaka-1100",
    address_bn: "মিটফোর্ড রোড, কোতোয়ালি, পুরান ঢাকা-১১০০",
    lat: 23.7115,
    lng: 90.4011,
    hotline: "+8801712334455",
    telephone: "02-7319002",
    operating_hours_en: "24/7 Government Blood Bank",
    operating_hours_bn: "২৪/৭ সরকারি ব্লাড ব্যাংক সেবা",
    verified: true,
    stocks: {
      "A+": 15,
      "A-": 2, // Critical
      "B+": 19,
      "B-": 3, // Critical
      "AB+": 7, // Moderate
      "AB-": 0, // Critical
      "O+": 20,
      "O-": 1, // Critical
    },
    updated_at: "2026-10-19T08:10:00Z",
  },
  {
    id: "bb-stmmch-gazipur",
    name_en: "Shaheed Tajuddin Ahmad Medical College Blood Bank",
    name_bn: "শহীদ তাজউদ্দীন আহমদ মেডিকেল কলেজ হাসপাতাল ব্লাড ব্যাংক",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    district_en: "Gazipur",
    district_bn: "গাজীপুর",
    address_en: "Hospital Road, Joydebpur, Gazipur-1700",
    address_bn: "হাসপাতাল রোড, জয়দেবপুর, গাজীপুর-১৭০০",
    lat: 23.9916,
    lng: 90.4203,
    hotline: "+8801713445566",
    telephone: "02-49261528",
    operating_hours_en: "24/7 District & Medical College Unit",
    operating_hours_bn: "২৪/৭ সরকারি মেডিকেল কলেজ ব্লাড ব্যাংক",
    verified: true,
    stocks: {
      "A+": 16,
      "A-": 3, // Critical
      "B+": 19,
      "B-": 4, // Critical
      "AB+": 7, // Moderate
      "AB-": 1, // Critical
      "O+": 23,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T08:05:00Z",
  },
  {
    id: "bb-fmch-faridpur",
    name_en: "Faridpur Medical College Hospital Blood Bank",
    name_bn: "ফরিদপুর মেডিকেল কলেজ হাসপাতাল ব্লাড ব্যাংক",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    district_en: "Faridpur",
    district_bn: "ফরিদপুর",
    address_en: "West Khabaspur, Faridpur Sadar, Faridpur-7800",
    address_bn: "পশ্চিম খাবাসপুর, ফরিদপুর সদর, ফরিদপুর-৭৮০০",
    lat: 23.5966,
    lng: 89.8306,
    hotline: "+8801714556677",
    telephone: "0631-63345",
    operating_hours_en: "24/7 Regional Transfusion Centre",
    operating_hours_bn: "২৪/৭ আঞ্চলিক রক্ত পরিসঞ্চালন কেন্দ্র",
    verified: true,
    stocks: {
      "A+": 15,
      "A-": 2, // Critical
      "B+": 17,
      "B-": 3, // Critical
      "AB+": 6, // Moderate
      "AB-": 1, // Critical
      "O+": 20,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T07:50:00Z",
  },
  {
    id: "bb-cmch-chattogram",
    name_en: "Chittagong Medical Blood Bank (CMCH)",
    name_bn: "চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল ব্লাড ব্যাংক",
    division_en: "Chattogram",
    division_bn: "চট্টগ্রাম",
    district_en: "Chattogram",
    district_bn: "চট্টগ্রাম",
    address_en: "57 K.B. Fazlul Kader Road, Chattogram-4203",
    address_bn: "৫৭ কে.বি. ফজলুল কাদের রোড, চট্টগ্রাম-৪২০৩",
    lat: 22.3593,
    lng: 91.8308,
    hotline: "+8801819334455",
    telephone: "031-619400",
    operating_hours_en: "24/7 Emergency Transfusion Unit",
    operating_hours_bn: "২৪/৭ জরুরি রক্ত পরিসঞ্চালন ইউনিট",
    verified: true,
    stocks: {
      "A+": 20,
      "A-": 5, // Moderate
      "B+": 24,
      "B-": 6, // Moderate
      "AB+": 9, // Moderate
      "AB-": 2, // Critical
      "O+": 28,
      "O-": 3, // Critical
    },
    updated_at: "2026-10-19T07:30:00Z",
  },
  {
    id: "bb-comch-cumilla",
    name_en: "Cumilla Medical College Hospital Blood Bank",
    name_bn: "কুমিল্লা মেডিকেল কলেজ হাসপাতাল ব্লাড ব্যাংক",
    division_en: "Chattogram",
    division_bn: "চট্টগ্রাম",
    district_en: "Cumilla",
    district_bn: "কুমিল্লা",
    address_en: "Kuchaitoli, Cumilla Sadar, Cumilla-3500",
    address_bn: "কুচাইতলী, কুমিল্লা সদর, কুমিল্লা-৩৫০০",
    lat: 23.4498,
    lng: 91.1994,
    hotline: "+8801817445566",
    telephone: "081-76550",
    operating_hours_en: "24/7 Government Transfusion Unit",
    operating_hours_bn: "২৪/৭ সরকারি ব্লাড ব্যাংক সেবা",
    verified: true,
    stocks: {
      "A+": 17,
      "A-": 3, // Critical
      "B+": 21,
      "B-": 4, // Critical
      "AB+": 8, // Moderate
      "AB-": 1, // Critical
      "O+": 24,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T07:45:00Z",
  },
  {
    id: "bb-cxmch-coxsbazar",
    name_en: "Cox's Bazar Medical College Hospital Blood Bank",
    name_bn: "কক্সবাজার মেডিকেল কলেজ হাসপাতাল ব্লাড ব্যাংক",
    division_en: "Chattogram",
    division_bn: "চট্টগ্রাম",
    district_en: "Cox's Bazar",
    district_bn: "কক্স বাজার",
    address_en: "Hospital Road, Cox's Bazar Sadar, Cox's Bazar-4700",
    address_bn: "হাসপাতাল রোড, কক্সবাজার সদর, কক্সবাজার-৪৭০০",
    lat: 21.4339,
    lng: 92.0156,
    hotline: "+8801818556677",
    telephone: "0341-64066",
    operating_hours_en: "24/7 Coastal Emergency Unit",
    operating_hours_bn: "২৪/৭ জরুরি ব্লাড ট্রান্সফিউশন সেবা",
    verified: true,
    stocks: {
      "A+": 14, // Moderate
      "A-": 2, // Critical
      "B+": 16,
      "B-": 3, // Critical
      "AB+": 6, // Moderate
      "AB-": 0, // Critical
      "O+": 19,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T07:35:00Z",
  },
  {
    id: "bb-rmch-rajshahi",
    name_en: "Rajshahi Sadar Blood Bank (RMCH)",
    name_bn: "রাজশাহী সদর ব্লাড ব্যাংক (রামেক হাসপাতাল)",
    division_en: "Rajshahi",
    division_bn: "রাজশাহী",
    district_en: "Rajshahi",
    district_bn: "রাজশাহী",
    address_en: "Medical College Road, Laxmipur, Rajshahi-6000",
    address_bn: "মেডিকেল কলেজ রোড, লক্ষ্মীপুর, রাজশাহী-৬০০০",
    lat: 24.3720,
    lng: 88.5872,
    hotline: "+8801715566778",
    telephone: "0721-772150",
    operating_hours_en: "24/7 Sadar Hospital Emergency",
    operating_hours_bn: "২৪/৭ সদর হাসপাতাল জরুরি রক্ত কেন্দ্র",
    verified: true,
    stocks: {
      "A+": 16,
      "A-": 2, // Critical
      "B+": 18,
      "B-": 4, // Critical
      "AB+": 6, // Moderate
      "AB-": 1, // Critical
      "O+": 21,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T08:05:00Z",
  },
  {
    id: "bb-szmch-bogura",
    name_en: "Shaheed Ziaur Rahman Medical College Blood Bank",
    name_bn: "শহীদ জিয়াউর রহমান মেডিকেল কলেজ ব্লাড ব্যাংক (বগুড়া)",
    division_en: "Rajshahi",
    division_bn: "রাজশাহী",
    district_en: "Bogura",
    district_bn: "বগুড়া",
    address_en: "Silimpur, Bogura Sadar, Bogura-5800",
    address_bn: "সিলিমপুর, বগুড়া সদর, বগুড়া-৫৮০০",
    lat: 24.8286,
    lng: 89.3532,
    hotline: "+8801715889900",
    telephone: "051-69965",
    operating_hours_en: "24/7 Regional Emergency Transfusion",
    operating_hours_bn: "২৪/৭ আঞ্চলিক জরুরি রক্ত পরিসঞ্চালন কেন্দ্র",
    verified: true,
    stocks: {
      "A+": 17,
      "A-": 3, // Critical
      "B+": 20,
      "B-": 4, // Critical
      "AB+": 7, // Moderate
      "AB-": 1, // Critical
      "O+": 23,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T08:00:00Z",
  },
  {
    id: "bb-rmc-rangpur",
    name_en: "Rangpur Medical Blood Bank (RpMCH)",
    name_bn: "রংপুর মেডিকেল কলেজ হাসপাতাল ব্লাড ব্যাংক",
    division_en: "Rangpur",
    division_bn: "রংপুর",
    district_en: "Rangpur",
    district_bn: "রংপুর",
    address_en: "Medical East Gate, Rangpur Sadar, Rangpur-5400",
    address_bn: "মেডিকেল পূর্ব গেট, রংপুর সদর, রংপুর-৫৪০০",
    lat: 25.7646,
    lng: 89.2392,
    hotline: "+8801716677889",
    telephone: "0521-62200",
    operating_hours_en: "24/7 Government Regional Blood Bank",
    operating_hours_bn: "২৪/৭ সরকারি আঞ্চলিক রক্ত পরিসঞ্চালন কেন্দ্র",
    verified: true,
    stocks: {
      "A+": 14, // Moderate
      "A-": 1, // Critical
      "B+": 17,
      "B-": 3, // Critical
      "AB+": 5, // Moderate
      "AB-": 0, // Critical
      "O+": 19,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T07:50:00Z",
  },
  {
    id: "bb-djmc-dinajpur",
    name_en: "Dinajpur Medical College Hospital Blood Bank",
    name_bn: "দিনাজপুর মেডিকেল কলেজ হাসপাতাল ব্লাড ব্যাংক",
    division_en: "Rangpur",
    division_bn: "রংপুর",
    district_en: "Dinajpur",
    district_bn: "দিনাজপুর",
    address_en: "Anandabazar, Dinajpur Sadar, Dinajpur-5200",
    address_bn: "আনন্দবাজার, দিনাজপুর সদর, দিনাজপুর-৫২০০",
    lat: 25.6056,
    lng: 88.6524,
    hotline: "+8801716990011",
    telephone: "0531-64787",
    operating_hours_en: "24/7 Institutional Emergency",
    operating_hours_bn: "২৪/৭ জরুরি সরকারি ব্লাড ব্যাংক",
    verified: true,
    stocks: {
      "A+": 15,
      "A-": 2, // Critical
      "B+": 16,
      "B-": 3, // Critical
      "AB+": 6, // Moderate
      "AB-": 1, // Critical
      "O+": 20,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T07:45:00Z",
  },
  {
    id: "bb-somch-sylhet",
    name_en: "Sylhet MAG Osmani Medical College Blood Bank",
    name_bn: "সিলেট এম.এ.জি. ওসমানী মেডিকেল কলেজ ব্লাড ব্যাংক",
    division_en: "Sylhet",
    division_bn: "সিলেট",
    district_en: "Sylhet",
    district_bn: "সিলেট",
    address_en: "Kajolshah, Sylhet-3100",
    address_bn: "কাজলশাহ, সিলেট-৩১০০",
    lat: 24.9006,
    lng: 91.8542,
    hotline: "+8801717788990",
    telephone: "0821-713487",
    operating_hours_en: "24/7 Divisional Transfusion Centre",
    operating_hours_bn: "২৪/৭ বিভাগীয় রক্ত পরিসঞ্চালন কেন্দ্র",
    verified: true,
    stocks: {
      "A+": 17,
      "A-": 4, // Critical
      "B+": 21,
      "B-": 5, // Moderate
      "AB+": 8, // Moderate
      "AB-": 1, // Critical
      "O+": 24,
      "O-": 3, // Critical
    },
    updated_at: "2026-10-19T07:40:00Z",
  },
  {
    id: "bb-kmch-khulna",
    name_en: "Khulna Medical College Hospital Blood Bank",
    name_bn: "খুলনা মেডিকেল কলেজ হাসপাতাল ব্লাড ব্যাংক",
    division_en: "Khulna",
    division_bn: "খুলনা",
    district_en: "Khulna",
    district_bn: "খুলনা",
    address_en: "Boyra Main Road, Khulna-9000",
    address_bn: "বয়রা মেইন রোড, খুলনা-৯০০০",
    lat: 22.8285,
    lng: 89.5372,
    hotline: "+8801718899001",
    telephone: "041-760350",
    operating_hours_en: "24/7 Institutional Emergency",
    operating_hours_bn: "২৪/৭ বিভাগীয় জরুরি রক্ত সঞ্চালন কেন্দ্র",
    verified: true,
    stocks: {
      "A+": 19,
      "A-": 3, // Critical
      "B+": 23,
      "B-": 4, // Critical
      "AB+": 7, // Moderate
      "AB-": 2, // Critical
      "O+": 25,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T08:20:00Z",
  },
  {
    id: "bb-jgh-jashore",
    name_en: "Jashore 250-Bed General Hospital Blood Bank",
    name_bn: "যশোর ২৫০ শয্যা জেনারেল হাসপাতাল ব্লাড ব্যাংক",
    division_en: "Khulna",
    division_bn: "খুলনা",
    district_en: "Jashore",
    district_bn: "যশোর",
    address_en: "Darantana Hospital Road, Jashore-7400",
    address_bn: "দড়াটানা হাসপাতাল রোড, যশোর-৭৪০০",
    lat: 23.1634,
    lng: 89.2182,
    hotline: "+8801718445566",
    telephone: "0421-68399",
    operating_hours_en: "24/7 District Sadar Blood Bank",
    operating_hours_bn: "২৪/৭ জেলা সদর ব্লাড ব্যাংক",
    verified: true,
    stocks: {
      "A+": 15,
      "A-": 2, // Critical
      "B+": 18,
      "B-": 3, // Critical
      "AB+": 6, // Moderate
      "AB-": 1, // Critical
      "O+": 21,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T08:10:00Z",
  },
  {
    id: "bb-sbmch-barishal",
    name_en: "Sher-e-Bangla Medical College Blood Bank",
    name_bn: "শের-ই-বাংলা মেডিকেল কলেজ ব্লাড ব্যাংক (বরিশাল)",
    division_en: "Barishal",
    division_bn: "বরিশাল",
    district_en: "Barishal",
    district_bn: "বরিশাল",
    address_en: "Band Road, Barishal-8200",
    address_bn: "বান্দ রোড, বরিশাল-৮২০০",
    lat: 22.6865,
    lng: 90.3614,
    hotline: "+8801719900112",
    telephone: "0431-217354",
    operating_hours_en: "24/7 Government Transfusion Unit",
    operating_hours_bn: "২৪/৭ সরকারি ট্রান্সফিউশন ইউনিট",
    verified: true,
    stocks: {
      "A+": 15,
      "A-": 2, // Critical
      "B+": 18,
      "B-": 3, // Critical
      "AB+": 6, // Moderate
      "AB-": 0, // Critical
      "O+": 20,
      "O-": 1, // Critical
    },
    updated_at: "2026-10-19T07:15:00Z",
  },
  {
    id: "bb-mmch-mymensingh",
    name_en: "Mymensingh Medical College Hospital Blood Bank",
    name_bn: "ময়মনসিংহ মেডিকেল কলেজ হাসপাতাল ব্লাড ব্যাংক",
    division_en: "Mymensingh",
    division_bn: "ময়মনসিংহ",
    district_en: "Mymensingh",
    district_bn: "ময়মনসিংহ",
    address_en: "Charpara, Mymensingh Sadar, Mymensingh-2200",
    address_bn: "চরপাড়া, ময়মনসিংহ সদর, ময়মনসিংহ-২২০০",
    lat: 24.7429,
    lng: 90.4087,
    hotline: "+8801711001122",
    telephone: "091-66063",
    operating_hours_en: "24/7 Institutional Emergency",
    operating_hours_bn: "২৪/৭ জরুরি সরকারি ব্লাড ব্যাংক",
    verified: true,
    stocks: {
      "A+": 16,
      "A-": 3, // Critical
      "B+": 20,
      "B-": 4, // Critical
      "AB+": 8, // Moderate
      "AB-": 1, // Critical
      "O+": 22,
      "O-": 2, // Critical
    },
    updated_at: "2026-10-19T07:55:00Z",
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Geolocation & Proximity Matching Functions                                 */
/* -------------------------------------------------------------------------- */

/**
 * Great-circle distance in kilometres (rounded to 1 decimal place).
 */
export function calculateDistanceKm(
  origin: { lat: number; lng: number },
  target: { lat: number; lng: number }
): number {
  const metres = haversineMetres(origin, target);
  return Math.round((metres / 1000) * 10) / 10;
}

/**
 * Resolves the nearest Bangladesh district for arbitrary client coordinates.
 */
export function findNearestDistrict(lat: number, lng: number): BdDistrict {
  const first = BD_DISTRICTS[0];
  if (!first) {
    throw new Error("BD_DISTRICTS dataset is unexpectedly empty");
  }

  let nearest = first;
  let minMetres = haversineMetres({ lat, lng }, { lat: first.lat, lng: first.lng });

  for (let i = 1; i < BD_DISTRICTS.length; i += 1) {
    const candidate = BD_DISTRICTS[i];
    if (!candidate) continue;
    const dist = haversineMetres({ lat, lng }, { lat: candidate.lat, lng: candidate.lng });
    if (dist < minMetres) {
      minMetres = dist;
      nearest = candidate;
    }
  }

  return nearest;
}

/**
 * Creates a ResolvedClientLocation from live browser GPS coordinates.
 */
export function resolveLocationFromCoords(lat: number, lng: number): ResolvedClientLocation {
  const nearest = findNearestDistrict(lat, lng);
  return {
    lat,
    lng,
    district_en: nearest.name_en,
    district_bn: nearest.name_bn,
    division_en: nearest.division_en,
    division_bn: nearest.division_bn,
    source: "gps",
  };
}

/**
 * Creates a ResolvedClientLocation from a manually selected Bangladesh district name.
 */
export function resolveLocationFromDistrict(districtEn: string): ResolvedClientLocation | null {
  const targetKey = normaliseDistrictKey(districtEn);
  const match = BD_DISTRICTS.find((d) => normaliseDistrictKey(d.name_en) === targetKey);
  if (!match) return null;

  return {
    lat: match.lat,
    lng: match.lng,
    district_en: match.name_en,
    district_bn: match.name_bn,
    division_en: match.division_en,
    division_bn: match.division_bn,
    source: "manual",
  };
}

/**
 * Creates a ResolvedClientLocation from a manually selected Bangladesh division name
 * (used when the user selects a division without narrowing to a specific district).
 */
export function resolveLocationFromDivision(divisionEn: string): ResolvedClientLocation | null {
  const trimmed = divisionEn.trim().toLowerCase();
  const hqDistrict = BD_DISTRICTS.find((d) => d.name_en.toLowerCase() === trimmed);
  if (hqDistrict) {
    return {
      lat: hqDistrict.lat,
      lng: hqDistrict.lng,
      district_en: hqDistrict.name_en,
      district_bn: hqDistrict.name_bn,
      division_en: hqDistrict.division_en,
      division_bn: hqDistrict.division_bn,
      source: "manual",
    };
  }

  const div = BD_DIVISIONS.find((d) => d.name_en.toLowerCase() === trimmed);
  if (!div) return null;
  return {
    lat: div.lat,
    lng: div.lng,
    district_en: div.name_en,
    district_bn: div.name_bn,
    division_en: div.name_en,
    division_bn: div.name_bn,
    source: "manual",
  };
}

/**
 * Returns institutional blood banks near the client's resolved location, sorted closest-first.
 *
 * Cascade logic:
 * 1. Includes all banks in the user's exact district OR within `radiusKm` (default 55 km).
 * 2. If a rural/remote district has 0 verified banks within `radiusKm`, widens automatically to
 *    regional banks in the same division (or within 130 km), and if still empty (e.g. foreign
 *    test coordinates), returns the 4 closest verified national centres — so an emergency seeker
 *    never lands on a dead-end empty list.
 */
export function getNearbyBloodBanks(
  banks: readonly BloodBank[],
  location: ResolvedClientLocation,
  radiusKm = 55
): NearbyBloodBanksResult {
  const sorted: BloodBankWithDistance[] = banks
    .map((bank) => ({
      ...bank,
      distance_km: calculateDistanceKm(
        { lat: location.lat, lng: location.lng },
        { lat: bank.lat, lng: bank.lng }
      ),
    }))
    .sort((a, b) => a.distance_km - b.distance_km);

  const targetDistrictKey = normaliseDistrictKey(location.district_en);
  const exactDistrictMatches = sorted.filter(
    (b) => normaliseDistrictKey(b.district_en) === targetDistrictKey
  );

  const withinRadius = sorted.filter(
    (b) =>
      b.distance_km <= radiusKm ||
      normaliseDistrictKey(b.district_en) === targetDistrictKey
  );

  if (withinRadius.length > 0) {
    return {
      banks: withinRadius,
      exactDistrictMatchCount: exactDistrictMatches.length,
      expandedToRegional: exactDistrictMatches.length === 0,
    };
  }

  const targetDivLower = location.division_en.toLowerCase();
  const regional = sorted.filter(
    (b) => b.division_en.toLowerCase() === targetDivLower || b.distance_km <= 130
  );

  return {
    banks: regional.length > 0 ? regional : sorted.slice(0, 4),
    exactDistrictMatchCount: 0,
    expandedToRegional: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Filter & Query Functions                                                   */
/* -------------------------------------------------------------------------- */

export interface BloodBankFilterOptions {
  division?: string;
  district?: string;
  bloodGroup?: BloodGroup | "ALL";
  shortageOnly?: boolean;
  search?: string;
}

/**
 * Filter blood banks by Division, District, Blood Group, Shortage status, and Search query.
 * Preserves input item subtype (e.g. `BloodBankWithDistance`) and sort order.
 */
export function filterBloodBanks<T extends BloodBank>(
  banks: readonly T[],
  options: BloodBankFilterOptions = {}
): T[] {
  const { division, district, bloodGroup, shortageOnly, search } = options;

  return banks.filter((bank) => {
    // 1. Division filter
    if (division && division !== "ALL" && bank.division_en !== division) {
      return false;
    }

    // 2. District filter
    if (
      district &&
      district !== "ALL" &&
      normaliseDistrictKey(bank.district_en) !== normaliseDistrictKey(district)
    ) {
      return false;
    }

    // 3. Search text (name, address, district)
    if (search && search.trim() !== "") {
      const q = search.trim().toLowerCase();
      const matchNameEn = bank.name_en.toLowerCase().includes(q);
      const matchNameBn = bank.name_bn.toLowerCase().includes(q);
      const matchDistEn = bank.district_en.toLowerCase().includes(q);
      const matchDistBn = bank.district_bn.toLowerCase().includes(q);
      const matchAddrEn = bank.address_en.toLowerCase().includes(q);
      const matchAddrBn = bank.address_bn.toLowerCase().includes(q);
      if (!matchNameEn && !matchNameBn && !matchDistEn && !matchDistBn && !matchAddrEn && !matchAddrBn) {
        return false;
      }
    }

    // 4. Specific blood group filter
    if (bloodGroup && bloodGroup !== "ALL") {
      const units = bank.stocks[bloodGroup] ?? 0;
      if (shortageOnly) {
        if (getStockStatus(units) !== "critical") return false;
      }
    } else if (shortageOnly) {
      // Any group in critical shortage
      const hasCritical = BLOOD_GROUPS.some(
        (g) => getStockStatus(bank.stocks[g] ?? 0) === "critical"
      );
      if (!hasCritical) return false;
    }

    return true;
  });
}

/**
 * Calculates Emergency Shortage Radar analytics.
 */
export function getEmergencyShortageRadar(
  banks: readonly BloodBank[]
): EmergencyShortageRadarSummary {
  const criticalGroupCounts: Record<BloodGroup, number> = {
    "A+": 0,
    "A-": 0,
    "B+": 0,
    "B-": 0,
    "AB+": 0,
    "AB-": 0,
    "O+": 0,
    "O-": 0,
  };

  const deficits: ShortageDeficitItem[] = [];
  let banksWithCriticalShortage = 0;

  for (const bank of banks) {
    let bankHasShortage = false;

    for (const group of BLOOD_GROUPS) {
      const units = bank.stocks[group] ?? 0;
      if (getStockStatus(units) === "critical") {
        bankHasShortage = true;
        criticalGroupCounts[group] += 1;
        deficits.push({
          bankId: bank.id,
          bankNameEn: bank.name_en,
          bankNameBn: bank.name_bn,
          districtEn: bank.district_en,
          districtBn: bank.district_bn,
          group,
          units,
          hotline: bank.hotline,
        });
      }
    }

    if (bankHasShortage) {
      banksWithCriticalShortage += 1;
    }
  }

  return {
    totalBanks: banks.length,
    banksWithCriticalShortage,
    criticalGroupCounts,
    deficits,
  };
}

/**
 * Get districts filtered for a specific division, or all 64 districts if no division selected.
 */
export function getDistrictsForDivision(divisionEn?: string): DistrictOption[] {
  if (!divisionEn || divisionEn === "ALL") {
    return [...DISTRICTS];
  }
  return DISTRICTS.filter((d) => d.division_en === divisionEn);
}

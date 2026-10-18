/**
 * Privacy-first donor discovery and automated consent call helpers.
 *
 * Founders Farhan, Ishrak, and Sheikh decided:
 * - Donors must remain anonymous upfront: no raw phone numbers or exact addresses exposed to seekers.
 * - Nearest donors are ranked by proximity/distance (approximate distance and general locality).
 * - Contact via automated official/government recorded IVR consent call simulation:
 *   "Emergency blood needed. Press 1 to consent."
 * - Mutual Reveal: Only after donor consents does the seeker get real phone number
 *   and contact details, and the donor receives emergency hospital info.
 */

import type { ConsentStatus, DonorCard } from "./types.ts";
import { maskPhone, toBengaliDigits } from "./profile.ts";

export type ConsentCallStep = "idle" | "dialing" | "ringing" | "ivr" | "consented" | "declined";

export const CONSENT_TRANSITIONS: Record<ConsentStatus, readonly ConsentStatus[]> = {
  pending: ["calling", "declined", "expired"],
  calling: ["consented", "declined", "expired"],
  consented: [],
  declined: [],
  expired: [],
};

export function canTransitionConsent(from: ConsentStatus, to: ConsentStatus): boolean {
  return CONSENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionConsentStatus(
  current: ConsentStatus,
  target: ConsentStatus
): ConsentStatus {
  if (!canTransitionConsent(current, target)) {
    throw new Error(`Invalid consent transition from '${current}' to '${target}'`);
  }
  return target;
}

/**
 * Derives the privacy-preserving anonymous identifier for a donor.
 * E.g., `রক্তদাতা #D-04` / `Donor #D-04`.
 */
export function getAnonymousDonorLabel(
  donor: { donor_id: string },
  lang: "bn" | "en" = "bn"
): string {
  // If demo ID with trailing digits like `demo-donor-4` -> "04"
  const demoMatch = donor.donor_id.match(/donor-(\d+)$/i);
  if (demoMatch && demoMatch[1]) {
    const num = demoMatch[1].padStart(2, "0");
    return lang === "bn" ? `রক্তদাতা #D-${toBengaliDigits(num)}` : `Donor #D-${num}`;
  }

  // General fallback: last 4 alphanumeric characters
  const clean = donor.donor_id.replace(/[^a-zA-Z0-9]/g, "");
  const suffix = (clean.length >= 4 ? clean.slice(-4) : clean.padStart(4, "0")).toUpperCase();
  return lang === "bn" ? `রক্তদাতা #D-${toBengaliDigits(suffix)}` : `Donor #D-${suffix}`;
}

/**
 * General approximate locality without exposing exact street or holding numbers.
 * E.g., `মিরপুর, ঢাকা` / `Mirpur, Dhaka`.
 */
export function getApproximateArea(
  donor: {
    upazila_bn?: string | null;
    district_bn?: string | null;
    upazila_en?: string | null;
    district_en?: string | null;
  },
  lang: "bn" | "en" = "bn"
): string {
  if (lang === "bn") {
    const upazila = donor.upazila_bn || "নিকটস্থ এলাকা";
    const district = donor.district_bn ? `, ${donor.district_bn}` : "";
    return `${upazila}${district}`;
  }
  const upazila = donor.upazila_en || "Nearby Area";
  const district = donor.district_en ? `, ${donor.district_en}` : "";
  return `${upazila}${district}`;
}

/**
 * Formats approximate distance with tilde prefix.
 * E.g., `~২.৩ কিমি` / `~2.3 km`.
 */
export function getApproximateDistance(
  distanceKm: number | null | undefined,
  lang: "bn" | "en" = "bn"
): string {
  if (distanceKm == null || Number.isNaN(distanceKm)) {
    return lang === "bn" ? "নিকটবর্তী দূরত্ব" : "Nearby";
  }
  const formatted = distanceKm.toFixed(1);
  return lang === "bn"
    ? `~${toBengaliDigits(formatted)} কিমি`
    : `~${formatted} km`;
}

/**
 * Returns the official IVR voice script spoken to the donor.
 */
export function getIvrPromptScript(
  bloodGroup: string,
  hospitalName: string,
  lang: "bn" | "en" = "bn"
): string {
  if (lang === "bn") {
    return `আসসালামু আলাইকুম। MediLink জরুরি স্বাস্থ্য নেটওয়ার্ক থেকে স্বয়ংক্রিয় সরকারি জরুরি কল। ${hospitalName}-এ একজন মুমূর্ষু রোগীর জন্য ${bloodGroup} রক্তের অতি জরুরি প্রয়োজন। আপনি কি এই রোগীকে রক্তদানে সম্মতি দিচ্ছেন? সম্মতি দিতে আপনার ফোনে ১ চাপুন, অথবা অপারগ হলে ২ চাপুন।`;
  }
  return `Hello, automated emergency notification from MediLink Health Network. Urgent ${bloodGroup} blood is required for a patient at ${hospitalName}. Do you consent to donate? Press 1 to consent, or 2 to decline.`;
}

/**
 * Default simulated hospitals for emergency input picker.
 */
export const POPULAR_HOSPITALS = [
  { bn: "ঢাকা মেডিকেল কলেজ হাসপাতাল (DMCH)", en: "Dhaka Medical College Hospital (DMCH)" },
  { bn: "বঙ্গবন্ধু শেখ মুজিব মেডিকেল বিশ্ববিদ্যালয় (BSMMU)", en: "Bangabandhu Sheikh Mujib Medical University (BSMMU)" },
  { bn: "জাতীয় হৃদরোগ ইনস্টিটিউট (NICVD)", en: "National Institute of Cardiovascular Diseases (NICVD)" },
  { bn: "শহীদ সোহরাওয়ার্দী মেডিকেল কলেজ হাসপাতাল", en: "Shaheed Suhrawardy Medical College Hospital" },
  { bn: "কুর্মিটোলা জেনারেল হাসপাতাল", en: "Kurmitola General Hospital" },
  { bn: "চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল (CMCH)", en: "Chittagong Medical College Hospital (CMCH)" },
  { bn: "সিলেট এম.এ.জি. ওসমানী মেডিকেল কলেজ", en: "Sylhet MAG Osmani Medical College" },
] as const;

/**
 * Masks a donor's identity and location upfront.
 * Raw phone numbers and exact street addresses are strictly hidden.
 */
export function maskDonorIdentity(
  donor: DonorCard,
  index: number
): {
  anonymousId: string;
  maskedName: string;
  maskedNameBn: string;
  approxLocation: string;
  approxLocationBn: string;
} {
  const padIndex = String(index + 1).padStart(2, "0");
  const anonymousId = `D-${padIndex}`;
  const maskedName = `Donor #${anonymousId}`;
  const maskedNameBn = `রক্তদাতা #${toBengaliDigits(anonymousId)}`;
  const approxLocation = getApproximateArea(donor, "en");
  const approxLocationBn = getApproximateArea(donor, "bn");

  return {
    anonymousId,
    maskedName,
    maskedNameBn,
    approxLocation,
    approxLocationBn,
  };
}

/**
 * Ensures exact home street addresses and raw phone numbers are masked unless consented.
 */
export function maskDonorCard(
  donor: DonorCard,
  isConsented: boolean,
  index: number = 0
): DonorCard {
  if (isConsented) {
    return { ...donor };
  }

  const identity = maskDonorIdentity(donor, index);
  return {
    ...donor,
    display_name: identity.maskedName,
    display_name_bn: identity.maskedNameBn,
    full_name: null,
    full_name_bn: null,
    phone: maskPhone(donor.phone),
    address_en: identity.approxLocation,
    address_bn: identity.approxLocationBn,
  };
}

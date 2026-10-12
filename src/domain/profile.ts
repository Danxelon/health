/**
 * Profile, identity and masking helpers.
 *
 * The governing rule for this module: nothing here ever produces a value that
 * reveals an identity to a stranger. Masking is one-directional by design —
 * there is no `unmask()`, because there is no legitimate client-side reason to
 * reconstruct a full phone number or a full name from a projection.
 */

import type { BloodGroup } from "./types.ts";

/* -------------------------------------------------------------------------- */
/* NID                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Bangladeshi NID numbers are 10, 13 or 17 digits. The server re-checks this
 * (`register_profile`) — this exists so the form can say "that is 11 digits"
 * before a round trip, not so the client can be trusted.
 */
export function isValidNidShape(nid: string): boolean {
  return /^\d{10}$|^\d{13}$|^\d{17}$/.test(nid.replace(/[\s-]/g, ""));
}

export function normaliseNid(nid: string): string {
  return nid.replace(/[\s-]/g, "");
}

/**
 * The last four digits are the only part of an NID the platform ever shows
 * back. Enough for a person to recognise their own record; useless to anyone
 * else.
 */
export function nidLast4(nid: string): string {
  return normaliseNid(nid).slice(-4);
}

export function maskedNid(last4: string | null): string {
  return last4 ? `••••••••${last4}` : "•••• ••••";
}

export type NidIssue = { en: string; bn: string } | null;

export function nidIssue(nid: string): NidIssue {
  const normalised = normaliseNid(nid);
  if (normalised.length === 0) {
    return { en: "Enter your national ID number.", bn: "আপনার জাতীয় পরিচয়পত্র নম্বর লিখুন।" };
  }
  if (!/^\d+$/.test(normalised)) {
    return { en: "The NID must be digits only.", bn: "জাতীয় পরিচয়পত্র নম্বরে শুধু সংখ্যা থাকবে।" };
  }
  if (!isValidNidShape(normalised)) {
    const len = normalised.length;
    return {
      en: `A Bangladeshi NID is 10, 13 or 17 digits — you entered ${len}.`,
      bn: `বাংলাদেশের জাতীয় পরিচয়পত্র ১০, ১৩ বা ১৭ সংখ্যার — আপনি লিখেছেন ${len}।`,
    };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Phone                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Normalises a Bangladeshi mobile number to E.164. Accepts the local `01…`
 * form, the `880…` form, and the `+880…` form, with or without separators,
 * because all three are what people actually type.
 */
export function normalisePhoneBD(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "").replace(/^\+/, "");

  if (digits.startsWith("880")) {
    digits = digits.slice(3);
  }
  if (!digits.startsWith("0")) {
    digits = `0${digits}`;
  }
  // Bangladeshi mobile operators all sit in the 013–019 range.
  if (!/^01[3-9]\d{8}$/.test(digits)) return null;

  return `+880${digits.slice(1)}`;
}

export function isValidPhoneBD(input: string): boolean {
  return normalisePhoneBD(input) !== null;
}

/**
 * Display masking. Keeps the operator prefix (so a person can tell it is their
 * number and which network) and the last two digits. Everything between is
 * gone.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("880") ? `0${digits.slice(3)}` : digits;
  if (local.length < 6) return "—";
  return `${local.slice(0, 3)}•••••${local.slice(-2)}`;
}

/** `tel:` href for the few places a real number is legitimately held. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/* -------------------------------------------------------------------------- */
/* Name                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Given name plus surname initial. This is what a donor card shows.
 *
 * "Md. Rakibul Hasan" → "Md. R." — but note it splits on the FIRST space, so a
 * name that is genuinely one word ("Shathi") is left whole rather than
 * truncated to "S.". Truncating would make the name useless for the person
 * recognising themselves.
 */
export function maskName(fullName: string | null | undefined): string {
  const name = (fullName ?? "").trim().replace(/\s+/g, " ");
  if (!name) return "A donor";
  const parts = name.split(" ");
  const first = parts[0] ?? "";
  const second = parts[1];
  if (parts.length < 2 || !second) return first;
  return `${first} ${second.charAt(0).toUpperCase()}.`;
}

/** Bengali counterpart — same rule, works because Bengali names split on space too. */
export function maskNameBn(fullNameBn: string | null | undefined, fallback: string): string {
  const name = (fullNameBn ?? "").trim().replace(/\s+/g, " ");
  if (!name) return fallback;
  const parts = name.split(" ");
  const first = parts[0] ?? "";
  const second = parts[1];
  if (parts.length < 2 || !second) return first;
  return `${first} ${second.charAt(0)}.`;
}

/** Initials for an avatar fallback, without a network image. */
export function initialsOf(fullName: string | null | undefined): string {
  const name = (fullName ?? "").trim();
  if (!name) return "•";
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase() || "•";
}

/* -------------------------------------------------------------------------- */
/* Completeness                                                                */
/* -------------------------------------------------------------------------- */

export interface CompletenessInput {
  full_name: string | null;
  full_name_bn: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: BloodGroup | null;
  home_upazila_id: number | null;
  present_address: string | null;
}

export interface CompletenessField {
  key: keyof CompletenessInput;
  en: string;
  bn: string;
  weight: number;
}

/**
 * Which profile fields are missing, weighted by how much they matter.
 *
 * `blood_group` and `home_upazila_id` carry the most weight because they are
 * the two fields the product cannot function without: no group means no match,
 * no upazila means no ring. `full_name_bn` is deliberately low-weight — it is
 * a courtesy, not a requirement.
 */
export const COMPLETENESS_FIELDS: readonly CompletenessField[] = [
  { key: "blood_group", en: "Blood group", bn: "রক্তের গ্রুপ", weight: 3 },
  { key: "home_upazila_id", en: "Home upazila", bn: "নিজ উপজেলা", weight: 3 },
  { key: "date_of_birth", en: "Date of birth", bn: "জন্ম তারিখ", weight: 2 },
  { key: "full_name", en: "Full name", bn: "পূর্ণ নাম", weight: 2 },
  { key: "present_address", en: "Present address", bn: "বর্তমান ঠিকানা", weight: 1 },
  { key: "gender", en: "Gender", bn: "লিঙ্গ", weight: 1 },
  { key: "full_name_bn", en: "Name in Bengali", bn: "বাংলায় নাম", weight: 1 },
];

export function completeness(profile: CompletenessInput): {
  score: number;
  percent: number;
  missing: CompletenessField[];
} {
  const total = COMPLETENESS_FIELDS.reduce((sum, f) => sum + f.weight, 0);

  const missing = COMPLETENESS_FIELDS.filter((f) => {
    const value = profile[f.key];
    if (value === null || value === undefined) return true;
    if (typeof value === "string") return value.trim().length === 0;
    if (typeof value === "number") return value <= 0;
    return false;
  });

  const earned = total - missing.reduce((sum, f) => sum + f.weight, 0);
  return {
    score: earned,
    percent: Math.round((earned / total) * 100),
    missing,
  };
}

/* -------------------------------------------------------------------------- */
/* Age bands (never an exact age on a public surface)                          */
/* -------------------------------------------------------------------------- */

export function ageBand(age: number | null | undefined): { en: string; bn: string } {
  if (age === null || age === undefined || Number.isNaN(age) || age <= 0) {
    return { en: "Age not given", bn: "বয়স দেওয়া নেই" };
  }
  if (age < 25) return { en: "18–24", bn: "১৮–২৪" };
  if (age < 35) return { en: "25–34", bn: "২৫–৩৪" };
  if (age < 45) return { en: "35–44", bn: "৩৫–৪৪" };
  if (age < 56) return { en: "45–55", bn: "৪৫–৫৫" };
  return { en: "56–65", bn: "৫৬–৬৫" };
}

/* -------------------------------------------------------------------------- */
/* Donation milestone messaging                                                */
/* -------------------------------------------------------------------------- */

/**
 * The donor's own progress. Note what this does NOT do: it never compares a
 * donor to other donors. A leaderboard on a blood platform turns altruism into
 * a competition and rewards the people who least need the incentive.
 */
export function donationMilestone(total: number): {
  en: string;
  bn: string;
  next: number | null;
} | null {
  if (total <= 0) {
    return {
      en: "Your first donation is the one a family remembers.",
      bn: "আপনার প্রথম রক্তদানই একটি পরিবারের মনে থাকবে।",
      next: 1,
    };
  }
  const milestones = [1, 3, 5, 10, 20, 30, 50];
  const next = milestones.find((m) => m > total) ?? null;

  if (total >= 50) {
    return { en: "50 donations. That is a rare kind of record.", bn: "৫০ বার রক্তদান। এ এক বিরল রেকর্ড।", next: null };
  }

  return {
    en: `${total} donation${total === 1 ? "" : "s"} recorded.`,
    bn: `${toBengaliDigits(total)} বার রক্তদান নথিভুক্ত।`,
    next,
  };
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"] as const;

/** Latin digits to Bengali, for counts rendered next to Bengali copy. */
export function toBengaliDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** Bengali number formatting with the lakh/crore grouping Bangladesh uses. */
export function formatCountBn(value: number): string {
  return toBengaliDigits(value.toLocaleString("en-IN"));
}

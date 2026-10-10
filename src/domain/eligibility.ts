/**
 * Donor eligibility.
 *
 * Hard blocks are never shown as candidates. Soft warnings are shown, but
 * flagged to the requestor — this platform does not adjudicate anyone's
 * medical fitness, and it must never present a soft-warned donor as "safe".
 *
 * Mirrors `public.donor_eligibility()` in `0004_rpc_core.sql`. The server
 * re-runs this at accept time: six hours can pass between invite and accept,
 * and a donation elsewhere in the meantime starts a real cooldown.
 */

import type {
  BloodComponent,
  DonorTempStatus,
  EligibilityInput,
  EligibilityReason,
  EligibilityResult,
  HardBlockReason,
  SoftWarningReason,
} from "./types.ts";

/* -------------------------------------------------------------------------- */
/* Constants — the policy, in one place                                        */
/* -------------------------------------------------------------------------- */

/**
 * Cooldown between donations, in days, by component. These are the standard
 * national transfusion-service intervals: whole blood and PRBC share 90 days
 * because both remove roughly the same red-cell mass.
 */
export const COOLDOWN_DAYS: Record<BloodComponent, number> = {
  whole_blood: 90,
  prbc: 90,
  platelets: 14,
  plasma: 28,
};

export const MIN_WEIGHT_KG = 50;
export const MIN_AGE = 18;
export const MAX_AGE = 65;

/** Beyond this, we stop accepting self-reported back-dated donations. */
export const MAX_BACKDATED_DAYS = 365;

export const HARD_BLOCKS: readonly HardBlockReason[] = [
  "no_profile",
  "age_too_young",
  "age_too_old",
  "underweight",
  "cooldown_active",
  "opted_out",
  "manual_cooldown",
];

export const SOFT_WARNINGS: readonly SoftWarningReason[] = [
  "chronic_condition",
  "recent_illness",
  "on_medication",
  "smoker",
];

/* -------------------------------------------------------------------------- */
/* Date helpers — all date-only, all UTC, no timezone drift                    */
/* -------------------------------------------------------------------------- */

/** Today at UTC midnight, as a `YYYY-MM-DD` string. */
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Parses a `YYYY-MM-DD` string to a UTC-midnight Date, or null. */
export function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match as unknown as [string, string, string, string];
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Adds whole days to a `YYYY-MM-DD` string, returning `YYYY-MM-DD`. */
export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  if (!date) throw new Error(`addDays: not a date: ${iso}`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Whole years elapsed between `dob` and the reference date. Computed with
 * calendar arithmetic, not by dividing milliseconds — a leap year must not
 * turn a 17-year-old into an 18-year-old a day early.
 */
export function ageInYears(dob: string | null, onISO: string = todayISO()): number | null {
  const birth = parseISODate(dob);
  const on = parseISODate(onISO);
  if (!birth || !on) return null;

  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

/** Days between two `YYYY-MM-DD` values. Positive when `to` is later. */
export function daysBetween(fromISO: string, toISO: string): number | null {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/* -------------------------------------------------------------------------- */
/* Cooldown                                                                    */
/* -------------------------------------------------------------------------- */

/** The date a donation of `component` will next be permitted, or null. */
export function nextEligibleOn(
  lastDonation: string | null,
  component: BloodComponent
): string | null {
  if (!lastDonation) return null;
  const parsed = parseISODate(lastDonation);
  if (!parsed) return null;
  return addDays(lastDonation, COOLDOWN_DAYS[component]);
}

/** Whole days remaining in the cooldown. 0 when eligible. Null when unknown. */
export function cooldownDaysRemaining(
  lastDonation: string | null,
  component: BloodComponent,
  onISO: string = todayISO()
): number | null {
  const next = nextEligibleOn(lastDonation, component);
  if (!next) return null;
  const diff = daysBetween(onISO, next);
  return diff === null ? null : Math.max(0, diff);
}

/* -------------------------------------------------------------------------- */
/* The evaluation                                                              */
/* -------------------------------------------------------------------------- */

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The full verdict. Pure: same input, same output, no clock beyond the one
 * passed in. That is what makes it unit-testable, and this is the logic a
 * person's safety depends on.
 */
export function evaluateEligibility(
  input: EligibilityInput | null,
  component: BloodComponent = "whole_blood",
  onISO: string = todayISO()
): EligibilityResult {
  const reasons: EligibilityReason[] = [];

  if (!input) {
    return {
      eligible: false,
      reasons: ["no_profile"],
      soft_warnings: [],
      age: null,
      weight_kg: null,
      last_donation: null,
      next_eligible_on: null,
      component,
    };
  }

  const age = ageInYears(input.date_of_birth, onISO);
  const weight = input.weight_kg;
  const last = input.last_donation_date;
  const next = nextEligibleOn(last, component);

  /* --- Hard blocks ------------------------------------------------------ */

  if (age !== null && age < MIN_AGE) reasons.push("age_too_young");
  if (age !== null && age > MAX_AGE) reasons.push("age_too_old");
  if (weight !== null && weight < MIN_WEIGHT_KG) reasons.push("underweight");

  if (next !== null) {
    const remaining = daysBetween(onISO, next);
    if (remaining !== null && remaining > 0) reasons.push("cooldown_active");
  }

  if (input.temp_status === "unavailable") reasons.push("opted_out");
  if (input.temp_status === "cooldown") reasons.push("manual_cooldown");
  if (input.notifications_enabled === false) reasons.push("opted_out");

  /* --- Soft warnings ---------------------------------------------------- */

  if (hasText(input.chronic_conditions)) reasons.push("chronic_condition");
  if (input.recent_illness) reasons.push("recent_illness");
  if (hasText(input.medications)) reasons.push("on_medication");
  if (input.smoker) reasons.push("smoker");

  const hard = reasons.filter((r): r is HardBlockReason =>
    (HARD_BLOCKS as readonly string[]).includes(r)
  );
  const soft = reasons.filter((r): r is SoftWarningReason =>
    (SOFT_WARNINGS as readonly string[]).includes(r)
  );

  // `reasons` is rendered as a list in the UI, so it must not hand the user the
  // same sentence twice: an unavailable donor who also muted notifications
  // reaches `opted_out` by two independent routes.
  return {
    eligible: hard.length === 0,
    reasons: [...new Set(reasons)],
    soft_warnings: soft,
    age,
    weight_kg: weight,
    last_donation: last,
    next_eligible_on: next,
    component,
  };
}

/** Convenience predicate for list rendering. */
export function isEligible(
  input: EligibilityInput | null,
  component: BloodComponent = "whole_blood",
  onISO: string = todayISO()
): boolean {
  return evaluateEligibility(input, component, onISO).eligible;
}

/**
 * Can this donor actually give *right now*, in the strict sense: available,
 * out of cooldown, and with no soft warning we would feel obliged to mention?
 *
 * This is the narrower question than `eligible` and it is what the "ready now"
 * counter and the green badge mean. A donor who is eligible but has a chronic
 * condition is still valuable — they are simply not "ready now".
 */
export function canGiveNow(
  input: EligibilityInput | null,
  component: BloodComponent = "whole_blood",
  onISO: string = todayISO()
): boolean {
  const result = evaluateEligibility(input, component, onISO);
  return result.eligible && result.soft_warnings.length === 0;
}

/** True when the donor is available but inside a cooldown. */
export function isCoolingDown(input: EligibilityInput | null, component: BloodComponent): boolean {
  return evaluateEligibility(input, component).reasons.includes("cooldown_active");
}

/* -------------------------------------------------------------------------- */
/* Messages — every reason has a bilingual sentence, no generic fallbacks       */
/* -------------------------------------------------------------------------- */

const HARD_MESSAGES: Record<HardBlockReason, { en: string; bn: string }> = {
  no_profile: {
    en: "We need your date of birth and weight before you can donate.",
    bn: "রক্তদানের আগে আপনার জন্ম তারিখ ও ওজন জানা প্রয়োজন।",
  },
  age_too_young: {
    en: "Donors must be at least 18 years old.",
    bn: "রক্তদাতার বয়স কমপক্ষে ১৮ বছর হতে হবে।",
  },
  age_too_old: {
    en: "Donors up to 65 years old are accepted.",
    bn: "৬৫ বছর পর্যন্ত রক্তদাতা গ্রহণ করা হয়।",
  },
  underweight: {
    en: "Donors must weigh at least 50 kg.",
    bn: "রক্তদাতার ওজন কমপক্ষে ৫০ কেজি হতে হবে।",
  },
  cooldown_active: {
    en: "You are still inside the rest period after your last donation.",
    bn: "শেষ রক্তদানের পর বিশ্রামের সময় এখনো শেষ হয়নি।",
  },
  opted_out: {
    en: "You have turned off donation availability.",
    bn: "আপনি রক্তদানের সক্রিয়তা বন্ধ করে রেখেছেন।",
  },
  manual_cooldown: {
    en: "Your profile is set to a temporary rest period.",
    bn: "আপনার প্রোফাইল সাময়িক বিশ্রামে রয়েছে।",
  },
};

const SOFT_MESSAGES: Record<SoftWarningReason, { en: string; bn: string }> = {
  chronic_condition: {
    en: "Has a declared chronic condition.",
    bn: "দীর্ঘমেয়াদি রোগ রয়েছে বলে জানিয়েছেন।",
  },
  recent_illness: {
    en: "Had a recent illness.",
    bn: "সম্প্রতি অসুস্থ ছিলেন।",
  },
  on_medication: {
    en: "Is currently taking medication.",
    bn: "বর্তমানে ওষুধ খাচ্ছেন।",
  },
  smoker: {
    en: "Smokes.",
    bn: "ধূমপান করেন।",
  },
};

export function reasonMessage(reason: EligibilityReason): { en: string; bn: string } {
  if (reason in HARD_MESSAGES) return HARD_MESSAGES[reason as HardBlockReason];
  return SOFT_MESSAGES[reason as SoftWarningReason];
}

export function isHardBlock(reason: EligibilityReason): reason is HardBlockReason {
  return (HARD_BLOCKS as readonly string[]).includes(reason);
}

/** A donor-facing next step: either "you can donate" or "come back on X". */
export function eligibilitySummary(result: EligibilityResult): { en: string; bn: string } {
  if (result.eligible) {
    const warnings = result.soft_warnings.length;
    if (warnings === 0) {
      return {
        en: "You are ready to donate.",
        bn: "আপনি রক্তদানের জন্য প্রস্তুত।",
      };
    }
    return {
      en: `You can donate, though your profile flags ${warnings} item${warnings > 1 ? "s" : ""} the hospital will ask about.`,
      bn: `আপনি রক্ত দিতে পারেন, তবে হাসপাতাল ${warnings}টি বিষয় নিয়ে জিজ্ঞাসা করবে।`,
    };
  }

  if (result.reasons.includes("cooldown_active") && result.next_eligible_on) {
    return {
      en: `Your next eligible date is ${result.next_eligible_on}.`,
      bn: `আপনার পরবর্তী রক্তদানের তারিখ ${result.next_eligible_on}।`,
    };
  }

  const first = result.reasons[0];
  return first
    ? reasonMessage(first)
    : { en: "You are not eligible to donate right now.", bn: "আপনি এখন রক্তদানের জন্য উপযুক্ত নন।" };
}

/* -------------------------------------------------------------------------- */
/* Donor self-reported external donation                                       */
/* -------------------------------------------------------------------------- */

/**
 * Guards for the "I donated somewhere else" form. Without this, a user could
 * back-date a donation to fake a cooldown, or post-date one to skip it.
 */
export function validateExternalDonation(
  donatedOn: string,
  onISO: string = todayISO()
): { ok: true } | { ok: false; code: "FUTURE" | "TOO_OLD" | "MALFORMED"; en: string; bn: string } {
  if (!parseISODate(donatedOn)) {
    return {
      ok: false,
      code: "MALFORMED",
      en: "Enter the donation date as YYYY-MM-DD.",
      bn: "রক্তদানের তারিখ YYYY-MM-DD আকারে লিখুন।",
    };
  }

  const diff = daysBetween(onISO, donatedOn);
  if (diff === null) {
    return {
      ok: false,
      code: "MALFORMED",
      en: "Enter the donation date as YYYY-MM-DD.",
      bn: "রক্তদানের তারিখ YYYY-MM-DD আকারে লিখুন।",
    };
  }

  if (diff > 0) {
    return {
      ok: false,
      code: "FUTURE",
      en: "A donation date cannot be in the future.",
      bn: "রক্তদানের তারিখ ভবিষ্যতের হতে পারে না।",
    };
  }

  if (-diff > MAX_BACKDATED_DAYS) {
    return {
      ok: false,
      code: "TOO_OLD",
      en: "We only track donations within the last 12 months.",
      bn: "আমরা শুধু গত ১২ মাসের রক্তদান সংরক্ষণ করি।",
    };
  }

  return { ok: true };
}

/** Availability options, as the donor's own dashboard presents them. */
export const AVAILABILITY_OPTIONS: readonly {
  value: DonorTempStatus;
  en: string;
  bn: string;
  hint_en: string;
  hint_bn: string;
}[] = [
  {
    value: "available",
    en: "Available",
    bn: "উপলব্ধ",
    hint_en: "You may be contacted for a nearby request.",
    hint_bn: "কাছাকাছি অনুরোধের জন্য আপনাকে জানানো হতে পারে।",
  },
  {
    value: "cooldown",
    en: "Resting",
    bn: "বিশ্রামে",
    hint_en: "Temporarily paused — you keep your place in the pool.",
    hint_bn: "সাময়িকভাবে বন্ধ — আপনার অবস্থান সংরক্ষিত থাকবে।",
  },
  {
    value: "unavailable",
    en: "Not donating",
    bn: "রক্তদান করছি না",
    hint_en: "You will not appear in any search.",
    hint_bn: "কোনো অনুসন্ধানে আপনি দেখানো হবে না।",
  },
];

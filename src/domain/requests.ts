/**
 * Blood request lifecycle.
 *
 * v1 had a `status` column and no rules. This module is the state machine: it
 * answers "may this transition happen", "is this fulfilled", "what expires
 * when", and "what does the escalation ladder do next".
 *
 * Mirrors `set_request_expiry()`, `sync_request_from_responses()` and
 * `next_escalation_step()` in the migrations.
 */

import { addDays, todayISO } from "./eligibility.ts";
import { RING_CADENCE_MINUTES, maxRingFor } from "./matching.ts";
import type {
  BloodRequest,
  EscalationRingName,
  EscalationStep,
  RequestStatus,
  RequestUrgency,
  ResponseState,
} from "./types.ts";

/* -------------------------------------------------------------------------- */
/* Expiry                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * How long a request stays visible before it stops being actionable.
 *
 * Note the direction: the more urgent the request, the SHORTER the window, not
 * longer. A critical request that is still open after 24 hours has failed and
 * should escalate to admin outreach rather than linger on the board pretending
 * to be live.
 */
export const EXPIRY_HOURS: Record<RequestUrgency, number> = {
  routine: 7 * 24,
  urgent: 48,
  critical: 24,
};

export function expiryFor(urgency: RequestUrgency, createdAt: Date = new Date()): Date {
  return new Date(createdAt.getTime() + EXPIRY_HOURS[urgency] * 3_600_000);
}

export function expiresAtISO(urgency: RequestUrgency, createdAt: Date = new Date()): string {
  return expiryFor(urgency, createdAt).toISOString();
}

export function isExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t <= now.getTime();
}

/** Hours left, floored at 0. Null when the request has no expiry. */
export function hoursRemaining(expiresAt: string | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (t - now.getTime()) / 3_600_000);
}

/**
 * A request is "urgent" in the UI sense — red dot, pinned to the top — when it
 * is critical, or when any request has under an hour left. The clock, not the
 * label, is what makes a request urgent.
 */
export function isClockUrgent(
  request: Pick<BloodRequest, "urgency" | "expires_at" | "status">,
  now: Date = new Date()
): boolean {
  if (request.status !== "open" && request.status !== "matching") return false;
  if (request.urgency === "critical") return true;
  const hours = hoursRemaining(request.expires_at, now);
  return hours !== null && hours < 1;
}

/* -------------------------------------------------------------------------- */
/* State machine                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Legal transitions. Written as a map rather than a switch so the set is
 * inspectable — `REQUEST_TRANSITIONS[from]` is the ground truth for both the
 * guard and the tests.
 */
export const REQUEST_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  open: ["matching", "fulfilled", "cancelled", "expired"],
  matching: ["fulfilled", "cancelled", "expired"],
  // Terminal: a fulfilled request is a permanent record of a donation that
  // happened. Reopening it would erase evidence of an act someone performed.
  fulfilled: [],
  cancelled: [],
  expired: [],
};

export const TERMINAL_REQUEST_STATUSES: readonly RequestStatus[] = [
  "fulfilled",
  "cancelled",
  "expired",
];

export function isTerminal(status: RequestStatus): boolean {
  return TERMINAL_REQUEST_STATUSES.includes(status);
}

export interface TransitionCheck {
  allowed: boolean;
  reason?: { en: string; bn: string };
}

/**
 * May `from` become `to`?
 *
 * The additional rules beyond the table are the ones that actually matter:
 * a request cannot be cancelled or fulfilled once it is closed, and a request
 * with confirmed units at or above the ask cannot go back to `open`.
 */
export function canTransition(from: RequestStatus, to: RequestStatus): TransitionCheck {
  if (from === to) {
    return {
      allowed: false,
      reason: {
        en: "The request is already in that state.",
        bn: "অনুরোধটি ইতিমধ্যেই সেই অবস্থায় আছে।",
      },
    };
  }

  if (isTerminal(from)) {
    return {
      allowed: false,
      reason: {
        en: `A ${from} request cannot be changed.`,
        bn: `${from} অবস্থায় থাকা অনুরোধ পরিবর্তন করা যাবে না।`,
      },
    };
  }

  if (!REQUEST_TRANSITIONS[from].includes(to)) {
    return {
      allowed: false,
      reason: {
        en: `A request cannot move from ${from} to ${to}.`,
        bn: `অনুরোধটি ${from} থেকে ${to}-এ যেতে পারে না।`,
      },
    };
  }

  return { allowed: true };
}

/* -------------------------------------------------------------------------- */
/* Fulfilment                                                                  */
/* -------------------------------------------------------------------------- */

export interface Fulfilment {
  confirmed: number;
  needed: number;
  remaining: number;
  satisfied: boolean;
  /** 0..1, for the progress bar. */
  progress: number;
}

/**
 * Fulfilment is met when confirmed units reach the ask — never exceeded. The
 * `units_confirmed <= units_needed` constraint in the schema is what keeps a
 * request from over-collecting; this mirrors it for display.
 */
export function evaluateFulfilment(
  unitsNeeded: number,
  unitsConfirmed: number
): Fulfilment {
  const needed = Math.max(1, Math.floor(unitsNeeded));
  const confirmed = Math.max(0, Math.floor(unitsConfirmed));
  const capped = Math.min(confirmed, needed);

  return {
    confirmed: capped,
    needed,
    remaining: Math.max(0, needed - capped),
    satisfied: capped >= needed,
    progress: capped / needed,
  };
}

/**
 * The status a request SHOULD hold, given its responses. This is what the
 * database trigger computes; the client calls it to render optimistically
 * without waiting for the write to round-trip.
 */
export function projectStatus(
  current: RequestStatus,
  unitsNeeded: number,
  confirmedCount: number
): RequestStatus {
  if (isTerminal(current)) return current;

  const { satisfied } = evaluateFulfilment(unitsNeeded, confirmedCount);
  if (satisfied) return "fulfilled";
  if (current === "open" && confirmedCount > 0) return "matching";
  return current;
}

/* -------------------------------------------------------------------------- */
/* Response states                                                             */
/* -------------------------------------------------------------------------- */

export const RESPONSE_TRANSITIONS: Record<ResponseState, readonly ResponseState[]> = {
  invited: ["accepted", "declined", "cancelled"],
  accepted: ["donated", "no_show", "cancelled"],
  declined: [],
  donated: [],
  no_show: [],
  cancelled: [],
};

export function canRespond(state: ResponseState, next: ResponseState): boolean {
  return RESPONSE_TRANSITIONS[state].includes(next);
}

/**
 * Declining must never be penalised in the UI.
 *
 * The `declined_count_12mo` column exists so an admin can spot someone who
 * habitually accepts and never arrives. It is surfaced only to admins, and this
 * flag records that intent in code so a future contributor does not
 * accidentally render it as a public "reliability" badge.
 */
export const DECLINE_IS_NEUTRAL = true;

/* -------------------------------------------------------------------------- */
/* Escalation ladder                                                           */
/* -------------------------------------------------------------------------- */

export const LADDER: readonly {
  ring: EscalationRingName;
  label_en: string;
  label_bn: string;
  radius_km: number | null;
  channel: "push" | "sms" | "admin" | "external";
}[] = [
  { ring: "ring_0_1", label_en: "Nearby donors (3–10 km)", label_bn: "কাছের রক্তদাতা (৩–১০ কিমি)", radius_km: 10, channel: "push" },
  { ring: "ring_2_3", label_en: "Wider area (upazila)", label_bn: "বিস্তৃত এলাকা (উপজেলা)", radius_km: 25, channel: "sms" },
  { ring: "ring_4_5_admin", label_en: "District + admin outreach", label_bn: "জেলা + অ্যাডমিন যোগাযোগ", radius_km: null, channel: "admin" },
  { ring: "national", label_en: "National donor pool", label_bn: "জাতীয় রক্তদাতা তালিকা", radius_km: null, channel: "sms" },
  { ring: "blood_bank", label_en: "Blood banks near you", label_bn: "কাছের ব্লাড ব্যাংক", radius_km: null, channel: "external" },
];

/**
 * Which rung the request is on, and which one comes next.
 *
 * The ladder is capped by urgency (`maxRingFor`): a routine request is not
 * allowed past the upazila rung, because a routine request that reaches the
 * national pool has spent real SMS money to inconvenience thousands of people.
 */
export function escalationLadder(
  urgency: RequestUrgency,
  createdAt: string,
  now: Date = new Date()
): EscalationStep[] {
  const start = Date.parse(createdAt);
  if (!Number.isFinite(start)) {
    return LADDER.map((rung) => ({ ...rung, at_minutes: null, done: false }));
  }

  const elapsedMinutes = Math.max(0, (now.getTime() - start) / 60_000);
  const cadence = RING_CADENCE_MINUTES[urgency];
  const ceiling = maxRingFor(urgency);

  // Ring index per rung: 0-1 → 1, 2-3 → 3, 4-5+admin → 5, national → 6, bank → 7
  const ringIndexOf = [1, 3, 5, 6, 7];

  return LADDER.map((rung, i) => {
    const at = cadence[i] ?? null;
    const ringIndex = ringIndexOf[i] ?? 99;
    const withinLadder = ringIndex <= ceiling;
    // Ring 4-5 (admin) is allowed at urgent and above even though the radius
    // rings stop earlier — a human with a phone is not a broadcast cost.
    const permitted = withinLadder || rung.channel === "admin" || rung.channel === "external";
    const done = permitted && at !== null && elapsedMinutes >= at;

    return {
      ring: rung.ring,
      label_en: rung.label_en,
      label_bn: rung.label_bn,
      radius_km: rung.radius_km,
      at_minutes: permitted ? at : null,
      done,
    };
  });
}

/**
 * The next action the system will take, as a sentence the requestor can read.
 * This is the "what happens next" the tracking screen owes a frightened user.
 */
export function nextEscalationStep(
  urgency: RequestUrgency,
  createdAt: string,
  now: Date = new Date()
): EscalationStep {
  const steps = escalationLadder(urgency, createdAt, now);
  const pending = steps.find((s) => !s.done);

  if (!pending) {
    return {
      ring: "closed",
      label_en: "Every rung has been used",
      label_bn: "সব ধাপ ব্যবহার করা হয়েছে",
      radius_km: null,
      at_minutes: null,
      done: true,
    };
  }

  return pending;
}

/* -------------------------------------------------------------------------- */
/* Abuse guards                                                                */
/* -------------------------------------------------------------------------- */

export const MAX_OPEN_REQUESTS = 2;
export const DAILY_REQUEST_CEILING = 3;

export interface RequestAbuseCheck {
  allowed: boolean;
  reason?: { en: string; bn: string };
}

/**
 * Guards against a user carpet-bombing the donor pool. Two open requests is
 * generous — a family with two patients — and three in a day is already more
 * than any honest emergency needs.
 */
export function canCreateRequest(openCount: number, createdToday: number): RequestAbuseCheck {
  if (openCount >= MAX_OPEN_REQUESTS) {
    return {
      allowed: false,
      reason: {
        en: `You already have ${openCount} open requests. Close one before posting another.`,
        bn: `আপনার ইতিমধ্যেই ${openCount}টি সক্রিয় অনুরোধ আছে। নতুন করার আগে একটি বন্ধ করুন।`,
      },
    };
  }

  if (createdToday >= DAILY_REQUEST_CEILING) {
    return {
      allowed: false,
      reason: {
        en: "You have reached today's limit for new requests.",
        bn: "আপনি আজকের জন্য নতুন অনুরোধের সীমায় পৌঁছে গেছেন।",
      },
    };
  }

  return { allowed: true };
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

export const URGENCY_META: Record<
  RequestUrgency,
  { en: string; bn: string; description_en: string; description_bn: string; sla_hours: number }
> = {
  critical: {
    en: "Critical",
    bn: "অতি জরুরি",
    description_en: "Needed within hours. Escalates immediately to nearby donors.",
    description_bn: "কয়েক ঘণ্টার মধ্যে প্রয়োজন। সাথে সাথে কাছের রক্তদাতাদের জানানো হয়।",
    sla_hours: 24,
  },
  urgent: {
    en: "Urgent",
    bn: "জরুরি",
    description_en: "Needed within a day or two.",
    description_bn: "এক-দুই দিনের মধ্যে প্রয়োজন।",
    sla_hours: 48,
  },
  routine: {
    en: "Planned",
    bn: "পরিকল্পিত",
    description_en: "For a scheduled surgery or a standing transfusion need.",
    description_bn: "নির্ধারিত অপারেশন বা নিয়মিত রক্ত সঞ্চালনের জন্য।",
    sla_hours: 168,
  },
};

export const STATUS_META: Record<
  RequestStatus,
  { en: string; bn: string; tone: "info" | "warning" | "success" | "muted" | "danger" }
> = {
  open: { en: "Searching", bn: "খোঁজ চলছে", tone: "info" },
  matching: { en: "Donor found", bn: "রক্তদাতা পাওয়া গেছে", tone: "warning" },
  fulfilled: { en: "Fulfilled", bn: "সম্পন্ন", tone: "success" },
  cancelled: { en: "Cancelled", bn: "বাতিল", tone: "muted" },
  expired: { en: "Expired", bn: "সময় শেষ", tone: "danger" },
};

/* -------------------------------------------------------------------------- */
/* Validation of the request form — the 5–7 answers v1 asked for               */
/* -------------------------------------------------------------------------- */

export interface RequestFormInput {
  blood_group_needed: string | null;
  component: string | null;
  units_needed: number | null;
  urgency: string | null;
  hospital_name: string | null;
  needed_by: string | null;
  reason: string | null;
  upazila_id: number | null;
  patient_name: string | null;
}

export interface FieldIssue {
  field: keyof RequestFormInput;
  en: string;
  bn: string;
}

/**
 * Validates the express/full request form. Every issue carries both languages
 * because the form is filled by a stressed family member, often on a phone, and
 * a single-language error is a dead end for half the country.
 */
export function validateRequestForm(
  input: RequestFormInput,
  onISO: string = todayISO()
): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (!input.blood_group_needed) {
    issues.push({
      field: "blood_group_needed",
      en: "Choose the blood group the patient needs.",
      bn: "রোগীর প্রয়োজনীয় রক্তের গ্রুপ নির্বাচন করুন।",
    });
  }

  if (!input.urgency || !["routine", "urgent", "critical"].includes(input.urgency)) {
    issues.push({
      field: "urgency",
      en: "Choose how soon the blood is needed.",
      bn: "কত দ্রুত রক্ত প্রয়োজন তা নির্বাচন করুন।",
    });
  }

  const units = input.units_needed ?? 0;
  if (!Number.isInteger(units) || units < 1) {
    issues.push({
      field: "units_needed",
      en: "Enter at least one unit (bag).",
      bn: "কমপক্ষে এক ইউনিট (ব্যাগ) লিখুন।",
    });
  } else if (units > 10) {
    issues.push({
      field: "units_needed",
      en: "For more than 10 units, contact the hospital blood bank directly.",
      bn: "১০ ইউনিটের বেশি প্রয়োজন হলে সরাসরি হাসপাতালের ব্লাড ব্যাংকে যোগাযোগ করুন।",
    });
  }

  if (!input.hospital_name || input.hospital_name.trim().length < 3) {
    issues.push({
      field: "hospital_name",
      en: "Name the hospital so a donor can find you.",
      bn: "হাসপাতালের নাম লিখুন যাতে রক্তদাতা আপনাকে খুঁজে পায়।",
    });
  }

  if (!input.upazila_id) {
    issues.push({
      field: "upazila_id",
      en: "Choose the upazila where the patient is.",
      bn: "রোগী যে উপজেলায় আছেন তা নির্বাচন করুন।",
    });
  }

  if (input.needed_by) {
    const target = Date.parse(`${input.needed_by.slice(0, 10)}T23:59:59Z`);
    const today = Date.parse(`${onISO}T00:00:00Z`);
    if (Number.isFinite(target) && target < today) {
      issues.push({
        field: "needed_by",
        en: "The date needed cannot be in the past.",
        bn: "প্রয়োজনের তারিখ অতীতে হতে পারে না।",
      });
    }
  }

  return issues;
}

/** Convenience for the "planned surgery next month" case in the UI copy. */
export function neededByCeiling(onISO: string = todayISO()): string {
  return addDays(onISO, 90);
}

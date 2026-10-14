/**
 * Proximity, rings, and ranking.
 *
 * The cascade is the product promise: "nearby first". Rings 0-2 are radial
 * (3 / 10 / 25 km). Ring 3 and beyond are administrative — upazila, district,
 * division, national — because in rural Bangladesh the nearest compatible donor
 * may be two unions away with no meaningful straight-line distance, and the
 * administrative answer is the one a person can actually act on.
 *
 * Mirrors `ring_radius_m`, `max_ring_for`, `distance_band_m` and the ranking
 * CTE in `0005_rpc_search.sql`.
 */

import type { DistanceBand, RequestUrgency } from "./types.ts";

/* -------------------------------------------------------------------------- */
/* Rings                                                                       */
/* -------------------------------------------------------------------------- */

export const RADIAL_RING_METRES: Record<0 | 1 | 2, number> = {
  0: 3_000,
  1: 10_000,
  2: 25_000,
};

export const RING_NAMES = [
  "0–3 km",
  "3–10 km",
  "10–25 km",
  "Upazila",
  "District",
  "Division",
  "National",
] as const;

/**
 * How far the cascade may widen, given urgency.
 *
 * A routine request does not get to SMS strangers nationally — the cost is real
 * money and the nuisance is real. A critical one does, because a life is at
 * stake and every rung has already failed.
 */
export function maxRingFor(urgency: RequestUrgency): 2 | 4 | 6 {
  switch (urgency) {
    case "routine":
      return 2;
    case "urgent":
      return 4;
    case "critical":
      return 6;
  }
}

/**
 * When a request stops widening. The ladder is time-driven, not just
 * distance-driven: ring 0 fires at creation, and each later rung fires on a
 * clock so a stalled request escalates on its own.
 */
export const RING_CADENCE_MINUTES: Record<RequestUrgency, readonly number[]> = {
  // [ring 0-1 at T+0, ring 2-3, ring 4-5 + admin, national, blood bank]
  routine: [0, 6 * 60, 24 * 60, 48 * 60, 96 * 60],
  urgent: [0, 15, 60, 4 * 60, 12 * 60],
  critical: [0, 15, 60, 4 * 60, 8 * 60],
};

/* -------------------------------------------------------------------------- */
/* Distance bands                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Coarse distance band for display.
 *
 * Sub-kilometre precision on a card that a stranger can read is a stalking aid.
 * A band is enough to decide whether to travel, which is the only decision the
 * card needs to support.
 */
export function distanceBand(metres: number | null | undefined): DistanceBand {
  if (metres === null || metres === undefined || !Number.isFinite(metres)) return "unknown";
  if (metres < 1_000) return "under_1km";
  if (metres < 3_000) return "1_3km";
  if (metres < 10_000) return "3_10km";
  if (metres < 25_000) return "10_25km";
  if (metres < 50_000) return "25_50km";
  return "far";
}

const BAND_LABELS: Record<DistanceBand, { en: string; bn: string }> = {
  under_1km: { en: "Under 1 km", bn: "১ কিমি-র কম" },
  "1_3km": { en: "1–3 km", bn: "১–৩ কিমি" },
  "3_10km": { en: "3–10 km", bn: "৩–১০ কিমি" },
  "10_25km": { en: "10–25 km", bn: "১০–২৫ কিমি" },
  "25_50km": { en: "25–50 km", bn: "২৫–৫০ কিমি" },
  far: { en: "Far", bn: "অনেক দূরে" },
  unknown: { en: "Distance unknown", bn: "দূরত্ব অজানা" },
};

export function bandLabel(band: DistanceBand): { en: string; bn: string } {
  // The live `search_nearby_donors` RPC has historically returned
  // non-canonical bands ('within_district', 'under_3km'). Never crash the
  // card on an unknown band — fall back to the neutral label instead.
  return BAND_LABELS[band as DistanceBand] ?? BAND_LABELS.unknown;
}

/** The band label a card actually renders: rounded km when we have it. */
export function distanceLabel(km: number | null, band: DistanceBand): { en: string; bn: string } {
  if (km !== null && Number.isFinite(km)) {
    const rounded = km < 1 ? km.toFixed(1) : Math.round(km).toString();
    return { en: `${rounded} km away`, bn: `${rounded} কিমি দূরে` };
  }
  return bandLabel(band);
}

/* -------------------------------------------------------------------------- */
/* Ranking weights — retunable without a deploy                                */
/* -------------------------------------------------------------------------- */

/**
 * The score is deliberately explicit and additive rather than a black box: a
 * user can see why one donor outranks another, and the medical team can retune
 * the weights from `app_config` without shipping code.
 *
 * Weights must sum to 1.0 across the positive terms so the score stays in [0,1]
 * before the warning penalty.
 */
export const SCORE_WEIGHTS = {
  /** Proximity, via an inverse-distance curve that saturates rather than spikes. */
  proximity: 0.45,
  /** Available and out of cooldown right now. */
  availability: 0.25,
  /** Blood group confirmed against a lab or the NID record. */
  verified: 0.15,
  /** Historical reliability, as a ratio of accepted to invited. */
  reliability: 0.1,
  /** Recency of last donation — a long gap is a mild positive. */
  recency: 0.05,
  /** Each soft warning costs this much. */
  warning_penalty: 0.1,
} as const;

/** Verified donors score this instead of 1.0 — unverified is not disqualifying. */
export const UNVERIFIED_FACTOR = 0.4;

/** Used when there is no distance at all (administrative rings only). */
export const NO_DISTANCE_PROXIMITY = 0.15;

/** Used when a donor has no response history to judge reliability from. */
export const NEUTRAL_RELIABILITY = 0.5;

export interface ScoreInput {
  metres: number | null;
  availableNow: boolean;
  verified: boolean;
  donatedCount12mo: number;
  declinedCount12mo: number;
  lastDonationDate: string | null;
  warningCount: number;
}

/**
 * The documented ranking score.
 *
 * Note what is NOT here: nothing derived from the donor's identity, their
 * address text, their name, or their reliability as a *person*. Reliability is
 * a ratio, never a public number — a public reliability score would punish
 * people for having emergencies of their own.
 */
export function scoreDonor(input: ScoreInput, todayISO: string): number {
  const proximity = (() => {
    if (input.metres === null || !Number.isFinite(input.metres)) return NO_DISTANCE_PROXIMITY;
    // The curve is already bounded by 1 for any real distance; the clamp only
    // bites on a malformed negative metre count, and it keeps the documented
    // [0, 1] invariant true for every input rather than almost every input.
    return Math.min(1, Math.max(0, 1 / (1 + input.metres / 1_000)));
  })();

  const availability = input.availableNow ? 1 : 0;
  const verified = input.verified ? 1 : UNVERIFIED_FACTOR;

  const invitations = input.donatedCount12mo + input.declinedCount12mo;
  const reliability =
    invitations > 0 ? input.donatedCount12mo / invitations : NEUTRAL_RELIABILITY;

  const recency = (() => {
    if (!input.lastDonationDate) return 1;
    const days = daysSince(input.lastDonationDate, todayISO);
    if (days === null) return 1;
    if (days > 365) return 1;
    if (days > 180) return 0.7;
    return 0.3;
  })();

  const raw =
    SCORE_WEIGHTS.proximity * proximity +
    SCORE_WEIGHTS.availability * availability +
    SCORE_WEIGHTS.verified * verified +
    SCORE_WEIGHTS.reliability * reliability +
    SCORE_WEIGHTS.recency * recency -
    SCORE_WEIGHTS.warning_penalty * (input.warningCount > 0 ? 1 : 0);

  // Round to 4dp so the client and Postgres agree on tie-breaks rather than
  // diverging on float noise.
  return Math.round(raw * 10_000) / 10_000;
}

function daysSince(iso: string, todayISO: string): number | null {
  const a = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${todayISO.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                     */
/* -------------------------------------------------------------------------- */

export interface RankableDonor {
  ring: number;
  score: number;
  /** Raw metres. Available inside a ring for tie-breaking, never rendered. */
  metres: number | null;
  donor_id: string;
}

/**
 * The exact ordering Postgres applies, reproduced client-side so an optimistic
 * re-sort after an interaction cannot disagree with the server:
 *
 *   ring asc  →  score desc  →  metres asc (nulls last)  →  id asc
 *
 * The final `id` term is not decoration: without a total order, two donors with
 * identical scores can swap places between renders and a user will tap the
 * wrong card.
 */
export function rankDonors<T extends RankableDonor>(donors: readonly T[]): T[] {
  return [...donors].sort((a, b) => {
    if (a.ring !== b.ring) return a.ring - b.ring;
    if (b.score !== a.score) return b.score - a.score;

    const am = a.metres;
    const bm = b.metres;
    if (am === null && bm === null) return a.donor_id < b.donor_id ? -1 : 1;
    if (am === null) return 1;
    if (bm === null) return -1;
    if (am !== bm) return am - bm;

    return a.donor_id < b.donor_id ? -1 : a.donor_id > b.donor_id ? 1 : 0;
  });
}

/**
 * Groups a ranked list into the ring headings the results view renders.
 * Rings that are empty are omitted — an empty "District" heading reads as a
 * bug, not as information.
 */
export function groupByRing<T extends { ring: number }>(
  donors: readonly T[]
): { ring: number; label: { en: string; bn: string }; items: T[] }[] {
  const byRing = new Map<number, T[]>();
  for (const d of donors) {
    const bucket = byRing.get(d.ring);
    if (bucket) bucket.push(d);
    else byRing.set(d.ring, [d]);
  }

  return [...byRing.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ring, items]) => ({ ring, label: ringLabel(ring), items }));
}

const RING_LABELS_BN = [
  "৩ কিমি-র মধ্যে",
  "১০ কিমি-র মধ্যে",
  "২৫ কিমি-র মধ্যে",
  "উপজেলায়",
  "জেলায়",
  "বিভাগে",
  "সারাদেশে",
];

export function ringLabel(ring: number): { en: string; bn: string } {
  const idx = Math.max(0, Math.min(ring, RING_NAMES.length - 1));
  return { en: RING_NAMES[idx] ?? RING_NAMES[RING_NAMES.length - 1]!, bn: RING_LABELS_BN[idx]! };
}

/* -------------------------------------------------------------------------- */
/* Geolocation                                                                 */
/* -------------------------------------------------------------------------- */

/** Great-circle distance in metres. Used client-side for the "nearest doctor" chip. */
export function haversineMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * How precise a stored location needs to be.
 *
 * We snap the user's point to ~1 km before it is sent for a *search*, because
 * the search needs a ring, not a doorstep. The exact point is used only for the
 * user's own display of how far they are from something.
 */
export function snapCoordinate(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export type LocationSource = "gps" | "manual" | "upazila";

/**
 * Search radius hint for the UI's "widen the search" control. Returns the km
 * the next rung adds, so the button can honestly say what it will do.
 */
export function nextRingRadiusKm(currentRing: number): number | null {
  const next = currentRing + 1;
  if (next > 6) return null;
  const metres = RADIAL_RING_METRES[next as 0 | 1 | 2];
  if (metres) return metres / 1_000;
  return null; // an administrative rung — no meaningful radius
}

/** Human text for what widening will do next. */
export function wideningLabel(currentRing: number): { en: string; bn: string } {
  const next = nextRingRadiusKm(currentRing);
  if (next !== null) {
    return {
      en: `Widen to ${next} km`,
      bn: `${next} কিমি পর্যন্ত বাড়ান`,
    };
  }
  const label = ringLabel(currentRing + 1);
  return { en: `Widen to ${label.en}`, bn: `${label.bn} পর্যন্ত বাড়ান` };
}

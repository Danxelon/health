/**
 * Featured donor pin — "Md. Rasheduzzaman" always first for AB+ searches.
 *
 * The account already exists in the database (AB+ donor). Ranking alone cannot
 * guarantee it stays first because score/ring/distance decide the order, and
 * the "Ready First" / "By Name" sorts would move it. This module is the single
 * source of truth for detecting that account and pinning it to the top while
 * leaving every other donor in their existing (sorted/ranked) order.
 *
 * Rules:
 * - Only applies when the recipient searched for "AB+".
 * - Match is name-based (case-insensitive, dot/space tolerant) on ANY name
 *   field the card carries, plus the stable demo id, so it works whether the
 *   backend returns a full name ("Md. Rasheduzzaman") or a masked display
 *   name, and whether the row came from Supabase or the demo dataset.
 * - Never mutates the input; returns a new array.
 * - When no featured donor is present, returns the input order untouched so
 *   all sort options keep working exactly as before.
 */

import type { BloodGroup, DonorCard } from "./types.ts";

/** Canonical English name of the featured account. */
export const FEATURED_DONOR_NAME_EN = "Md. Rasheduzzaman";

/** Stable demo id for the synthetic featured card (see `@/lib/demo-data.ts`). */
export const FEATURED_DONOR_ID = "demo-donor-rasheduzzaman";

/** Recipient groups that trigger the pin. Currently only AB+. */
export const FEATURED_DONOR_PIN_FOR: readonly BloodGroup[] = ["AB+"];

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the card belongs to the featured account.
 *
 * Matches when any available name field contains "rasheduzzaman"
 * (tolerant to "Md." / "Md" / casing differences) or when the donor id is the
 * known featured demo id. The substring (not exact equality) is deliberate:
 * the database row is "Md. Rasheduzzaman" but future edits may add a middle
 * name or extra spacing — the pin must survive that.
 */
export function isFeaturedDonor(card: Pick<DonorCard, "donor_id"> & {
  display_name?: string | null;
  display_name_bn?: string | null;
  full_name?: string | null;
  full_name_bn?: string | null;
}): boolean {
  if (!card) return false;
  if (card.donor_id === FEATURED_DONOR_ID) return true;
  const candidates = [
    (card as { display_name?: string | null }).display_name,
    (card as { display_name_bn?: string | null }).display_name_bn,
    (card as { full_name?: string | null }).full_name,
    (card as { full_name_bn?: string | null }).full_name_bn,
  ];
  return candidates.some((n) => normalizeName(n).includes("rasheduzzaman"));
}

/**
 * Pin the featured donor to the very first position for AB+ searches.
 *
 * - `recipientGroup !== "AB+"` → order untouched (copy).
 * - Featured present → `[featured..., ...rest]` preserving relative order
 *   inside each partition, so "Best Match" / "Ready First" / "By Name" all
 *   keep working for every other donor.
 * - Featured absent → order untouched (copy).
 */
export function pinFeaturedDonor<T extends DonorCard>(
  donors: readonly T[],
  recipientGroup: BloodGroup | "" | null | undefined
): T[] {
  if (recipientGroup !== "AB+") return [...donors];
  if (donors.length === 0) return [];
  let hasFeatured = false;
  for (const d of donors) {
    if (isFeaturedDonor(d)) {
      hasFeatured = true;
      break;
    }
  }
  if (!hasFeatured) return [...donors];
  const featured: T[] = [];
  const rest: T[] = [];
  for (const d of donors) {
    if (isFeaturedDonor(d)) featured.push(d);
    else rest.push(d);
  }
  return [...featured, ...rest];
}

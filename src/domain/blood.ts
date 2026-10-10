/**
 * Blood compatibility.
 *
 * This is not a heuristic or a preference ranking — it is the medicine, and it
 * is the single source of truth for the whole product. The counterpart in
 * Postgres (`public.can_donate`, `0004_rpc_core.sql`) is what actually decides
 * a match; this module exists so the UI can render the same answer instantly
 * without a round trip. If the two ever disagree, the database wins.
 *
 * The rule, stated once:
 *   ABO — the donor's antigens must not be foreign to the recipient.
 *         O → anyone · A → {A, AB} · B → {B, AB} · AB → {AB}
 *   Rh  — a negative donor may give to either recipient; a positive donor may
 *         only give to a positive recipient.
 */

import { BLOOD_GROUPS, type BloodComponent, type BloodGroup } from "./types.ts";

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

export interface ParsedBloodGroup {
  abo: "A" | "B" | "AB" | "O";
  rh: "+" | "-";
}

/**
 * Splits a blood group into its ABO and Rh parts.
 * "AB-" → { abo: "AB", rh: "-" }. Throws on anything unrecognised rather than
 * silently defaulting, because a wrong default here is a wrong transfusion.
 */
export function parseBloodGroup(group: BloodGroup): ParsedBloodGroup {
  const match = /^(A|B|AB|O)([+-])$/.exec(group);
  if (!match) {
    throw new Error(`unrecognised blood group: ${String(group)}`);
  }
  const [, abo, rh] = match as unknown as [string, "A" | "B" | "AB" | "O", "+" | "-"];
  return { abo, rh };
}

export function isBloodGroup(value: unknown): value is BloodGroup {
  return typeof value === "string" && (BLOOD_GROUPS as readonly string[]).includes(value);
}

/** Two-character chip label. Bengali users read the same symbols. */
export function bloodGroupLabel(group: BloodGroup): string {
  return group;
}

/* -------------------------------------------------------------------------- */
/* The matrix                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Can red cells / whole blood from `donor` be transfused into `recipient`?
 *
 * Exhaustive by construction: the ABO branch is a total function over the four
 * ABO types, so there is no path that returns `undefined`.
 */
export function canDonate(donor: BloodGroup, recipient: BloodGroup): boolean {
  const d = parseBloodGroup(donor);
  const r = parseBloodGroup(recipient);

  const aboOk = (() => {
    switch (d.abo) {
      case "O":
        return true;
      case "A":
        return r.abo === "A" || r.abo === "AB";
      case "B":
        return r.abo === "B" || r.abo === "AB";
      case "AB":
        return r.abo === "AB";
    }
  })();

  // Rh-negative blood is safe for both Rh types; Rh-positive blood is only
  // safe for an Rh-positive recipient.
  const rhOk = d.rh === "-" || r.rh === "+";

  return aboOk && rhOk;
}

/**
 * Every group that may give to `recipient`, in canonical order.
 * An AB+ recipient accepts all eight; an O− recipient accepts only O−.
 *
 * This is what donor search uses. Matching on string equality — the obvious
 * implementation, and the one v1 implied — would show an AB+ patient only AB+
 * donors and strand them during an emergency.
 */
export function acceptableDonorsFor(recipient: BloodGroup): BloodGroup[] {
  return BLOOD_GROUPS.filter((g) => canDonate(g, recipient));
}

/**
 * Every group `donor` may give to. Used on a donor's own dashboard to answer
 * "who can I help?" — the question that motivates a donor to keep the app.
 */
export function canDonateTo(donor: BloodGroup): BloodGroup[] {
  return BLOOD_GROUPS.filter((r) => canDonate(donor, r));
}

/** Recipients that a given donor is compatible with, as a Set for O(1) checks. */
export function recipientSetFor(donor: BloodGroup): Set<BloodGroup> {
  return new Set(canDonateTo(donor));
}

/* -------------------------------------------------------------------------- */
/* Component-aware compatibility                                               */
/* -------------------------------------------------------------------------- */

/**
 * Platelets and plasma do NOT follow the red-cell matrix.
 *
 * - Platelets: ABO compatibility is *inverted* in the direction that matters —
 *   a platelet unit carries plasma, so the recipient's antibodies attack the
 *   donor's plasma. Practically the rule is the mirror of red cells.
 * - Plasma: same inversion — the donor's plasma carries antibodies, so O plasma
 *   is the *worst* choice and AB plasma the universal one.
 * - PRBC: identical to whole blood, only the storage differs.
 *
 * This function decides whether two groups may meet for a given component. It
 * deliberately does NOT attempt to rank or govern the cooldown (that is
 * `cooldownDays` in eligibility.ts).
 */
export function compatibleForComponent(
  donor: BloodGroup,
  recipient: BloodGroup,
  component: BloodComponent
): boolean {
  switch (component) {
    case "whole_blood":
    case "prbc":
      return canDonate(donor, recipient);

    case "platelets":
    case "plasma": {
      // Antibody-mediated: the *recipient's* group must be acceptable to the
      // *donor's* plasma. A negative-Rh plasma unit is the safer direction.
      const d = parseBloodGroup(donor);
      const r = parseBloodGroup(recipient);

      const plasmaDirectionOk = (() => {
        switch (r.abo) {
          // Recipient is the universal plasma acceptor
          case "AB":
            return true;
          // Recipient has anti-B; donor plasma must not carry B antibodies
          case "A":
            return d.abo === "A" || d.abo === "AB";
          case "B":
            return d.abo === "B" || d.abo === "AB";
          // Recipient has both antibodies; only AB donor plasma is safe
          case "O":
            return d.abo === "AB";
        }
      })();

      // Rh matters for platelets only in the negative-donor direction.
      const rhOk = r.rh === "+" || d.rh === "-";

      return plasmaDirectionOk && rhOk;
    }
  }
}

/** Every donor group whose component donation is acceptable to `recipient`. */
export function acceptableDonorsForComponent(
  recipient: BloodGroup,
  component: BloodComponent
): BloodGroup[] {
  return BLOOD_GROUPS.filter((g) => compatibleForComponent(g, recipient, component));
}

/* -------------------------------------------------------------------------- */
/* Presentation helpers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Plain-language explanation of *why* a donor is or is not shown. Surfaced in
 * the UI so a user never has to trust a hidden ranking.
 */
export function explainCompatibility(
  donor: BloodGroup,
  recipient: BloodGroup
): { compatible: boolean; en: string; bn: string } {
  const compatible = canDonate(donor, recipient);

  if (compatible) {
    const d = parseBloodGroup(donor);
    if (d.abo === "O" && d.rh === "-") {
      return {
        compatible,
        en: `${donor} is the universal donor — compatible with every group.`,
        bn: `${donor} সার্বজনীন রক্তদাতা — সব গ্রুপের সাথে মানানসই।`,
      };
    }
    if (d.rh === "-") {
      return {
        compatible,
        en: `${donor} is Rh-negative, so it is safe for both Rh types.`,
        bn: `${donor} Rh-নেগেটিভ, তাই দুই Rh ধরনের জন্যই নিরাপদ।`,
      };
    }
    return {
      compatible,
      en: `${donor} can be given to a ${recipient} patient.`,
      bn: `${donor} রক্ত ${recipient} রোগীকে দেওয়া যাবে।`,
    };
  }

  return {
    compatible,
    en: `${donor} blood cannot be given to a ${recipient} patient.`,
    bn: `${donor} রক্ত ${recipient} রোগীকে দেওয়া যাবে না।`,
  };
}

/** Universal donor / recipient labels, used as badges on group chips. */
export function groupBadge(
  group: BloodGroup
): { en: string; bn: string } | null {
  if (group === "O-") return { en: "Universal donor", bn: "সার্বজনীন দাতা" };
  if (group === "AB+") return { en: "Universal recipient", bn: "সার্বজনীন গ্রহীতা" };
  return null;
}

/** Frequency ordering in Bangladesh, most common first — used for chip sorting. */
export const GROUP_PREVALENCE_BD: readonly BloodGroup[] = [
  "B+",
  "O+",
  "A+",
  "AB+",
  "B-",
  "O-",
  "A-",
  "AB-",
];

/** Rare groups get escalation priority: a plea for AB− travels further, sooner. */
export function isRareGroup(group: BloodGroup): boolean {
  return group.endsWith("-") || group === "AB+";
}

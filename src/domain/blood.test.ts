/**
 * Blood compatibility tests.
 *
 * This is the highest-stakes logic in the codebase. A bug here does not show a
 * wrong number — it clears a donor for a transfusion that could kill someone.
 * The matrix is therefore tested exhaustively: all 64 donor/recipient pairs,
 * each asserted individually against the published transfusion rules.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  acceptableDonorsFor,
  acceptableDonorsForComponent,
  canDonate,
  canDonateTo,
  compatibleForComponent,
  explainCompatibility,
  groupBadge,
  GROUP_PREVALENCE_BD,
  isBloodGroup,
  isRareGroup,
  parseBloodGroup,
} from "./blood.ts";
import { BLOOD_GROUPS, type BloodGroup } from "./types.ts";

describe("parseBloodGroup", () => {
  it("splits every group into abo and rh", () => {
    assert.deepEqual(parseBloodGroup("A+"), { abo: "A", rh: "+" });
    assert.deepEqual(parseBloodGroup("AB-"), { abo: "AB", rh: "-" });
    assert.deepEqual(parseBloodGroup("O+"), { abo: "O", rh: "+" });
  });

  it("throws rather than defaulting on an unknown group", () => {
    // A silent default here would be a silent wrong transfusion.
    assert.throws(() => parseBloodGroup("C+" as BloodGroup));
    assert.throws(() => parseBloodGroup("" as BloodGroup));
  });
});

describe("isBloodGroup", () => {
  it("accepts the eight canonical groups", () => {
    for (const g of BLOOD_GROUPS) assert.equal(isBloodGroup(g), true);
  });

  it("rejects near-misses and non-strings", () => {
    for (const bad of ["a+", "AB", "+", "O +", 8, null, undefined, {}]) {
      assert.equal(isBloodGroup(bad), false);
    }
  });
});

describe("canDonate — the full 64-pair matrix", () => {
  /**
   * The ground truth, written out longhand so the test does not merely
   * re-derive the implementation. Rows are donors, columns are recipients.
   *   A  = {A, AB} · B = {B, AB} · AB = {AB} · O = all
   *   Rh: negative donor → either recipient; positive donor → positive only
   */
  const EXPECTED: Record<BloodGroup, BloodGroup[]> = {
    "O-": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    "O+": ["A+", "B+", "AB+", "O+"],
    "A-": ["A+", "A-", "AB+", "AB-"],
    "A+": ["A+", "AB+"],
    "B-": ["B+", "B-", "AB+", "AB-"],
    "B+": ["B+", "AB+"],
    // Red cells only. (AB− plasma is the universal plasma donor — the inverse
    // rule lives in `compatibleForComponent`, not here.)
    "AB-": ["AB+", "AB-"],
    "AB+": ["AB+"],
  };

  for (const donor of BLOOD_GROUPS) {
    for (const recipient of BLOOD_GROUPS) {
      it(`${donor} → ${recipient}`, () => {
        const expected = EXPECTED[donor].includes(recipient);
        assert.equal(
          canDonate(donor, recipient),
          expected,
          `${donor} → ${recipient} should be ${expected}`
        );
      });
    }
  }

  it("names O− the universal donor and AB+ the universal recipient", () => {
    assert.equal(BLOOD_GROUPS.filter((r) => canDonate("O-", r)).length, 8);
    assert.equal(acceptableDonorsFor("AB+").length, 8);
    assert.deepEqual(canDonateTo("AB+"), ["AB+"]);
  });

  it("gives O− recipients exactly one option", () => {
    assert.deepEqual(acceptableDonorsFor("O-"), ["O-"]);
  });
});

describe("acceptableDonorsFor", () => {
  it("never includes a group that cannot actually donate", () => {
    // The invariant, checked for every recipient: whatever we return must pass
    // the same compatibility test used to build it.
    for (const recipient of BLOOD_GROUPS) {
      for (const donor of acceptableDonorsFor(recipient)) {
        assert.equal(canDonate(donor, recipient), true);
      }
    }
  });

  it("returns groups in canonical order", () => {
    assert.deepEqual(acceptableDonorsFor("AB+"), [...BLOOD_GROUPS]);
  });

  it("is the inverse of canDonateTo", () => {
    for (const donor of BLOOD_GROUPS) {
      for (const recipient of canDonateTo(donor)) {
        assert.ok(acceptableDonorsFor(recipient).includes(donor));
      }
    }
  });
});

describe("compatibleForComponent", () => {
  it("treats prbc exactly like whole blood", () => {
    for (const d of BLOOD_GROUPS) {
      for (const r of BLOOD_GROUPS) {
        assert.equal(compatibleForComponent(d, r, "prbc"), canDonate(d, r));
      }
    }
  });

  it("inverts the direction for plasma — AB is the universal plasma donor", () => {
    // The red-cell matrix says AB+ gives only to AB+. Plasma says the opposite:
    // AB plasma carries no anti-A or anti-B, so it suits every ABO recipient.
    for (const recipient of BLOOD_GROUPS) {
      assert.equal(compatibleForComponent("AB-", recipient, "plasma"), true);
    }
    // The Rh margin is kept conservatively for plasma: AB+ plasma reaches every
    // Rh-positive recipient, and is withheld from Rh-negative ones rather than
    // cleared. Plasma carries no red cells, so this refuses a donation that is
    // very likely safe — but it errs toward the patient, which is the only
    // direction this product is allowed to err in.
    for (const recipient of BLOOD_GROUPS) {
      assert.equal(compatibleForComponent("AB+", recipient, "plasma"), recipient.endsWith("+"));
    }
  });

  it("keeps O plasma away from non-O recipients", () => {
    // O plasma carries both antibodies; only an AB recipient can take it.
    assert.equal(compatibleForComponent("O-", "AB+", "plasma"), true);
    assert.equal(compatibleForComponent("O-", "A+", "plasma"), false);
    assert.equal(compatibleForComponent("O-", "O+", "plasma"), false);
  });

  it("mirrors the red-cell direction for platelets", () => {
    assert.equal(compatibleForComponent("A+", "AB+", "platelets"), true);
    assert.equal(compatibleForComponent("O-", "A+", "platelets"), false);
  });

  it("produces a non-empty donor set for every recipient and component", () => {
    for (const recipient of BLOOD_GROUPS) {
      for (const component of ["whole_blood", "prbc", "platelets", "plasma"] as const) {
        assert.ok(
          acceptableDonorsForComponent(recipient, component).length > 0,
          `no donor for ${recipient} / ${component}`
        );
      }
    }
  });
});

describe("explainCompatibility", () => {
  it("gives a bilingual sentence in both directions", () => {
    const yes = explainCompatibility("O-", "A+");
    assert.equal(yes.compatible, true);
    assert.ok(yes.en.length > 0 && yes.bn.length > 0);

    const no = explainCompatibility("A+", "O+");
    assert.equal(no.compatible, false);
    assert.ok(no.en.includes("cannot"));
    assert.ok(no.bn.length > 0);
  });

  it("calls out the universal donor when it applies", () => {
    assert.match(explainCompatibility("O-", "B+").en, /universal donor/);
  });

  it("agrees with canDonate for every pair", () => {
    for (const d of BLOOD_GROUPS) {
      for (const r of BLOOD_GROUPS) {
        assert.equal(explainCompatibility(d, r).compatible, canDonate(d, r));
      }
    }
  });
});

describe("badges and prevalence", () => {
  it("badges only the two universal groups", () => {
    assert.ok(groupBadge("O-"));
    assert.ok(groupBadge("AB+"));
    assert.equal(groupBadge("A+"), null);
  });

  it("lists all eight groups exactly once, most common first", () => {
    assert.equal(GROUP_PREVALENCE_BD.length, 8);
    assert.equal(new Set(GROUP_PREVALENCE_BD).size, 8);
    assert.equal(GROUP_PREVALENCE_BD[0], "B+");
  });

  it("treats every negative group as rare", () => {
    for (const g of BLOOD_GROUPS) {
      assert.equal(isRareGroup(g), g.endsWith("-") || g === "AB+");
    }
  });
});

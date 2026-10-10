/**
 * Eligibility tests.
 *
 * These are the assertions that decide whether a person is cleared to donate.
 * They are written against fixed reference dates so the suite does not change
 * meaning tomorrow, and they cover each hard block, each soft warning, and the
 * exact boundaries (17/18, 65/66, 49/50 kg) where an off-by-one costs a life.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ageInYears,
  addDays,
  canGiveNow,
  cooldownDaysRemaining,
  COOLDOWN_DAYS,
  daysBetween,
  evaluateEligibility,
  eligibilitySummary,
  HARD_BLOCKS,
  isEligible,
  isHardBlock,
  MAX_BACKDATED_DAYS,
  nextEligibleOn,
  reasonMessage,
  todayISO,
  validateExternalDonation,
} from "./eligibility.ts";
import type { EligibilityInput } from "./types.ts";

const TODAY = "2026-10-09";

/** A donor who passes every check, for use as the base of negative tests. */
function healthy(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    date_of_birth: "1995-06-15",
    weight_kg: 70,
    last_donation_date: "2026-01-01",
    temp_status: "available",
    notifications_enabled: true,
    chronic_conditions: null,
    medications: null,
    smoker: false,
    recent_illness: false,
    ...overrides,
  };
}

describe("date arithmetic", () => {
  it("computes age by calendar, not by millisecond division", () => {
    assert.equal(ageInYears("2008-10-10", "2026-10-09"), 17); // one day short
    assert.equal(ageInYears("2008-10-09", "2026-10-09"), 18); // birthday today
    assert.equal(ageInYears("2008-10-08", "2026-10-09"), 18);
    assert.equal(ageInYears("1960-01-01", "2026-10-09"), 66);
  });

  it("handles a 29 February birthday without rolling it forward", () => {
    // Born on a leap day: in a non-leap year they are still 17 on 28 February.
    assert.equal(ageInYears("2008-02-29", "2026-02-28"), 17);
    assert.equal(ageInYears("2008-02-29", "2026-03-01"), 18);
  });

  it("returns null for missing or absurd dates", () => {
    assert.equal(ageInYears(null, TODAY), null);
    assert.equal(ageInYears("not-a-date", TODAY), null);
    assert.equal(ageInYears("1800-01-01", TODAY), null); // age > 130
  });

  it("adds days across a month and a year boundary", () => {
    assert.equal(addDays("2026-01-31", 1), "2026-02-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });

  it("measures signed day differences", () => {
    assert.equal(daysBetween("2026-10-01", "2026-10-09"), 8);
    assert.equal(daysBetween("2026-10-09", "2026-10-01"), -8);
    assert.equal(daysBetween("2026-10-09", "2026-10-09"), 0);
  });

  it("todayISO is a plain date with no time component", () => {
    assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("cooldown", () => {
  it("uses the published interval per component", () => {
    assert.equal(COOLDOWN_DAYS.whole_blood, 90);
    assert.equal(COOLDOWN_DAYS.prbc, 90);
    assert.equal(COOLDOWN_DAYS.platelets, 14);
    assert.equal(COOLDOWN_DAYS.plasma, 28);
  });

  it("computes the next eligible date from the last donation", () => {
    assert.equal(nextEligibleOn("2026-01-01", "whole_blood"), "2026-04-01");
    assert.equal(nextEligibleOn("2026-01-01", "platelets"), "2026-01-15");
    assert.equal(nextEligibleOn(null, "whole_blood"), null);
  });

  it("counts remaining days, floored at zero", () => {
    assert.equal(cooldownDaysRemaining("2026-10-01", "platelets", TODAY), 6);
    assert.equal(cooldownDaysRemaining("2020-01-01", "whole_blood", TODAY), 0);
    assert.equal(cooldownDaysRemaining(null, "whole_blood", TODAY), null);
  });

  it("lets a platelet donor return far sooner than a whole-blood donor", () => {
    const last = "2026-09-01";
    assert.equal(isEligible(healthy({ last_donation_date: last }), "platelets", TODAY), true);
    assert.equal(isEligible(healthy({ last_donation_date: last }), "whole_blood", TODAY), false);
  });
});

describe("evaluateEligibility — hard blocks", () => {
  it("clears a healthy donor", () => {
    const result = evaluateEligibility(healthy(), "whole_blood", TODAY);
    assert.equal(result.eligible, true);
    assert.deepEqual(result.reasons, []);
  });

  it("blocks a 17-year-old but not an 18-year-old", () => {
    const young = evaluateEligibility(healthy({ date_of_birth: "2008-10-10" }), "whole_blood", TODAY);
    assert.equal(young.eligible, false);
    assert.ok(young.reasons.includes("age_too_young"));

    const justOldEnough = evaluateEligibility(
      healthy({ date_of_birth: "2008-10-09" }),
      "whole_blood",
      TODAY
    );
    assert.equal(justOldEnough.eligible, true);
  });

  it("blocks a 66-year-old but not a 65-year-old", () => {
    const old = evaluateEligibility(healthy({ date_of_birth: "1960-01-01" }), "whole_blood", TODAY);
    assert.equal(old.eligible, false);
    assert.ok(old.reasons.includes("age_too_old"));

    const atLimit = evaluateEligibility(
      healthy({ date_of_birth: "1961-01-01" }),
      "whole_blood",
      TODAY
    );
    assert.equal(atLimit.eligible, true);
    assert.equal(atLimit.age, 65);
  });

  it("blocks 49 kg but not 50 kg", () => {
    const light = evaluateEligibility(healthy({ weight_kg: 49 }), "whole_blood", TODAY);
    assert.equal(light.eligible, false);
    assert.ok(light.reasons.includes("underweight"));

    assert.equal(evaluateEligibility(healthy({ weight_kg: 50 }), "whole_blood", TODAY).eligible, true);
  });

  it("does not block on unknown weight — it asks instead", () => {
    // A missing weight must not silently read as "underweight"; the form asks.
    const result = evaluateEligibility(healthy({ weight_kg: null }), "whole_blood", TODAY);
    assert.equal(result.eligible, true);
    assert.equal(result.weight_kg, null);
  });

  it("blocks an active cooldown and reports the return date", () => {
    const result = evaluateEligibility(
      healthy({ last_donation_date: "2026-09-01" }),
      "whole_blood",
      TODAY
    );
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes("cooldown_active"));
    assert.equal(result.next_eligible_on, "2026-11-30");
  });

  it("does not block on the exact day the cooldown ends", () => {
    // 2026-07-11 + 90 days = 2026-10-09, i.e. today.
    const result = evaluateEligibility(
      healthy({ last_donation_date: "2026-07-11" }),
      "whole_blood",
      TODAY
    );
    assert.equal(result.eligible, true);
  });

  it("treats opted-out and manual cooldown as blocks", () => {
    const out = evaluateEligibility(healthy({ temp_status: "unavailable" }), "whole_blood", TODAY);
    assert.ok(out.reasons.includes("opted_out"));

    const manual = evaluateEligibility(healthy({ temp_status: "cooldown" }), "whole_blood", TODAY);
    assert.ok(manual.reasons.includes("manual_cooldown"));

    const muted = evaluateEligibility(
      healthy({ notifications_enabled: false }),
      "whole_blood",
      TODAY
    );
    assert.ok(muted.reasons.includes("opted_out"));
  });

  it("reports no_profile rather than throwing", () => {
    const result = evaluateEligibility(null, "whole_blood", TODAY);
    assert.equal(result.eligible, false);
    assert.deepEqual(result.reasons, ["no_profile"]);
  });
});

describe("evaluateEligibility — soft warnings", () => {
  it("stays eligible while surfacing each warning", () => {
    const result = evaluateEligibility(
      healthy({
        chronic_conditions: "Type 2 diabetes",
        medications: "Metformin",
        smoker: true,
        recent_illness: true,
      }),
      "whole_blood",
      TODAY
    );
    assert.equal(result.eligible, true);
    assert.deepEqual(result.soft_warnings.sort(), [
      "chronic_condition",
      "on_medication",
      "recent_illness",
      "smoker",
    ]);
  });

  it("ignores whitespace-only condition and medication text", () => {
    const result = evaluateEligibility(
      healthy({ chronic_conditions: "   ", medications: "\t\n" }),
      "whole_blood",
      TODAY
    );
    assert.deepEqual(result.soft_warnings, []);
  });

  it("separates hard blocks from soft warnings in one verdict", () => {
    const result = evaluateEligibility(
      healthy({ weight_kg: 45, smoker: true }),
      "whole_blood",
      TODAY
    );
    assert.equal(result.eligible, false);
    assert.deepEqual(result.soft_warnings, ["smoker"]);
    assert.ok(result.reasons.includes("underweight"));
  });
});

describe("canGiveNow — the strict reading", () => {
  it("is true only for an uncomplicated donor", () => {
    assert.equal(canGiveNow(healthy(), "whole_blood", TODAY), true);
    assert.equal(canGiveNow(healthy({ smoker: true }), "whole_blood", TODAY), false);
    assert.equal(canGiveNow(healthy({ weight_kg: 40 }), "whole_blood", TODAY), false);
  });
});

describe("reason and summary messages", () => {
  it("has a bilingual message for every reason it can emit", () => {
    const all = evaluateEligibility(
      healthy({
        date_of_birth: "2010-01-01",
        weight_kg: 40,
        last_donation_date: "2026-09-01",
        temp_status: "unavailable",
        notifications_enabled: false,
        chronic_conditions: "x",
        medications: "y",
        smoker: true,
        recent_illness: true,
      }),
      "whole_blood",
      TODAY
    );

    for (const reason of all.reasons) {
      const msg = reasonMessage(reason);
      assert.ok(msg.en.length > 0, `${reason} has no English message`);
      assert.ok(msg.bn.length > 0, `${reason} has no Bengali message`);
      // A hard block removes the donor; a soft warning only annotates them.
      // The classifier must agree with the message it just produced.
      assert.equal(isHardBlock(reason), (HARD_BLOCKS as readonly string[]).includes(reason));
    }
  });

  it("summarises a healthy donor, a warned donor and a blocked donor", () => {
    assert.match(eligibilitySummary(evaluateEligibility(healthy(), "whole_blood", TODAY)).en, /ready/);

    const warned = eligibilitySummary(
      evaluateEligibility(healthy({ smoker: true }), "whole_blood", TODAY)
    );
    assert.match(warned.en, /flags 1 item/);

    const blocked = eligibilitySummary(
      evaluateEligibility(healthy({ last_donation_date: "2026-09-01" }), "whole_blood", TODAY)
    );
    assert.match(blocked.en, /2026-11-30/);
  });

  it("counts plural warnings correctly", () => {
    const two = eligibilitySummary(
      evaluateEligibility(healthy({ smoker: true, recent_illness: true }), "whole_blood", TODAY)
    );
    assert.match(two.en, /2 items/);
  });
});

describe("validateExternalDonation", () => {
  it("accepts a sane past date", () => {
    assert.equal(validateExternalDonation("2026-08-01", TODAY).ok, true);
  });

  it("rejects the future, the far past, and malformed input", () => {
    const future = validateExternalDonation("2026-12-01", TODAY);
    assert.equal(future.ok, false);
    assert.equal(future.ok === false && future.code, "FUTURE");

    const old = validateExternalDonation("2024-01-01", TODAY);
    assert.equal(old.ok === false && old.code, "TOO_OLD");

    const bad = validateExternalDonation("09/10/2026", TODAY);
    assert.equal(bad.ok === false && bad.code, "MALFORMED");
  });

  it("accepts a donation exactly at the 12-month limit", () => {
    const edge = addDays(TODAY, -MAX_BACKDATED_DAYS);
    assert.equal(validateExternalDonation(edge, TODAY).ok, true);
    assert.equal(validateExternalDonation(addDays(edge, -1), TODAY).ok, false);
  });
});

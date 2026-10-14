/**
 * Featured donor pin tests — Md. Rasheduzzaman first for AB+.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  FEATURED_DONOR_ID,
  isFeaturedDonor,
  pinFeaturedDonor,
} from "./featured-donor.ts";
import type { DonorCard } from "./types.ts";

function mkCard(
  donor_id: string,
  name: string,
  overrides: Partial<DonorCard> = {}
): DonorCard {
  return {
    donor_id,
    display_name: name,
    full_name: name,
    full_name_bn: null,
    display_name_bn: null,
    blood_group: "AB+",
    blood_group_verified: true,
    distance_band: "1_3km",
    distance_km: 1.2,
    upazila_en: "Dhanmondi",
    upazila_bn: "ধানমন্ডি",
    district_en: "Dhaka",
    district_bn: "ঢাকা",
    ring: 0,
    available_now: true,
    can_give_now: true,
    soft_warnings: [],
    last_donation_band: "long_ago",
    score: 0.5,
    contact_mode: "on_unlock",
    ...overrides,
  };
}

describe("isFeaturedDonor", () => {
  it("matches the exact account name", () => {
    assert.equal(isFeaturedDonor(mkCard("x-1", "Md. Rasheduzzaman")), true);
  });

  it("is case / dot / space tolerant", () => {
    assert.equal(isFeaturedDonor(mkCard("x-2", "MD RASHEDUZZAMAN")), true);
    assert.equal(isFeaturedDonor(mkCard("x-3", "Md Rasheduzzaman")), true);
    assert.equal(
      isFeaturedDonor(mkCard("x-4", "  md.  rasheduzzaman  ")),
      true
    );
  });

  it("matches via full_name even when display_name is masked", () => {
    assert.equal(
      isFeaturedDonor(
        mkCard("x-5", "Md. R.", { full_name: "Md. Rasheduzzaman" })
      ),
      true
    );
  });

  it("matches the stable demo id", () => {
    assert.equal(
      isFeaturedDonor(mkCard(FEATURED_DONOR_ID, "Someone Else")),
      true
    );
  });

  it("does not match similar names like Rashedul", () => {
    assert.equal(isFeaturedDonor(mkCard("x-6", "Mir Rashedul Sikder")), false);
    assert.equal(isFeaturedDonor(mkCard("x-7", "Tanvir Ahmed Chowdhury")), false);
  });
});

describe("pinFeaturedDonor", () => {
  it("puts Md. Rasheduzzaman first for AB+ Best Match order", () => {
    const donors = [
      mkCard("a", "Tanvir Ahmed Chowdhury", { score: 0.9, ring: 0 }),
      mkCard("b", "Md. Rasheduzzaman", { score: 0.1, ring: 5 }),
      mkCard("c", "Nusrat Jahan Mim", { score: 0.8, ring: 0 }),
    ];
    const pinned = pinFeaturedDonor(donors, "AB+");
    assert.equal(pinned[0]!.donor_id, "b");
    assert.deepEqual(
      pinned.map((d) => d.donor_id),
      ["b", "a", "c"]
    );
  });

  it("keeps featured first after a Ready-First sort of the rest", () => {
    const donors = [
      mkCard("a", "Tanvir Ahmed Chowdhury", { can_give_now: true }),
      mkCard("b", "Md. Rasheduzzaman", { can_give_now: false }),
      mkCard("c", "Nusrat Jahan Mim", { can_give_now: true }),
    ];
    // Simulate Donors.tsx: sort rest by ready, then pin.
    const sorted = [...donors].sort(
      (x, y) => Number(y.can_give_now) - Number(x.can_give_now)
    );
    const pinned = pinFeaturedDonor(sorted, "AB+");
    assert.equal(pinned[0]!.display_name, "Md. Rasheduzzaman");
    // Rest stays ready-sorted.
    assert.deepEqual(
      pinned.slice(1).map((d) => d.donor_id),
      ["a", "c"]
    );
  });

  it("keeps featured first after a By-Name sort of the rest", () => {
    const donors = [
      mkCard("a", "Zahid Hasan Joy"),
      mkCard("b", "Md. Rasheduzzaman"),
      mkCard("c", "Ashraful Islam Rana"),
    ];
    const sorted = [...donors].sort((x, y) =>
      (x.full_name ?? "").localeCompare(y.full_name ?? "")
    );
    const pinned = pinFeaturedDonor(sorted, "AB+");
    assert.equal(pinned[0]!.donor_id, "b");
    assert.deepEqual(
      pinned.slice(1).map((d) => d.donor_id),
      ["c", "a"]
    );
  });

  it("does nothing for non-AB+ searches", () => {
    const donors = [
      mkCard("a", "Tanvir Ahmed Chowdhury"),
      mkCard("b", "Md. Rasheduzzaman"),
    ];
    for (const g of ["A+", "B+", "O+", "AB-", "O-"] as const) {
      const out = pinFeaturedDonor(donors, g);
      assert.deepEqual(out.map((d) => d.donor_id), ["a", "b"]);
    }
  });

  it("returns input order untouched when featured is absent", () => {
    const donors = [mkCard("a", "A"), mkCard("b", "B")];
    const out = pinFeaturedDonor(donors, "AB+");
    assert.deepEqual(out.map((d) => d.donor_id), ["a", "b"]);
  });

  it("does not mutate its input", () => {
    const donors = [mkCard("a", "A"), mkCard("b", "Md. Rasheduzzaman")];
    const snapshot = donors.map((d) => d.donor_id);
    pinFeaturedDonor(donors, "AB+");
    assert.deepEqual(donors.map((d) => d.donor_id), snapshot);
  });
});

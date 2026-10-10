/**
 * Proximity, ring and ranking tests.
 *
 * The ranking below is the one users actually feel: it decides whose name
 * appears first when someone is looking for blood. These tests pin the order,
 * pin every tie-break, and pin the boundaries where a metre decides a band.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  bandLabel,
  distanceBand,
  distanceLabel,
  groupByRing,
  haversineMetres,
  maxRingFor,
  nextRingRadiusKm,
  NO_DISTANCE_PROXIMITY,
  rankDonors,
  RING_CADENCE_MINUTES,
  ringLabel,
  scoreDonor,
  snapCoordinate,
  wideningLabel,
} from "./matching.ts";

const TODAY = "2026-10-09";

describe("distance bands", () => {
  it("places each boundary on the correct side", () => {
    assert.equal(distanceBand(0), "under_1km");
    assert.equal(distanceBand(999), "under_1km");
    assert.equal(distanceBand(1_000), "1_3km");
    assert.equal(distanceBand(2_999), "1_3km");
    assert.equal(distanceBand(3_000), "3_10km");
    assert.equal(distanceBand(9_999), "3_10km");
    assert.equal(distanceBand(10_000), "10_25km");
    assert.equal(distanceBand(24_999), "10_25km");
    assert.equal(distanceBand(25_000), "25_50km");
    assert.equal(distanceBand(49_999), "25_50km");
    assert.equal(distanceBand(50_000), "far");
  });

  it("treats a missing distance as unknown, not as zero", () => {
    // Reading null as "0 km, right next door" would rank a donor we cannot
    // locate above one we can.
    assert.equal(distanceBand(null), "unknown");
    assert.equal(distanceBand(undefined), "unknown");
    assert.equal(distanceBand(Number.NaN), "unknown");
  });

  it("renders km when known and a band when not, in both languages", () => {
    assert.match(distanceLabel(2.4, "1_3km").en, /2 km/);
    assert.equal(distanceLabel(0.4, "under_1km").en, "0.4 km away");
    assert.equal(distanceLabel(null, "unknown").bn, "দূরত্ব অজানা");
  });

  it("has a bilingual label for every band", () => {
    for (const band of [
      "under_1km",
      "1_3km",
      "3_10km",
      "10_25km",
      "25_50km",
      "far",
      "unknown",
    ] as const) {
      const label = bandLabel(band);
      assert.ok(label.en.length > 0, `${band} has no English label`);
      assert.ok(label.bn.length > 0, `${band} has no Bengali label`);
    }
  });
});

describe("ring policy", () => {
  it("caps the cascade by urgency", () => {
    assert.equal(maxRingFor("routine"), 2);
    assert.equal(maxRingFor("urgent"), 4);
    assert.equal(maxRingFor("critical"), 6);
  });

  it("lets urgency only ever widen the search, never narrow it", () => {
    assert.ok(maxRingFor("critical") > maxRingFor("urgent"));
    assert.ok(maxRingFor("urgent") > maxRingFor("routine"));
  });

  it("reports the next radial radius, then administrative rungs", () => {
    assert.equal(nextRingRadiusKm(0), 10);
    assert.equal(nextRingRadiusKm(1), 25);
    assert.equal(nextRingRadiusKm(2), null); // next rung is the upazila
    assert.equal(nextRingRadiusKm(6), null); // nothing left
  });

  it("labels rings and widening in both languages", () => {
    assert.match(ringLabel(0).en, /3 km/);
    assert.ok(ringLabel(4).bn.length > 0);
    assert.match(wideningLabel(0).en, /10 km/);
    assert.ok(wideningLabel(2).bn.length > 0);
  });

  it("keeps the ladder time-driven, with ring 0 firing immediately", () => {
    for (const cadence of Object.values(RING_CADENCE_MINUTES)) {
      assert.equal(cadence[0], 0);
      for (let i = 1; i < cadence.length; i += 1) {
        assert.ok(cadence[i]! >= cadence[i - 1]!, "cadence must never go backwards");
      }
    }
  });
});

describe("scoreDonor", () => {
  const base = {
    metres: 1_000,
    availableNow: true,
    verified: true,
    donatedCount12mo: 2,
    declinedCount12mo: 0,
    lastDonationDate: null,
    warningCount: 0,
  };

  it("prefers the closer donor, all else equal", () => {
    const near = scoreDonor({ ...base, metres: 500 }, TODAY);
    const far = scoreDonor({ ...base, metres: 20_000 }, TODAY);
    assert.ok(near > far, `near ${near} should beat far ${far}`);
  });

  it("prefers the available donor over the unavailable one", () => {
    const ready = scoreDonor({ ...base, availableNow: true }, TODAY);
    const resting = scoreDonor({ ...base, availableNow: false }, TODAY);
    assert.ok(ready > resting);
  });

  it("penalises soft warnings but never below zero", () => {
    const clean = scoreDonor(base, TODAY);
    const flagged = scoreDonor({ ...base, warningCount: 2 }, TODAY);
    assert.ok(flagged < clean);
    assert.ok(flagged >= 0);
  });

  it("stays inside [0, 1] across the whole input space", () => {
    const variants = [
      { metres: null, availableNow: false, verified: false, donatedCount12mo: 0, declinedCount12mo: 99, lastDonationDate: "2026-10-01", warningCount: 4 },
      { metres: 0, availableNow: true, verified: true, donatedCount12mo: 99, declinedCount12mo: 0, lastDonationDate: null, warningCount: 0 },
      { ...base, metres: Number.NaN },
      { ...base, metres: -50 },
    ];
    for (const v of variants) {
      const s = scoreDonor(v, TODAY);
      assert.ok(s >= 0 && s <= 1, `score out of range: ${s}`);
    }
  });

  it("uses the documented neutral values, not zero, when data is absent", () => {
    const noDistance = scoreDonor({ ...base, metres: null }, TODAY);
    const noHistory = scoreDonor({ ...base, donatedCount12mo: 0, declinedCount12mo: 0 }, TODAY);
    assert.ok(noDistance > 0);
    assert.ok(noHistory > 0);
    assert.equal(NO_DISTANCE_PROXIMITY, 0.15);
  });

  it("does not let a long-ago donation outrank a ready near donor", () => {
    const near = scoreDonor({ ...base, metres: 300, lastDonationDate: "2026-09-01" }, TODAY);
    const far = scoreDonor({ ...base, metres: 24_000, lastDonationDate: null }, TODAY);
    assert.ok(near > far, "recency must not outweigh proximity");
  });

  it("treats an unverified donor as a discount, not a disqualification", () => {
    // An unverified donor still outscores nobody-at-all; verification is a
    // nudge, never a gate.
    const unverified = scoreDonor({ ...base, verified: false }, TODAY);
    assert.ok(unverified > 0);
    assert.ok(unverified < scoreDonor(base, TODAY));
  });
});

describe("rankDonors", () => {
  const mk = (id: string, ring: number, score: number, metres: number | null = null) => ({
    donor_id: id,
    ring,
    score,
    metres,
  });

  it("orders by ring first, then score", () => {
    const ranked = rankDonors([mk("c", 2, 0.9), mk("a", 0, 0.1), mk("b", 1, 0.5)]);
    assert.deepEqual(ranked.map((d) => d.donor_id), ["a", "b", "c"]);
  });

  it("breaks score ties on raw distance", () => {
    const ranked = rankDonors([mk("far", 0, 0.8, 2_000), mk("near", 0, 0.8, 500)]);
    assert.deepEqual(ranked.map((d) => d.donor_id), ["near", "far"]);
  });

  it("puts donors with no distance last inside a ring, not first", () => {
    const ranked = rankDonors([mk("unknown", 0, 0.8, null), mk("known", 0, 0.8, 9_000)]);
    assert.deepEqual(ranked.map((d) => d.donor_id), ["known", "unknown"]);
  });

  it("is a total order — identical entries never swap between sorts", () => {
    const a = rankDonors([mk("x", 0, 0.5, null), mk("y", 0, 0.5, null)]);
    const b = rankDonors([mk("y", 0, 0.5, null), mk("x", 0, 0.5, null)]);
    assert.deepEqual(a.map((d) => d.donor_id), b.map((d) => d.donor_id));
  });

  it("does not mutate its input", () => {
    const input = [mk("b", 1, 0.2), mk("a", 0, 0.1)];
    const snapshot = input.map((d) => d.donor_id);
    rankDonors(input);
    assert.deepEqual(input.map((d) => d.donor_id), snapshot);
  });

  it("carries every field through untouched", () => {
    // The caller renders these rows directly; a sort that rebuilt the objects
    // would silently drop fields the card needs.
    const input = [{ ...mk("a", 0, 0.1, 100), extra: "kept" }];
    const ranked = rankDonors(input);
    assert.equal(ranked[0]!.extra, "kept");
  });
});

describe("groupByRing", () => {
  it("omits empty rings rather than rendering an empty heading", () => {
    const groups = groupByRing([
      { ring: 0, id: "a" },
      { ring: 0, id: "b" },
      { ring: 4, id: "c" },
    ]);
    assert.deepEqual(groups.map((g) => g.ring), [0, 4]);
    assert.equal(groups[0]!.items.length, 2);
  });

  it("labels each group bilingually", () => {
    const groups = groupByRing([{ ring: 3, id: "a" }]);
    assert.ok(groups[0]!.label.en.length > 0);
    assert.ok(groups[0]!.label.bn.length > 0);
  });

  it("preserves the incoming order within a ring", () => {
    // groupByRing is a grouping, not a second sort — re-ranking here would
    // fight the ranking the server already applied.
    const groups = groupByRing([
      { ring: 0, id: "second" },
      { ring: 0, id: "first" },
    ]);
    assert.deepEqual(groups[0]!.items.map((i) => i.id), ["second", "first"]);
  });

  it("returns nothing for nothing", () => {
    assert.deepEqual(groupByRing([]), []);
  });
});

describe("geolocation helpers", () => {
  it("measures a known distance within tolerance", () => {
    // Dhaka (23.8103, 90.4125) to Chattogram (22.3569, 91.7832) ≈ 216 km.
    const km =
      haversineMetres({ lat: 23.8103, lng: 90.4125 }, { lat: 22.3569, lng: 91.7832 }) / 1_000;
    assert.ok(km > 200 && km < 235, `unexpected distance: ${km}`);
  });

  it("is zero for an identical point and symmetric", () => {
    const p = { lat: 24.0, lng: 90.0 };
    assert.equal(haversineMetres(p, p), 0);
    const q = { lat: 23.0, lng: 91.0 };
    assert.equal(haversineMetres(p, q), haversineMetres(q, p));
  });

  it("snaps coordinates to roughly a kilometre", () => {
    assert.equal(snapCoordinate(23.81031, 2), 23.81);
    assert.equal(snapCoordinate(90.41258, 2), 90.41);
  });
});

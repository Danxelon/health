import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  VERIFIED_BLOOD_BANKS,
  getStockStatus,
  getStockStatusMeta,
  formatDialableHotline,
  formatStockUnits,
  filterBloodBanks,
  getEmergencyShortageRadar,
  getDistrictsForDivision,
  DIVISIONS,
} from "./blood-banks.ts";
import { BLOOD_GROUPS } from "./types.ts";

describe("blood bank directory & emergency shortage radar domain", () => {
  it("determines correct stock status categories", () => {
    assert.equal(getStockStatus(0), "critical");
    assert.equal(getStockStatus(4), "critical");
    assert.equal(getStockStatus(5), "moderate");
    assert.equal(getStockStatus(14), "moderate");
    assert.equal(getStockStatus(15), "surplus");
    assert.equal(getStockStatus(42), "surplus");
  });

  it("provides bilingual status labels and badge meta", () => {
    const critBn = getStockStatusMeta("critical", "bn");
    const critEn = getStockStatusMeta("critical", "en");
    assert.equal(critBn.label, "সংকটপূর্ণ");
    assert.equal(critEn.label, "Critical Shortage");
    assert.ok(critBn.badgeClass.includes("red"));

    const modBn = getStockStatusMeta("moderate", "bn");
    const modEn = getStockStatusMeta("moderate", "en");
    assert.equal(modBn.label, "সীমিত");
    assert.equal(modEn.label, "Moderate");
    assert.ok(modBn.badgeClass.includes("amber"));

    const surBn = getStockStatusMeta("surplus", "bn");
    const surEn = getStockStatusMeta("surplus", "en");
    assert.equal(surBn.label, "পর্যাপ্ত");
    assert.equal(surEn.label, "Surplus");
    assert.ok(surBn.badgeClass.includes("emerald"));
  });

  it("formats dialable hotline href with tel: prefix and digits", () => {
    assert.equal(formatDialableHotline("+8801819284851"), "tel:+8801819284851");
    assert.equal(formatDialableHotline("02-9116563"), "tel:029116563");
    assert.equal(formatDialableHotline("+880 1714-010869"), "tel:+8801714010869");
  });

  it("formats stock units bilingually", () => {
    assert.equal(formatStockUnits(18, "bn"), "১৮ ব্যাগ");
    assert.equal(formatStockUnits(1, "en"), "1 bag");
    assert.equal(formatStockUnits(18, "en"), "18 bags");
  });

  it("contains all required institutional blood banks with all 8 blood groups", () => {
    assert.ok(VERIFIED_BLOOD_BANKS.length >= 7);

    // Verify key institutional blood banks exist
    const names = VERIFIED_BLOOD_BANKS.map((b) => b.name_en);
    assert.ok(names.some((n) => n.includes("Red Crescent")));
    assert.ok(names.some((n) => n.includes("Quantum")));
    assert.ok(names.some((n) => n.includes("Dhaka Medical College Hospital")));
    assert.ok(names.some((n) => n.includes("Sir Salimullah")));
    assert.ok(names.some((n) => n.includes("Chittagong Medical")));
    assert.ok(names.some((n) => n.includes("Rajshahi Sadar")));
    assert.ok(names.some((n) => n.includes("Rangpur Medical")));

    // Verify each bank has all 8 blood groups with non-negative stock numbers
    for (const bank of VERIFIED_BLOOD_BANKS) {
      assert.ok(bank.id);
      assert.ok(bank.name_en && bank.name_bn);
      assert.ok(bank.district_en && bank.district_bn);
      assert.ok(bank.division_en && bank.division_bn);
      assert.ok(bank.address_en && bank.address_bn);
      assert.ok(bank.hotline);
      assert.equal(bank.verified, true);

      for (const group of BLOOD_GROUPS) {
        assert.ok(group in bank.stocks, `Missing group ${group} in ${bank.name_en}`);
        assert.ok(typeof bank.stocks[group] === "number" && bank.stocks[group] >= 0);
      }
    }
  });

  it("filters blood banks by division and district", () => {
    const dhakaBanks = filterBloodBanks(VERIFIED_BLOOD_BANKS, { division: "Dhaka" });
    assert.ok(dhakaBanks.length >= 4);
    assert.ok(dhakaBanks.every((b) => b.division_en === "Dhaka"));

    const ctgBanks = filterBloodBanks(VERIFIED_BLOOD_BANKS, { division: "Chattogram" });
    assert.ok(ctgBanks.length >= 1);
    assert.ok(ctgBanks.every((b) => b.division_en === "Chattogram"));

    const rajshahiDistrict = filterBloodBanks(VERIFIED_BLOOD_BANKS, { district: "Rajshahi" });
    assert.ok(rajshahiDistrict.length >= 1);
    assert.ok(rajshahiDistrict.every((b) => b.district_en === "Rajshahi"));
  });

  it("filters blood banks by search term across name and address", () => {
    const quantum = filterBloodBanks(VERIFIED_BLOOD_BANKS, { search: "Quantum" });
    assert.equal(quantum.length, 1);
    assert.ok(quantum[0]?.name_en.includes("Quantum"));

    const mohammadpur = filterBloodBanks(VERIFIED_BLOOD_BANKS, { search: "Mohammadpur" });
    assert.ok(mohammadpur.length >= 1);
    assert.ok(mohammadpur[0]?.address_en.includes("Mohammadpur"));

    const bnSearch = filterBloodBanks(VERIFIED_BLOOD_BANKS, { search: "রেড ক্রিসেন্ট" });
    assert.equal(bnSearch.length, 1);
  });

  it("filters by specific blood group and shortageOnly flag", () => {
    const oNegShortage = filterBloodBanks(VERIFIED_BLOOD_BANKS, {
      bloodGroup: "O-",
      shortageOnly: true,
    });
    assert.ok(oNegShortage.length > 0);
    assert.ok(oNegShortage.every((b) => getStockStatus(b.stocks["O-"]) === "critical"));
  });

  it("calculates emergency shortage radar metrics correctly", () => {
    const radar = getEmergencyShortageRadar(VERIFIED_BLOOD_BANKS);
    assert.equal(radar.totalBanks, VERIFIED_BLOOD_BANKS.length);
    assert.ok(radar.banksWithCriticalShortage > 0);
    assert.ok(radar.deficits.length > 0);

    // Negative groups (Rh-) should have prominent shortage alerts
    assert.ok(radar.criticalGroupCounts["O-"] > 0);
    assert.ok(radar.criticalGroupCounts["AB-"] > 0);
  });

  it("cascades districts for selected division", () => {
    const allDistricts = getDistrictsForDivision();
    assert.ok(allDistricts.length > 5);

    const dhakaDistricts = getDistrictsForDivision("Dhaka");
    assert.ok(dhakaDistricts.every((d) => d.division_en === "Dhaka"));
    assert.ok(dhakaDistricts.some((d) => d.en === "Dhaka"));
  });

  it("has bilingual coverage for all divisions", () => {
    for (const div of DIVISIONS) {
      assert.ok(div.en && div.bn);
    }
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getAnonymousDonorLabel,
  getApproximateArea,
  getApproximateDistance,
  getIvrPromptScript,
  POPULAR_HOSPITALS,
} from "./donor-privacy.ts";

describe("donor privacy and anonymous identification", () => {
  it("formats anonymous donor ID with padding in Bengali and English", () => {
    assert.equal(getAnonymousDonorLabel({ donor_id: "demo-donor-4" }, "bn"), "রক্তদাতা #D-০৪");
    assert.equal(getAnonymousDonorLabel({ donor_id: "demo-donor-4" }, "en"), "Donor #D-04");

    assert.equal(getAnonymousDonorLabel({ donor_id: "demo-donor-42" }, "bn"), "রক্তদাতা #D-৪২");
    assert.equal(getAnonymousDonorLabel({ donor_id: "demo-donor-42" }, "en"), "Donor #D-42");
  });

  it("handles UUID or non-numeric donor IDs safely", () => {
    const donor = { donor_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" };
    const labelBn = getAnonymousDonorLabel(donor, "bn");
    const labelEn = getAnonymousDonorLabel(donor, "en");

    assert.ok(labelBn.startsWith("রক্তদাতা #D-"));
    assert.ok(labelEn.startsWith("Donor #D-"));
    // Last 4 characters should be extracted
    assert.ok(labelEn.includes("CB6D"));
  });

  it("never exposes raw names in anonymous labels", () => {
    const donor = {
      donor_id: "demo-donor-12",
      full_name: "Farhan Ishrak Sheikh",
      display_name: "Farhan I.",
    };
    const label = getAnonymousDonorLabel(donor, "en");
    assert.ok(!label.includes("Farhan"));
    assert.ok(!label.includes("Ishrak"));
    assert.ok(!label.includes("Sheikh"));
    assert.equal(label, "Donor #D-12");
  });
});

describe("approximate locality and distance protection", () => {
  it("returns general locality (upazila and district) without street address", () => {
    const donor = {
      upazila_bn: "মিরপুর",
      district_bn: "ঢাকা",
      upazila_en: "Mirpur",
      district_en: "Dhaka",
    };

    assert.equal(getApproximateArea(donor, "bn"), "মিরপুর, ঢাকা");
    assert.equal(getApproximateArea(donor, "en"), "Mirpur, Dhaka");
  });

  it("handles missing locality fields gracefully with fallback", () => {
    const emptyDonor = {};
    assert.equal(getApproximateArea(emptyDonor, "bn"), "নিকটস্থ এলাকা");
    assert.equal(getApproximateArea(emptyDonor, "en"), "Nearby Area");
  });

  it("formats approximate distance with tilde prefix in both languages", () => {
    assert.equal(getApproximateDistance(2.4, "bn"), "~২.৪ কিমি");
    assert.equal(getApproximateDistance(2.4, "en"), "~2.4 km");

    assert.equal(getApproximateDistance(0.8, "bn"), "~০.৮ কিমি");
    assert.equal(getApproximateDistance(0.8, "en"), "~0.8 km");

    assert.equal(getApproximateDistance(null, "bn"), "নিকটবর্তী দূরত্ব");
    assert.equal(getApproximateDistance(null, "en"), "Nearby");
  });
});

describe("automated IVR consent call script", () => {
  it("contains emergency blood group, hospital name and press 1 instruction in Bengali", () => {
    const scriptBn = getIvrPromptScript("O+", "ঢাকা মেডিকেল কলেজ হাসপাতাল", "bn");
    assert.ok(scriptBn.includes("O+"));
    assert.ok(scriptBn.includes("ঢাকা মেডিকেল কলেজ হাসপাতাল"));
    assert.ok(scriptBn.includes("সম্মতি দিতে আপনার ফোনে ১ চাপুন"));
    assert.ok(scriptBn.includes("১৬২৬৩") || scriptBn.includes("MediLink"));
  });

  it("contains emergency blood group, hospital name and press 1 instruction in English", () => {
    const scriptEn = getIvrPromptScript("AB+", "Dhaka Medical College Hospital", "en");
    assert.ok(scriptEn.includes("AB+"));
    assert.ok(scriptEn.includes("Dhaka Medical College Hospital"));
    assert.ok(scriptEn.includes("Press 1 to consent"));
    assert.ok(scriptEn.includes("MediLink Health Network"));
  });

  it("provides popular hospital options for simulated consent calls", () => {
    assert.ok(POPULAR_HOSPITALS.length >= 5);
    assert.ok(POPULAR_HOSPITALS.some((h) => h.bn.includes("ঢাকা মেডিকেল")));
    assert.ok(POPULAR_HOSPITALS.some((h) => h.bn.includes("বঙ্গবন্ধু")));
  });
});

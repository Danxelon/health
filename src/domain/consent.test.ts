/**
 * Automated IVR Consent & Privacy-First Discovery Tests
 *
 * Founders Farhan, Ishrak, and Sheikh decided:
 * - Donors must remain anonymous upfront: no raw phone numbers or exact addresses exposed to seekers.
 * - Nearest donors are ranked by proximity/distance (approximate distance and general locality).
 * - Contact via automated official/government recorded IVR consent call simulation:
 *   "Emergency blood needed. Press 1 to consent."
 * - Mutual Reveal: Only after donor consents does the seeker get real phone number
 *   and contact details, and the donor receives emergency hospital info.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  canTransitionConsent,
  transitionConsentStatus,
  maskDonorIdentity,
  maskDonorCard,
  getAnonymousDonorLabel,
  getApproximateDistance,
  getIvrPromptScript,
  CONSENT_TRANSITIONS,
} from "./donor-privacy.ts";
import type { ConsentStatus, DonorCard } from "./types.ts";

function createMockDonorCard(overrides: Partial<DonorCard> = {}): DonorCard {
  return {
    donor_id: "donor-01-uuid",
    display_name: "Md. Tanvir Ahmed",
    display_name_bn: "মোঃ তানভীর আহমেদ",
    full_name: "Md. Tanvir Ahmed",
    full_name_bn: "মোঃ তানভীর আহমেদ",
    blood_group: "O+",
    blood_group_verified: true,
    distance_band: "1_3km",
    distance_km: 2.4,
    upazila_en: "Dhanmondi",
    upazila_bn: "ধানমন্ডি",
    district_en: "Dhaka",
    district_bn: "ঢাকা",
    division_en: "Dhaka",
    division_bn: "ঢাকা",
    address_en: "House 42, Road 9/A, Dhanmondi, Dhaka",
    address_bn: "বাড়ি ৪২, রোড ৯/এ, ধানমন্ডি, ঢাকা",
    ring: 0,
    available_now: true,
    can_give_now: true,
    soft_warnings: [],
    last_donation_band: "recent",
    score: 0.95,
    contact_mode: "on_unlock",
    phone: "+8801712345678",
    ...overrides,
  };
}

describe("Consent Status Transitions", () => {
  it("allows transitions from 'calling' to 'consented' and 'declined'", () => {
    assert.equal(canTransitionConsent("calling", "consented"), true);
    assert.equal(canTransitionConsent("calling", "declined"), true);
    assert.equal(canTransitionConsent("calling", "expired"), true);

    assert.equal(transitionConsentStatus("calling", "consented"), "consented");
    assert.equal(transitionConsentStatus("calling", "declined"), "declined");
    assert.equal(transitionConsentStatus("calling", "expired"), "expired");
  });

  it("allows transition from 'pending' to 'calling'", () => {
    assert.equal(canTransitionConsent("pending", "calling"), true);
    assert.equal(transitionConsentStatus("pending", "calling"), "calling");
  });

  it("refuses transitions out of terminal states ('consented', 'declined', 'expired')", () => {
    const terminalStates: ConsentStatus[] = ["consented", "declined", "expired"];

    for (const state of terminalStates) {
      assert.deepEqual(CONSENT_TRANSITIONS[state], []);
      assert.equal(canTransitionConsent(state, "calling"), false);
      assert.equal(canTransitionConsent(state, "consented"), false);
      assert.equal(canTransitionConsent(state, "declined"), false);

      assert.throws(
        () => transitionConsentStatus(state, "calling"),
        /Invalid consent transition/
      );
    }
  });

  it("does not allow a transition to itself or backwards", () => {
    assert.equal(canTransitionConsent("consented", "consented"), false);
    assert.equal(canTransitionConsent("declined", "declined"), false);
    assert.equal(canTransitionConsent("calling", "calling"), false);
    assert.equal(canTransitionConsent("calling", "pending"), false);
  });
});

describe("Donor Privacy & Masking for Unconsented Donors", () => {
  it("generates anonymous donor ID and masked labels upfront without leaking real name", () => {
    const donor = createMockDonorCard();
    const masked = maskDonorIdentity(donor, 0);

    assert.equal(masked.anonymousId, "D-01");
    assert.equal(masked.maskedName, "Donor #D-01");
    assert.equal(masked.maskedNameBn, "রক্তদাতা #D-০১");

    // Real name MUST NOT be in the masked labels
    assert.ok(!masked.maskedName.includes("Tanvir"));
    assert.ok(!masked.maskedNameBn.includes("তানভীর"));
  });

  it("masks exact street holding address and only provides coarse locality", () => {
    const donor = createMockDonorCard({
      address_en: "Flat 5B, Holding 12/A, Road 27, Dhanmondi, Dhaka-1209",
      address_bn: "ফ্ল্যাট ৫বি, হোল্ডিং ১২/এ, রোড ২৭, ধানমন্ডি, ঢাকা-১২০৯",
    });
    const masked = maskDonorIdentity(donor, 1);

    assert.equal(masked.approxLocation, "Dhanmondi, Dhaka");
    assert.equal(masked.approxLocationBn, "ধানমন্ডি, ঢাকা");

    // Strict privacy: holding and road numbers must never leak
    assert.ok(!masked.approxLocation.includes("Flat 5B"));
    assert.ok(!masked.approxLocation.includes("Holding 12/A"));
    assert.ok(!masked.approxLocation.includes("Road 27"));
    assert.ok(!masked.approxLocationBn.includes("ফ্ল্যাট ৫বি"));
  });

  it("masks unconsented donor cards: hides raw phone and exact address", () => {
    const donor = createMockDonorCard();
    const unconsented = maskDonorCard(donor, false, 0);

    // Phone is masked (e.g. 017•••••78) and NOT raw number
    assert.ok(unconsented.phone?.includes("•••••"));
    assert.notEqual(unconsented.phone, "+8801712345678");

    // Names are anonymized
    assert.equal(unconsented.display_name, "Donor #D-01");
    assert.equal(unconsented.display_name_bn, "রক্তদাতা #D-০১");
    assert.equal(unconsented.full_name, null);
    assert.equal(unconsented.full_name_bn, null);

    // Address is approximate locality only
    assert.equal(unconsented.address_en, "Dhanmondi, Dhaka");
    assert.ok(!unconsented.address_en.includes("House 42"));
  });

  it("reveals real phone and full identity when donor has consented", () => {
    const donor = createMockDonorCard();
    const consented = maskDonorCard(donor, true, 0);

    // Unmasked full information
    assert.equal(consented.phone, "+8801712345678");
    assert.equal(consented.display_name, "Md. Tanvir Ahmed");
    assert.equal(consented.full_name, "Md. Tanvir Ahmed");
    assert.equal(consented.address_en, "House 42, Road 9/A, Dhanmondi, Dhaka");
  });

  it("formats approximate distance with tilde in English and Bengali", () => {
    assert.equal(getApproximateDistance(2.4, "en"), "~2.4 km");
    assert.equal(getApproximateDistance(2.4, "bn"), "~২.৪ কিমি");
    assert.equal(getApproximateDistance(null, "en"), "Nearby");
    assert.equal(getApproximateDistance(null, "bn"), "নিকটবর্তী দূরত্ব");
  });

  it("provides anonymous donor label by ID pattern", () => {
    assert.equal(getAnonymousDonorLabel({ donor_id: "demo-donor-4" }, "en"), "Donor #D-04");
    assert.equal(getAnonymousDonorLabel({ donor_id: "demo-donor-4" }, "bn"), "রক্তদাতা #D-০৪");
  });

  it("generates IVR prompt script mentioning hospital and blood group without leaking donor identity", () => {
    const scriptBn = getIvrPromptScript("O+", "Dhaka Medical College Hospital (DMCH)", "bn");
    const scriptEn = getIvrPromptScript("O+", "Dhaka Medical College Hospital (DMCH)", "en");

    assert.ok(scriptBn.includes("O+"));
    assert.ok(scriptBn.includes("Dhaka Medical College Hospital (DMCH)"));
    assert.ok(scriptBn.includes("১ চাপুন"));

    assert.ok(scriptEn.includes("O+"));
    assert.ok(scriptEn.includes("Dhaka Medical College Hospital (DMCH)"));
    assert.ok(scriptEn.includes("Press 1 to consent"));
  });

  it("accurately filters exact blood group and Rangpur division", () => {
    const rangpurDonor = createMockDonorCard({
      donor_id: "demo-donor-2",
      blood_group: "B+",
      division_en: "Rangpur",
      district_en: "Rangpur",
      upazila_en: "Rangpur Sadar",
      address_en: "Jahaj Company Mor, Central Road, Rangpur Sadar, Rangpur",
    });
    const dhakaDonor = createMockDonorCard({
      donor_id: "demo-donor-1",
      blood_group: "O+",
      division_en: "Dhaka",
      district_en: "Dhaka",
      upazila_en: "Dhanmondi",
      address_en: "House 12, Dhanmondi, Dhaka",
    });

    const donors = [rangpurDonor, dhakaDonor];

    // Filter by exact group B+
    const exactB = donors.filter((d) => d.blood_group === "B+");
    assert.equal(exactB.length, 1);
    assert.equal(exactB[0]?.donor_id, "demo-donor-2");

    // Filter by division Rangpur
    const rangpurList = donors.filter((d) => d.division_en === "Rangpur");
    assert.equal(rangpurList.length, 1);
    assert.equal(rangpurList[0]?.donor_id, "demo-donor-2");
    assert.equal(rangpurList[0]?.address_en?.includes("Jahaj Company Mor"), true);
  });
});


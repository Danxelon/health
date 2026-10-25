import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLINICAL_SYMPTOM_PILLS,
  CONSULTATION_RATING_TAGS,
  OFFICIAL_SEAL_TEXT,
  buildDigitalPrescription,
  resolvePrescriptionMedicines,
} from "./prescription.ts";

describe("Telemedicine Digital Prescription & Rating domain", () => {
  it("carries official government telemedicine seal watermark text", () => {
    assert.equal(
      OFFICIAL_SEAL_TEXT.bn,
      "গণপ্রজাতন্ত্রী বাংলাদেশ অনুমোদিত টেলিমেডিসিন প্রেসক্রিপশন"
    );
    assert.match(OFFICIAL_SEAL_TEXT.en, /Approved Telemedicine Prescription/);
  });

  it("provides quick clinical symptom response pills with required phrases", () => {
    const bnPills = CLINICAL_SYMPTOM_PILLS.map((p) => p.bn);
    assert.ok(bnPills.includes("জ্বর কত দিন ধরে?"));
    assert.ok(bnPills.includes("প্রেসক্রিপশন পাঠান"));
    assert.ok(bnPills.includes("জরুরি ওষুধ সেবন করুন"));
    assert.ok(bnPills.includes("আমার অবস্থা স্থিতিশীল"));
  });

  it("provides consultation rating tags with required phrases", () => {
    const bnTags = CONSULTATION_RATING_TAGS.map((t) => t.bn);
    assert.ok(bnTags.includes("সহৃদয় ও যত্নশীল"));
    assert.ok(bnTags.includes("সঠিক পরামর্শ"));
    assert.ok(bnTags.includes("দ্রুত উত্তর"));
  });

  it("resolves default structured medicines with dosage, duration, and instructions in Bengali and English", () => {
    const medsBn = resolvePrescriptionMedicines(null, "bn");
    assert.ok(medsBn.length >= 3);
    const napaBn = medsBn[0]!;
    assert.match(napaBn.name, /নাপা|প্যারাসিটামল/);
    assert.equal(napaBn.dosage, "১+০+১");
    assert.equal(napaBn.duration, "৭ দিন");
    assert.equal(napaBn.instructions, "খাবারের পর");

    const medsEn = resolvePrescriptionMedicines(null, "en");
    const napaEn = medsEn[0]!;
    assert.match(napaEn.name, /Napa|Paracetamol/);
    assert.equal(napaEn.dosage, "1+0+1");
    assert.equal(napaEn.duration, "7 days");
    assert.equal(napaEn.instructions, "After meal");
  });

  it("correctly builds a complete digital prescription document", () => {
    const rx = buildDigitalPrescription({
      consultationId: "c1000000-0000-0000-0000-000000000001",
      doctorName: "ডা. মাহমুদুর রহমান",
      bmdcRegNo: "A-88101",
      consultationDate: "2026-10-19",
      symptomSummary: "তীব্র জ্বর ও মাথাব্যথা",
      rawPrescription: null,
      lang: "bn",
    });

    assert.equal(rx.doctorName, "ডা. মাহমুদুর রহমান");
    assert.equal(rx.bmdcRegNo, "বিএমডিসি: A-88101");
    assert.equal(rx.diagnosis, "তীব্র জ্বর ও মাথাব্যথা");
    assert.match(rx.rxId, /^RX-BD-/);
    assert.equal(
      rx.officialSeal.bn,
      "গণপ্রজাতন্ত্রী বাংলাদেশ অনুমোদিত টেলিমেডিসিন প্রেসক্রিপশন"
    );
    assert.ok(rx.medicines.length > 0);
  });
});

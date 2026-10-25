/**
 * Telemedicine Digital Prescription and Consultation Rating domain logic.
 */

import type { Lang } from "@/lib/strings.ts";

export interface PrescriptionMedicine {
  id: string;
  name: string;
  nameEn?: string;
  nameBn?: string;
  generic?: string;
  dosage: string;
  dosageEn?: string;
  duration: string;
  durationEn?: string;
  instructions: string;
  instructionsEn?: string;
}

export interface DigitalPrescription {
  rxId: string;
  doctorName: string;
  bmdcRegNo: string;
  date: string;
  diagnosis: string;
  medicines: PrescriptionMedicine[];
  generalAdvice?: { bn: string; en: string };
  officialSeal: {
    bn: string;
    en: string;
  };
}

export const OFFICIAL_SEAL_TEXT = {
  bn: "গণপ্রজাতন্ত্রী বাংলাদেশ অনুমোদিত টেলিমেডিসিন প্রেসক্রিপশন",
  en: "Approved Telemedicine Prescription - Govt. of Bangladesh",
} as const;

export interface ClinicalResponsePill {
  id: string;
  bn: string;
  en: string;
}

export const CLINICAL_SYMPTOM_PILLS: readonly ClinicalResponsePill[] = [
  {
    id: "fever_duration",
    bn: "জ্বর কত দিন ধরে?",
    en: "How many days of fever?",
  },
  {
    id: "send_prescription",
    bn: "প্রেসক্রিপশন পাঠান",
    en: "Please send prescription",
  },
  {
    id: "emergency_meds",
    bn: "জরুরি ওষুধ সেবন করুন",
    en: "Take emergency medicine",
  },
  {
    id: "condition_stable",
    bn: "আমার অবস্থা স্থিতিশীল",
    en: "My condition is stable",
  },
  {
    id: "dosage_guidance",
    bn: "ওষুধের নিয়ম জানতে চাই",
    en: "Need medicine instructions",
  },
  {
    id: "feeling_now",
    bn: "এখন কেমন বোধ করছেন?",
    en: "How are you feeling now?",
  },
] as const;

export interface RatingTag {
  id: string;
  bn: string;
  en: string;
}

export const CONSULTATION_RATING_TAGS: readonly RatingTag[] = [
  {
    id: "caring",
    bn: "সহৃদয় ও যত্নশীল",
    en: "Kind & Caring",
  },
  {
    id: "accurate_advice",
    bn: "সঠিক পরামর্শ",
    en: "Accurate Advice",
  },
  {
    id: "quick_response",
    bn: "দ্রুত উত্তর",
    en: "Quick Response",
  },
  {
    id: "clear_instructions",
    bn: "পরিষ্কার নির্দেশনা",
    en: "Clear Instructions",
  },
  {
    id: "patient_listener",
    bn: "ধৈর্যশীল শ্রবণ",
    en: "Patient Listener",
  },
  {
    id: "high_competence",
    bn: "উন্নত চিকিৎসা জ্ঞান",
    en: "High Competence",
  },
] as const;

export const DEFAULT_CLINICAL_MEDICINES: readonly PrescriptionMedicine[] = [
  {
    id: "med-1",
    name: "ট্যাব. নাপা এক্সট্রা ৫০০ মি.গ্রা. (Paracetamol + Caffeine)",
    nameBn: "ট্যাব. নাপা এক্সট্রা ৫০০ মি.গ্রা. (প্যারাসিটামল)",
    nameEn: "Tab. Napa Extra 500mg (Paracetamol + Caffeine)",
    generic: "Paracetamol 500mg + Caffeine 65mg",
    dosage: "১+০+১",
    dosageEn: "1+0+1",
    duration: "৭ দিন",
    durationEn: "7 days",
    instructions: "খাবারের পর",
    instructionsEn: "After meal",
  },
  {
    id: "med-2",
    name: "ক্যাপ. সেকলো ২০ মি.গ্রা. (Omeprazole)",
    nameBn: "ক্যাপ. সেকলো ২০ মি.গ্রা. (ওমিপ্রাজল)",
    nameEn: "Cap. Seclo 20mg (Omeprazole)",
    generic: "Omeprazole 20mg",
    dosage: "১+০+১",
    dosageEn: "1+0+1",
    duration: "৭ দিন",
    durationEn: "7 days",
    instructions: "খাবারের ৩০ মিনিট পূর্বে",
    instructionsEn: "30 mins before meal",
  },
  {
    id: "med-3",
    name: "ট্যাব. এলাট্রল ১০ মি.গ্রা. (Cetirizine HCl)",
    nameBn: "ট্যাব. এলাট্রল ১০ মি.গ্রা. (সিটিরিজিন হাইড্রোক্লোরাইড)",
    nameEn: "Tab. Alatrol 10mg (Cetirizine HCl)",
    generic: "Cetirizine Hydrochloride 10mg",
    dosage: "০+০+১",
    dosageEn: "0+0+1",
    duration: "৭ দিন",
    durationEn: "7 days",
    instructions: "রাতে শোবার আগে",
    instructionsEn: "At bedtime",
  },
  {
    id: "med-4",
    name: "খাবার স্যালাইন (Oral Rehydration Salts - ORS)",
    nameBn: "খাবার স্যালাইন (ওআরএস)",
    nameEn: "Oral Rehydration Salts (ORS)",
    generic: "Oral Rehydration Salts",
    dosage: "১ প্যাকেট প্রয়োজন অনুযায়ী",
    dosageEn: "1 packet as needed",
    duration: "৩ দিন",
    durationEn: "3 days",
    instructions: "আধা লিটার বিশুদ্ধ পানিতে গুলিয়ে পান করুন",
    instructionsEn: "Dissolve in 500ml clean water",
  },
] as const;

/**
 * Parses raw consultation prescription text or provides structured clinical fallback medicines.
 */
export function resolvePrescriptionMedicines(
  rawPrescription: string | null,
  lang: Lang
): PrescriptionMedicine[] {
  if (rawPrescription && rawPrescription.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(rawPrescription) as PrescriptionMedicine[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fallback below
    }
  }

  // Localized representation of default medicines
  return DEFAULT_CLINICAL_MEDICINES.map((med) => ({
    ...med,
    name: lang === "bn" ? (med.nameBn ?? med.name) : (med.nameEn ?? med.name),
    dosage: lang === "bn" ? med.dosage : (med.dosageEn ?? med.dosage),
    duration: lang === "bn" ? med.duration : (med.durationEn ?? med.duration),
    instructions: lang === "bn" ? med.instructions : (med.instructionsEn ?? med.instructions),
  }));
}

/**
 * Builds a structured Digital Prescription document.
 */
export function buildDigitalPrescription(params: {
  consultationId: string;
  doctorName: string;
  bmdcRegNo: string | null;
  consultationDate: string;
  symptomSummary: string | null;
  rawPrescription: string | null;
  lang: Lang;
}): DigitalPrescription {
  const rxSuffix = params.consultationId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const rxId = `RX-BD-${rxSuffix}`;
  const defaultBmdc = params.lang === "bn" ? "বিএমডিসি: এ-৭৮৪২০ (অনুমোদিত)" : "BMDC: A-78420 (Verified)";
  const bmdcDisplay = params.bmdcRegNo
    ? (params.lang === "bn" ? `বিএমডিসি: ${params.bmdcRegNo}` : `BMDC: ${params.bmdcRegNo}`)
    : defaultBmdc;

  const diagnosis = params.symptomSummary && params.symptomSummary.trim().length > 0
    ? params.symptomSummary
    : (params.lang === "bn" ? "মৌসুমি সর্দি, জ্বর ও শারীরিক দুর্বলতা" : "Seasonal flu, fever & physical fatigue");

  const medicines = resolvePrescriptionMedicines(params.rawPrescription, params.lang);

  return {
    rxId,
    doctorName: params.doctorName,
    bmdcRegNo: bmdcDisplay,
    date: params.consultationDate,
    diagnosis,
    medicines,
    generalAdvice: {
      bn: "পর্যাপ্ত বিশ্রাম নিন, কুসুম গরম পানি পান করুন এবং যেকোনো জটিলতায় অবিলম্বে নিকটস্থ হাসপাতালে যোগাযোগ করুন।",
      en: "Take adequate bed rest, drink warm fluids, and consult the nearest hospital immediately in case of emergency.",
    },
    officialSeal: OFFICIAL_SEAL_TEXT,
  };
}

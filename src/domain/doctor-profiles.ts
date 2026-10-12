/**
 * Doctor Author Profile and 3-word Bilingual Name Resolution.
 *
 * Ensures all doctor author names conform strictly to the full 3-word title format:
 *   English: "Dr. <First> <Last>" (e.g. "Dr. Mahmudur Rahman")
 *   Bengali: "ডা. <First> <Last>" (e.g. "ডা. মাহমুদুর রহমান")
 *
 * Used across the Medilink / মেডিলিঙ্ক medical publication portal and feeds.
 */

export interface DoctorAuthorProfile {
  nameEn: string;
  nameBn: string;
  bmdc: string;
  specialtyEn: string;
  specialtyBn: string;
}

const KNOWN_DOCTORS: readonly DoctorAuthorProfile[] = [
  {
    nameEn: "Dr. Mahmudur Rahman",
    nameBn: "ডা. মাহমুদুর রহমান",
    bmdc: "BMDC-A-88101",
    specialtyEn: "Cardiology & Clinical Medicine",
    specialtyBn: "কার্ডিওলজি ও ক্লিনিক্যাল মেডিসিন",
  },
  {
    nameEn: "Dr. Fatima Begum",
    nameBn: "ডা. ফাতিমা বেগম",
    bmdc: "BMDC-A-88102",
    specialtyEn: "Pediatrics & Child Health",
    specialtyBn: "শিশু স্বাস্থ্য ও পেডিয়াট্রিক্স",
  },
  {
    nameEn: "Dr. Anwar Hossain",
    nameBn: "ডা. আনোয়ার হোসেন",
    bmdc: "BMDC-A-88103",
    specialtyEn: "Internal Medicine & Dengue",
    specialtyBn: "ইন্টারনাল মেডিসিন ও ডেঙ্গু",
  },
  {
    nameEn: "Dr. Taslima Akter",
    nameBn: "ডা. তাসলিমা আক্তার",
    bmdc: "BMDC-A-88104",
    specialtyEn: "Gynecology & Obstetrics",
    specialtyBn: "স্ত্রী ও প্রসূতি রোগ বিশেষজ্ঞ",
  },
  {
    nameEn: "Dr. Kamal Uddin",
    nameBn: "ডা. কামাল উদ্দিন",
    bmdc: "BMDC-A-88105",
    specialtyEn: "Hematology & Blood Disorders",
    specialtyBn: "হেমাটোলজি ও রক্তরোগ বিশেষজ্ঞ",
  },
  {
    nameEn: "Dr. Rashedul Islam",
    nameBn: "ডা. রাশেদুল ইসলাম",
    bmdc: "BMDC-A-88106",
    specialtyEn: "General & Laparoscopic Surgery",
    specialtyBn: "জেনারেল ও ল্যাপারোস্কোপিক সার্জারি",
  },
  {
    nameEn: "Dr. Sadia Afroz",
    nameBn: "ডা. সাদিয়া আফরোজ",
    bmdc: "BMDC-A-91021",
    specialtyEn: "Cardiology",
    specialtyBn: "কার্ডিওলজি (হৃদরোগ)",
  },
  {
    nameEn: "Dr. Tanvir Ahmed",
    nameBn: "ডা. তানভীর আহমেদ",
    bmdc: "BMDC-A-92144",
    specialtyEn: "Pediatrics",
    specialtyBn: "শিশু রোগ",
  },
  {
    nameEn: "Dr. Nusrat Jahan",
    nameBn: "ডা. নুসরাত জাহান",
    bmdc: "BMDC-A-93012",
    specialtyEn: "Gynecology",
    specialtyBn: "স্ত্রী রোগ",
  },
  {
    nameEn: "Dr. Rehana Parveen",
    nameBn: "ডা. রেহানা পারভীন",
    bmdc: "BMDC-A-95301",
    specialtyEn: "Dermatology",
    specialtyBn: "চর্ম ও যৌন রোগ",
  },
  {
    nameEn: "Dr. Shahriar Kabir",
    nameBn: "ডা. শাহরিয়ার কবির",
    bmdc: "BMDC-A-96420",
    specialtyEn: "Neurology",
    specialtyBn: "নিউরোলজি",
  },
  {
    nameEn: "Dr. Farzana Yasmin",
    nameBn: "ডা. ফারজানা ইয়াসমিন",
    bmdc: "BMDC-A-97155",
    specialtyEn: "Ophthalmology",
    specialtyBn: "চক্ষু রোগ",
  },
  {
    nameEn: "Dr. Tariqul Islam",
    nameBn: "ডা. তারিকুল ইসলাম",
    bmdc: "BMDC-A-98234",
    specialtyEn: "Orthopedics",
    specialtyBn: "অর্থোপেডিকস",
  },
  {
    nameEn: "Dr. Mehedi Hasan",
    nameBn: "ডা. মেহেদী হাসান",
    bmdc: "BMDC-A-89412",
    specialtyEn: "Gastroenterology",
    specialtyBn: "গ্যাস্ট্রোএন্টারোলজি",
  },
  {
    nameEn: "Dr. Sharmin Sultana",
    nameBn: "ডা. শারমিন সুলতানা",
    bmdc: "BMDC-A-90188",
    specialtyEn: "ENT & Head Neck Surgery",
    specialtyBn: "নাক কান গলা বিশেষজ্ঞ",
  },
  {
    nameEn: "Dr. Kazi Moniruzzaman",
    nameBn: "ডা. কাজী মনিরুজ্জামান",
    bmdc: "BMDC-A-92841",
    specialtyEn: "Nephrology",
    specialtyBn: "কিডনি রোগ",
  },
  {
    nameEn: "Dr. Anika Tabassum",
    nameBn: "ডা. আনিকা তাবাসসুম",
    bmdc: "BMDC-A-94762",
    specialtyEn: "Psychiatry",
    specialtyBn: "মানসিক রোগ",
  },
];

/**
 * Resolves a full 3-word doctor author profile in both English and Bengali.
 *
 * Maps abbreviated initials (e.g., "Dr. M. A. Rahman") to the canonical
 * full 3-word name ("Dr. Mahmudur Rahman" in English and "ডা. মাহমুদুর রহমান" in Bengali).
 */
export function getDoctorAuthorProfile(
  rawName?: string | null,
  rawBmdc?: string | null,
  rawEmailOrId?: string | null
): DoctorAuthorProfile {
  const cleanName = (rawName ?? "").replace(/\s*\(BMDC-.*?\)/, "").trim();
  const cleanBmdc = (rawBmdc ?? "").trim();
  const identifier = `${rawEmailOrId ?? ""} ${cleanName} ${cleanBmdc}`.toLowerCase();

  // Match by BMDC or known doctor identifiers
  if (
    cleanBmdc === "BMDC-A-88101" ||
    identifier.includes("rahman") ||
    identifier.includes("রহমান") ||
    cleanName === "Dr. M. A. Rahman" ||
    cleanName === "ডা. এম. এ. রহমান"
  ) {
    return KNOWN_DOCTORS[0]!; // Dr. Mahmudur Rahman
  }

  if (
    cleanBmdc === "BMDC-A-88102" ||
    identifier.includes("fatima") ||
    identifier.includes("ফাতিমা") ||
    identifier.includes("ফাতেমা")
  ) {
    return KNOWN_DOCTORS[1]!; // Dr. Fatima Begum
  }

  if (
    cleanBmdc === "BMDC-A-88103" ||
    identifier.includes("anwar") ||
    identifier.includes("আনোয়ার")
  ) {
    return KNOWN_DOCTORS[2]!; // Dr. Anwar Hossain
  }

  if (
    cleanBmdc === "BMDC-A-88104" ||
    identifier.includes("taslima") ||
    identifier.includes("তাসলিমা")
  ) {
    return KNOWN_DOCTORS[3]!; // Dr. Taslima Akter
  }

  if (
    cleanBmdc === "BMDC-A-88105" ||
    identifier.includes("kamal") ||
    identifier.includes("কামাল")
  ) {
    return KNOWN_DOCTORS[4]!; // Dr. Kamal Uddin
  }

  if (
    cleanBmdc === "BMDC-A-88106" ||
    identifier.includes("rashedul") ||
    identifier.includes("রাশেদুল")
  ) {
    return KNOWN_DOCTORS[5]!; // Dr. Rashedul Islam
  }

  // Exact match from known directory
  for (const doc of KNOWN_DOCTORS) {
    if (
      (cleanBmdc && doc.bmdc.toLowerCase() === cleanBmdc.toLowerCase()) ||
      (cleanName && doc.nameEn.toLowerCase() === cleanName.toLowerCase()) ||
      (cleanName && doc.nameBn === cleanName)
    ) {
      return doc;
    }
  }

  // Fallback to default Dr. Mahmudur Rahman
  if (!cleanName || cleanName === "Dr. M. A. Rahman" || cleanName === "ডা. এম. এ. রহমান") {
    return KNOWN_DOCTORS[0]!;
  }

  // Ensure any dynamic name is formatted to 3 words
  const parts = cleanName.split(/\s+/).filter(Boolean);
  let firstName = parts[parts.length - 2] || "Medical";
  let lastName = parts[parts.length - 1] || "Officer";
  if (parts.length === 1 && parts[0]) {
    firstName = parts[0];
    lastName = "Specialist";
  }

  return {
    nameEn: `Dr. ${firstName} ${lastName}`,
    nameBn: `ডা. ${firstName} ${lastName}`,
    bmdc: cleanBmdc || "BMDC-A-88101",
    specialtyEn: "Specialist Physician",
    specialtyBn: "বিশেষজ্ঞ চিকিৎসক",
  };
}

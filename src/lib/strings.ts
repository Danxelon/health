/**
 * Bilingual UI strings.
 *
 * One dictionary, both languages, no runtime translation service. Every string
 * a user can read lives here so a Bengali-only speaker and an English-only
 * speaker get the same product — not a translated subset with English holes.
 *
 * Bengali copy is written, not transliterated: a family member searching for
 * blood at 2am should not have to decode a machine sentence.
 */

import type { BloodComponent, RequestUrgency } from "@/domain/types.ts";

export type Lang = "bn" | "en";
export const LANGS: readonly Lang[] = ["bn", "en"] as const;

export type Bilingual = { bn: string; en: string };

export const DEFAULT_LANG: Lang = "bn";

/** Keys are dot-paths; `t()` walks them so a missing key is a visible string. */
export const STRINGS = {
  app: {
    name: { bn: "মেডিলিঙ্ক", en: "medilink" },
    tagline: {
      bn: "গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের ডিজিটাল স্বাস্থ্য উদ্যোগ — ৬৪ জেলায় জরুরি রক্তের তাৎক্ষণিক ম্যাচিং ও বিনামূল্যে ডাক্তারের পরামর্শ।",
      en: "Government Digital Health Initiative — emergency blood matching across 64 districts & free doctor telemedicine consultations.",
    },
    gov: {
      bn: "গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের ডিজিটাল স্বাস্থ্য উদ্যোগ",
      en: "Government Digital Health Initiative of Bangladesh",
    },
  },

  nav: {
    home: { bn: "হোম", en: "Home" },
    donors: { bn: "রক্তদাতা", en: "Find a donor" },
    request: { bn: "অনুরোধ", en: "Request blood" },
    consultations: { bn: "পরামর্শ", en: "Consult a doctor" },
    articles: { bn: "স্বাস্থ্য", en: "Health" },
    complain: { bn: "অভিযোগ", en: "Complain" },
    settings: { bn: "সেটিংস", en: "Settings" },
    admin: { bn: "অ্যাডমিন প্যানেল", en: "Admin Panel" },
    doctorPortal: { bn: "ডাক্তার পোর্টাল", en: "Doctor Portal" },
    register: { bn: "নিবন্ধন", en: "Register" },
    menu: { bn: "মেনু", en: "Menu" },
    close: { bn: "বন্ধ করুন", en: "Close" },
    skipToContent: { bn: "মূল অংশে যান", en: "Skip to content" },
  },

  lang: {
    label: { bn: "ভাষা", en: "Language" },
    bn: { bn: "বাংলা", en: "Bengali" },
    en: { bn: "ইংরেজি", en: "English" },
    toggle: { bn: "ভাষা পরিবর্তন করুন", en: "Switch language" },
  },

  theme: {
    toggle: { bn: "ডার্ক/লাইট থিম পরিবর্তন", en: "Toggle Dark/Light Theme" },
    dark: { bn: "ডার্ক থিম", en: "Dark Theme" },
    light: { bn: "লাইট থিম", en: "Light Theme" },
  },

  common: {
    search: { bn: "খুঁজুন", en: "Search" },
    loading: { bn: "লোড হচ্ছে…", en: "Loading…" },
    retry: { bn: "আবার চেষ্টা করুন", en: "Try again" },
    cancel: { bn: "বাতিল", en: "Cancel" },
    save: { bn: "সংরক্ষণ", en: "Save" },
    next: { bn: "পরবর্তী", en: "Next" },
    back: { bn: "পেছনে", en: "Back" },
    seeAll: { bn: "সব দেখুন", en: "See all" },
    filter: { bn: "ফিল্টার", en: "Filter" },
    distance: { bn: "দূরত্ব", en: "Distance" },
    km: { bn: "কিমি", en: "km" },
    andMore: { bn: "আরও", en: "more" },
    empty: { bn: "এখানে এখন কিছু নেই।", en: "Nothing here yet." },
  },

  home: {
    heroEyebrow: { bn: "মেডিলিঙ্ক", en: "medilink" },
    heroTitle: { bn: "রক্ত আর জীবন", en: "Blood and life," },
    heroTitleAccent: { bn: "একসাথে।", en: "side by side." },
    heroBody: {
      bn: "যেকোনো সময়, যেকোনো জায়গা থেকে — কাছের সঙ্গতিপূর্ণ রক্তদাতা খুঁজুন, ডাক্তারের সাথে কথা বলুন, এবং নির্ভরযোগ্য স্বাস্থ্য পরামর্শ পান।",
      en: "Any hour, any district — find a compatible donor nearby, reach a doctor, and read health guidance written by the doctors themselves.",
    },
    ctaPrimary: { bn: "সঙ্গতিপূর্ণ রক্তদাতা খুঁজুন", en: "Find a matched donor" },
    ctaSecondary: { bn: "ডাক্তারের সাথে কথা বলুন", en: "Consult a doctor" },
    rightRailTitle: { bn: "জাতীয় স্বাস্থ্য আপডেট", en: "National health updates" },
    rightRailSub: { bn: "সরকারি ও জাতীয় স্বাস্থ্য নির্দেশনা — দিনে আপডেট হয়।", en: "Official national health advisories — refreshed through the day." },
    rightRailEmpty: { bn: "এই মুহূর্তে কোনো জাতীয় আপডেট নেই।", en: "No national updates right now." },
    campaign: { bn: "কর্মসূচি", en: "Campaign" },
    alert: { bn: "সতর্কতা", en: "Advisory" },
    notice: { bn: "ঘোষণা", en: "Notice" },

    stats: {
      donors: { bn: "নিবন্ধিত রক্তদাতা", en: "Registered donors" },
      doctors: { bn: "যাচাইকৃত ডাক্তার", en: "Verified doctors" },
      upazilas: { bn: "উপজেলা কভারেজ", en: "Upazilas covered" },
      responses: { bn: "সাড়া দেওয়া অনুরোধ", en: "Requests answered" },
    },

    actionConsult: { bn: "ডাক্তার", en: "Consult a" },
    actionConsultSub: { bn: "খুঁজুন", en: "doctor" },
    actionBlood: { bn: "রক্ত", en: "Find" },
    actionBloodSub: { bn: "খুঁজুন", en: "blood" },
    actionDonate: { bn: "রক্তদান", en: "Donate" },
    actionDonateSub: { bn: "করুন", en: "blood" },

    emergencyTitle: { bn: "কাছের জরুরি অনুরোধ", en: "Nearby emergencies" },
    emergencyEmpty: { bn: "এই মুহূর্তে কাছাকাছি কোনো অনুরোধ নেই।", en: "No open requests near you right now." },
    iCanHelp: { bn: "আমি সাহায্য করতে পারি", en: "I can help" },

    bloodBanks: { bn: "কাছের ব্লাড ব্যাংক", en: "Blood banks near you" },
    bloodBanksNote: { bn: "স্টক তথ্য দিনে একবার হালনাগাদ হয়।", en: "Stock is refreshed daily." },
    schedule: { bn: "আসন্ন সময়সূচি", en: "Schedules" },

    articlesTitle: { bn: "ডাক্তারদের লেখা", en: "Written by the doctors" },
    articlesBody: {
      bn: "যাচাইকৃত ডাক্তারদের লেখা নিবন্ধ — সর্দি-জ্বর থেকে জটিল রোগ পর্যন্ত।",
      en: "Articles from BMDC-verified physicians — from the common cold to complex care.",
    },
    readMin: { bn: "মিনিট পড়া", en: "min read" },

    howTitle: { bn: "কীভাবে কাজ করে", en: "How it works" },
    how1Title: { bn: "১. যাচাই", en: "1. Verify" },
    how1Body: {
      bn: "ফোন নম্বর ও জাতীয় পরিচয়পত্র দিয়ে নিবন্ধন। ওটিপি কোড দিয়ে নিশ্চিতকরণ।",
      en: "Register with your phone and national ID. Confirm with a one-time code.",
    },
    how2Title: { bn: "২. খুঁজুন", en: "2. Search" },
    how2Body: {
      bn: "রক্তের গ্রুপ ও উপজেলা দিলে কাছের উপযুক্ত রক্তদাতাদের তালিকা পাওয়া যায়।",
      en: "Give a blood group and an upazila; get the compatible donors nearest to you.",
    },
    how3Title: { bn: "৩. যোগাযোগ", en: "3. Connect" },
  },

  donors: {
    title: { bn: "রক্তদাতা খুঁজুন", en: "Find a blood donor" },
    subtitle: {
      bn: "রোগীর গ্রুপ নির্বাচন করুন — যারা রক্ত দিতে পারবেন তাদের দেখা যাবে।",
      en: "Choose the patient's group — you will see everyone compatible with them.",
    },
    patientGroup: { bn: "রোগীর রক্তের গ্রুপ", en: "Patient's blood group" },
    component: { bn: "কী প্রয়োজন", en: "What is needed" },
    urgency: { bn: "কতটা জরুরি", en: "How urgent" },
    searchHere: { bn: "এই এলাকায় খুঁজুন", en: "Search this area" },
    locating: { bn: "অবস্থান নেওয়া হচ্ছে…", en: "Getting your location…" },
    useUpazila: { bn: "উপজেলা বেছে নিন", en: "Choose your upazila instead" },
    results: { bn: "ফলাফল", en: "Results" },
    resultsFor: { bn: "যারা দিতে পারবেন", en: "Compatible donors" },
    readyNow: { bn: "এখনই প্রস্তুত", en: "Ready now" },
    available: { bn: "উপলব্ধ", en: "Available" },
    unavailable: { bn: "অনুপলব্ধ", en: "Unavailable" },
    noneTitle: { bn: "এই এলাকায় কেউ পাওয়া যায়নি", en: "No one found in this area" },
    noneBody: {
      bn: "অনুসন্ধান বাড়ান, অথবা একটি অনুরোধ তৈরি করুন — আমরা ধাপে ধাপে আরও দূরে খুঁজব।",
      en: "Widen the search, or post a request — we will keep looking, ring by ring.",
    },
    widen: { bn: "অনুসন্ধান বাড়ান", en: "Widen the search" },
    createRequest: { bn: "অনুরোধ তৈরি করুন", en: "Create a request" },
    asOf: { bn: "হালনাগাদ", en: "As of" },
    compatibleWith: { bn: "যাদের কাছ থেকে নেওয়া যায়", en: "Can receive from" },
    respects: { bn: "নিরাপদ মিল", en: "Safe match" },
    mapTitle: { bn: "রক্তদাতার ঠিকানা ও অবস্থান ম্যাপ", en: "Donor Location & Address Map" },
    copyAddress: { bn: "ঠিকানা কপি করুন", en: "Copy Address" },
    openGoogleMaps: { bn: "গুগল ম্যাপে নেভিগেশন", en: "Open in Google Maps" },
    transitTime: { bn: "আনুমানিক ট্রানজিট সময়", en: "Estimated Transit Time" },
  },

  request: {
    title: { bn: "রক্তের অনুরোধ", en: "Request blood" },
    express: { bn: "এখনই দরকার", en: "Needed right now" },
    expressBody: { bn: "তিনটি প্রশ্ন — তারপরই খোঁজ শুরু।", en: "Three questions, then the search starts." },
    full: { bn: "বিস্তারিত ফর্ম", en: "Detailed form" },
    patientName: { bn: "রোগীর নাম", en: "Patient's name" },
    hospital: { bn: "হাসপাতাল", en: "Hospital" },
    hospitalPh: { bn: "যেমন: ঢাকা মেডিকেল কলেজ হাসপাতাল", en: "e.g. Dhaka Medical College Hospital" },
    units: { bn: "কত ইউনিট", en: "Units needed" },
    unitsHint: { bn: "এক ইউনিট = এক ব্যাগ", en: "One unit = one bag" },
    neededBy: { bn: "কবে প্রয়োজন", en: "Needed by" },
    upazila: { bn: "উপজেলা", en: "Upazila" },
    division: { bn: "বিভাগ", en: "Division" },
    district: { bn: "জেলা", en: "District" },
    selectDivision: { bn: "বিভাগ নির্বাচন করুন", en: "Select division" },
    selectDistrict: { bn: "জেলা নির্বাচন করুন", en: "Select district" },
    selectUpazila: { bn: "উপজেলা নির্বাচন করুন", en: "Select upazila" },
    locationTitle: { bn: "রোগীর অবস্থান (বিভাগ, জেলা ও উপজেলা)", en: "Patient location (Division, District & Upazila)" },
    searchUpazilaPh: { bn: "উপজেলা সরাসরি খুঁজুন...", en: "Quick search upazila..." },
    changeLocation: { bn: "পরিবর্তন", en: "Change" },
    reason: { bn: "কারণ", en: "Reason" },
    reasonPh: { bn: "যেমন: অপারেশন, ডেলিভারি, থ্যালাসেমিয়া", en: "e.g. surgery, delivery, thalassaemia" },
    hospitalContact: { bn: "হাসপাতালের যোগাযোগ", en: "Hospital contact" },
    hospitalContactPh: { bn: "যেমন: ওয়ার্ড ৪, বেড ১২, ফোন: ০১৭১১...", en: "e.g. Ward 4, Bed 12, Phone: 01711..." },
    submit: { bn: "অনুরোধ পাঠান", en: "Post the request" },
    submitting: { bn: "পাঠানো হচ্ছে…", en: "Posting…" },
    tracking: { bn: "অনুরোধের অবস্থা", en: "Request status" },
    myRequests: { bn: "আমার অনুরোধ", en: "My requests" },
    whatNext: { bn: "এরপর কী হবে", en: "What happens next" },
    contacted: { bn: "যাদের জানানো হয়েছে", en: "Donors contacted" },
    confirmed: { bn: "নিশ্চিত হয়েছে", en: "Confirmed" },
    responders: { bn: "সাড়া দিয়েছেন", en: "Responded" },
    cancel: { bn: "অনুরোধ বাতিল করুন", en: "Cancel this request" },
    cancelConfirm: { bn: "আপনি কি নিশ্চিত? এটি ফেরানো যাবে না।", en: "Are you sure? This cannot be undone." },
    markFulfilled: { bn: "রক্ত পাওয়া গেছে", en: "We found the blood" },
    call: { bn: "কল করুন", en: "Call" },
    continues: { bn: "এগোচ্ছে", en: "In progress" },
    expressNote: {
      bn: "জরুরি অনুরোধ কম সময় বাঁচে — ২৪ ঘণ্টা পর নিজে থেকে আরও দূরে ছড়ায়।",
      en: "A critical request lives less long — after 24 hours it escalates on its own.",
    },
  },

  doctors: {
    title: { bn: "ডাক্তার খুঁজুন", en: "Consult a doctor" },
    subtitle: {
      bn: "প্রতিটি উপজেলায় অন্তত একজন ডাক্তার — উপজেলা থেকে জেলা, বিভাগ, দেশ।",
      en: "At least one doctor in every upazila — from upazila to district, division, and nationwide.",
    },
    specialty: { bn: "বিশেষত্ব", en: "Specialty" },
    anySpecialty: { bn: "সব বিশেষত্ব", en: "All specialties" },
    experience: { bn: "অভিজ্ঞতা", en: "Experience" },
    years: { bn: "বছর", en: "years" },
    fee: { bn: "ফি", en: "Fee" },
    free: { bn: "বিনামূল্যে (সরকারি স্বাস্থ্যসেবা)", en: "Free (Govt. Healthcare)" },
    verified: { bn: "যাচাইকৃত", en: "Verified" },
    book: { bn: "সাক্ষাৎ নিন", en: "Book a consultation" },
    message: { bn: "বার্তা", en: "Message" },
    audioSoon: { bn: "অডিও কল (শীঘ্রই)", en: "Audio call (coming soon)" },
    bmdc: { bn: "বিএমডিসি", en: "BMDC" },
    noResults: { bn: "এই ফিল্টারে কোনো ডাক্তার নেই।", en: "No doctor matches these filters." },
    guideTitle: { bn: "কোন ধরণের ডাক্তার আপনার প্রয়োজন?", en: "Which Doctor Do You Need?" },
    guideSubtitle: { bn: "লক্ষণ ও শারীরিক সমস্যা অনুযায়ী বিশেষজ্ঞ নির্বাচন করুন", en: "Select a specialist based on symptoms and health concerns" },
    searchSymptom: { bn: "লক্ষণ বা রোগ লিখুন (যেমন: জ্বর, বুকে ব্যথা)...", en: "Search symptoms or illness (e.g. fever, chest pain)..." },
    viewAll: { bn: "সকল ডাক্তার সরাসরি দেখুন", en: "Browse All Doctors Directly" },
    changeFilter: { bn: "বিশেষত্ব পরিবর্তন করুন", en: "Change Specialty Filter" },
    showingFor: { bn: "নির্বাচিত বিশেষত্ব:", en: "Selected Specialty:" },
  },

  articles: {
    title: { bn: "স্বাস্থ্য নিবন্ধ", en: "Health articles" },
    subtitle: {
      bn: "যাচাইকৃত ডাক্তারদের লেখা — বাংলা ও ইংরেজিতে।",
      en: "Written by verified doctors — in Bengali and English.",
    },
    by: { bn: "লিখেছেন", en: "By" },
    views: { bn: "পাঠ", en: "views" },
    reviewFlag: { bn: "চিকিৎসা পর্যালোচনায়", en: "In medical review" },
    noResults: { bn: "এখনো কোনো নিবন্ধ প্রকাশিত হয়নি।", en: "No articles published yet." },
    relatedTag: { bn: "আপনার জন্য", en: "For you" },
  },

  settings: {
    title: { bn: "সেটিংস", en: "Settings" },
    profile: { bn: "প্রোফাইল", en: "Profile" },
    identity: { bn: "পরিচয়", en: "Identity" },
    privacy: { bn: "গোপনীয়তা", en: "Privacy" },
    availability: { bn: "রক্তদানের অবস্থা", en: "Donation availability" },
    unlocks: { bn: "যোগাযোগ প্রকাশের ইতিহাস", en: "Contact unlock history" },
    completeness: { bn: "প্রোফাইল সম্পূর্ণতা", en: "Profile completeness" },
    contactVisibility: { bn: "যোগাযোগ কে দেখতে পারে", en: "Who may see your contact" },
    onUnlock: { bn: "রাজি হলে", en: "On my acceptance" },
    privateAdmin: { bn: "শুধু প্রশাসক", en: "Admin only" },
    unlockedOn: { bn: "প্রকাশের সময়", en: "Unlocked on" },
    unlockedBy: { bn: "কে দেখেছে", en: "Unlocked by" },
    noUnlocks: { bn: "এখনো কেউ আপনার নম্বর দেখেনি।", en: "No one has seen your number yet." },
    theme: { bn: "থিম", en: "Theme" },
    light: { bn: "হালকা", en: "Light" },
    dark: { bn: "গাঢ়", en: "Dark" },
  },

  complain: {
    title: { bn: "অভিযোগ জানান", en: "File a complaint" },
    subtitle: {
      bn: "প্রতিটি অভিযোগের একটি নম্বর ও একটি সময়সীমা থাকে।",
      en: "Every complaint gets a ticket number and a deadline.",
    },
    target: { bn: "কিসের বিরুদ্ধে", en: "About" },
    subject: { bn: "বিষয়", en: "Subject" },
    description: { bn: "বিস্তারিত", en: "Details" },
    severity: { bn: "গুরুত্ব", en: "Severity" },
    submit: { bn: "জমা দিন", en: "Submit" },
    mine: { bn: "আমার অভিযোগ", en: "My complaints" },
    ticket: { bn: "টিকিট", en: "Ticket" },
    slaDue: { bn: "সমাধানের সময়সীমা", en: "Resolution due" },
  },

  auth: {
    register: { bn: "নিবন্ধন", en: "Create an account" },
    login: { bn: "লগ ইন", en: "Log in" },
    phone: { bn: "মোবাইল নম্বর", en: "Mobile number" },
    nid: { bn: "জাতীয় পরিচয়পত্র নম্বর", en: "National ID number" },
    dob: { bn: "জন্ম তারিখ", en: "Date of birth" },
    bloodGroup: { bn: "রক্তের গ্রুপ", en: "Blood group" },
    sendOtp: { bn: "কোড পাঠান", en: "Send the code" },
    otp: { bn: "৬ সংখ্যার কোড", en: "6-digit code" },
    verify: { bn: "নিশ্চিত করুন", en: "Verify" },
    resend: { bn: "আবার পাঠান", en: "Resend" },
  },

  footer: {
    about: { bn: "মেডিলিঙ্ক সম্পর্কে", en: "About medilink" },
    contact: { bn: "যোগাযোগ", en: "Contact" },
    helpline: { bn: "হেল্পলাইন", en: "Helpline" },
    legal: { bn: "শর্তাবলি ও গোপনীয়তা", en: "Terms and privacy" },
    notice: {
      bn: "মেডিলিঙ্ক একটি সরকারি ডিজিটাল স্বাস্থ্য উদ্যোগ। স্বাস্থ্য সহায়তা ও ডাক্তারের পরামর্শে ১৬২৬৩ (স্বাস্থ্য বাতায়ন)-এ কল করুন।",
      en: "medilink is a government digital health initiative. For health help and doctor consultation, call 16263 (Shasthyo Batayon).",
    },
    rights: { bn: "সর্বস্বত্ব সংরক্ষিত", en: "All rights reserved" },
  },

  errors: {
    generic: { bn: "কিছু একটা ভুল হয়েছে।", en: "Something went wrong." },
    network: { bn: "সংযোগ পাওয়া যাচ্ছে না।", en: "We cannot reach the server." },
    notFound: { bn: "পাতাটি পাওয়া যায়নি।", en: "That page does not exist." },
    goHome: { bn: "হোমে ফিরুন", en: "Back to home" },
  },
} as const;

/** Component labels, kept beside the blood-group machinery they describe. */
export const COMPONENT_LABELS: Record<BloodComponent, Bilingual> = {
  whole_blood: { bn: "সম্পূর্ণ রক্ত", en: "Whole blood" },
  prbc: { bn: "লোহিত কণিকা", en: "Red cells (PRBC)" },
  platelets: { bn: "অণুচক্রিকা", en: "Platelets" },
  plasma: { bn: "প্লাজমা", en: "Plasma" },
};

export const URGENCY_LABELS: Record<RequestUrgency, Bilingual> = {
  critical: { bn: "অতি জরুরি", en: "Critical" },
  urgent: { bn: "জরুরি", en: "Urgent" },
  routine: { bn: "পরিকল্পিত", en: "Planned" },
};

/**
 * Walks a dot path into the dictionary. A missing key returns the key itself —
 * visibly wrong in development, never an empty string that renders as a blank
 * gap in a medical UI.
 */
export function lookup(path: string, lang: Lang): string {
  const parts = path.split(".");
  let node: unknown = STRINGS;
  for (const part of parts) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  if (node && typeof node === "object" && lang in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)[lang]);
  }
  return path;
}

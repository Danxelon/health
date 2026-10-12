/**
 * Doctor Specialty & Symptom Guide component for common citizens.
 *
 * Designed to help citizens who do not understand clinical medical jargon
 * (e.g. Cardiology, Hematology, Nephrology) by providing plain-language
 * Bengali and English explanations, symptom search, and 1-click filtering.
 */

import { useState, useMemo, useEffect, useId, type ComponentType } from "react";
import {
  Stethoscope,
  Baby,
  User,
  HeartPulse,
  Sparkles,
  Bone,
  Ear,
  Eye,
  Brain,
  Droplet,
  Activity,
  Search,
  X,
  Check,
  ChevronRight,
  PhoneCall,
  Info,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { useAppShell } from "@/state/app-shell.tsx";
import { DEMO_SPECIALTIES } from "@/lib/demo-data.ts";
import type { Specialty } from "@/domain/types.ts";

export interface DoctorSpecialtyGuideProps {
  onSelectSpecialty: (specialtyId: number | null, specialtySlug?: string | null) => void;
  onViewAllDoctors?: () => void;
  selectedSpecialtyId?: number | null;
  selectedSpecialtySlug?: string | null;
  onDismiss?: () => void;
  isModal?: boolean;
}

interface SpecialtyCardMeta {
  jargon_term: string;
  jargon_explanation_bn: string;
  jargon_explanation_en: string;
  search_aliases: string[];
  icon_color: string;
}

const SPECIALTY_META: Record<number, SpecialtyCardMeta> = {
  1: {
    jargon_term: "General Medicine / Internal Medicine",
    jargon_explanation_bn: "মেডিসিন মানে সাধারণ রোগব্যাধি, দৈনন্দিন জ্বর-কাশি ও প্রাথমিক শারীরিক চিকিৎসার ডাক্তার।",
    jargon_explanation_en: "General Medicine covers common ailments, seasonal fevers, infections & primary adult health.",
    search_aliases: [
      "জ্বর", "সর্দি", "কাশি", "মাথা ব্যথা", "মাথাব্যথা", "ডেঙ্গু", "দুর্বলতা", "গ্যাস্ট্রিক",
      "পেট খারাপ", "বমি", "বদহজম", "ডায়াবেটিস", "fever", "cold", "cough", "headache", "dengue",
      "weakness", "gastric", "acidity", "diabetes", "jor", "kashi", "matha betha"
    ],
    icon_color: "bg-blue-600 text-white",
  },
  2: {
    jargon_term: "Paediatrics (পেডিয়াট্রিক্স)",
    jargon_explanation_bn: "পেডিয়াট্রিক্স মানে শিশু বিশেষজ্ঞ—নবজাতক থেকে কিশোরদের সকল রোগ ও সঠিক বৃদ্ধির ডাক্তার।",
    jargon_explanation_en: "Paediatrics specializes in newborn, infant, and child health, sickness, and vaccination.",
    search_aliases: [
      "শিশু", "বাচ্চা", "নবজাতক", "শিশুর জ্বর", "নিউমোনিয়া", "পাতলা পায়খানা", "টিকা", "দুধ না খাওয়া",
      "অরুচি", "child", "baby", "infant", "pediatric", "pediatrics", "pneumonia", "diarrhea",
      "vaccine", "tika", "shishu", "baccha"
    ],
    icon_color: "bg-amber-600 text-white",
  },
  3: {
    jargon_term: "Gynaecology & Obstetrics (গাইনোকোলজি)",
    jargon_explanation_bn: "গাইনোকোলজি মানে প্রসূতি ও স্ত্রীরোগ—নারীর স্বাস্থ্য, গর্ভকালীন যত্ন ও নিরাপদ প্রসব বিশেষজ্ঞ।",
    jargon_explanation_en: "Gynaecology & Obstetrics cares for women's reproductive health, prenatal pregnancy, and safe delivery.",
    search_aliases: [
      "মহিলা", "নারী", "গর্ভবতী", "গর্ভকালীন", "প্রসূতি", "মাসিক", "তলপেটে ব্যথা", "সাদা স্রাব",
      "জরায়ু", "ডেলিভারি", "লেডি ডাক্তার", "pregnancy", "pregnant", "period", "menstrual",
      "cramp", "white discharge", "uterus", "delivery", "gynaecology", "mohila"
    ],
    icon_color: "bg-pink-600 text-white",
  },
  4: {
    jargon_term: "Cardiology (কার্ডিওলজি)",
    jargon_explanation_bn: "কার্ডিওলজি মানে হৃদরোগ বিশেষজ্ঞ—হার্ট, বুক ব্যথা ও রক্তচাপ (প্রেশার) সংক্রান্ত জটিলতার ডাক্তার।",
    jargon_explanation_en: "Cardiology diagnoses and treats heart diseases, chest tightness, high blood pressure & palpitations.",
    search_aliases: [
      "হার্ট", "বুকে ব্যথা", "বুক ব্যথা", "বুক ধড়ফড়", "উচ্চ রক্তচাপ", "হাই প্রেশার", "প্রেশার",
      "শ্বাসকষ্ট", "হার্ট অ্যাটাক", "কার্ডিওলজি", "heart", "chest pain", "buke betha", "palpitation",
      "high blood pressure", "hypertension", "high bp", "pressure", "cardiology", "dhorphor"
    ],
    icon_color: "bg-rose-600 text-white",
  },
  5: {
    jargon_term: "Dermatology (ডার্মাটোলজি)",
    jargon_explanation_bn: "ডার্মাটোলজি মানে চর্মরোগ—ত্বক, চামড়া, চুলকানি, চুল ও অ্যালার্জির বিশেষজ্ঞ ডাক্তার।",
    jargon_explanation_en: "Dermatology treats skin disorders, itching, rashes, hair fall, dandruff, eczema & allergies.",
    search_aliases: [
      "চুলকানি", "চুলকানী", "অ্যালার্জি", "এলার্জি", "র‍্যাশ", "ফুসকুড়ি", "ব্রণ", "ত্বক", "চামড়া",
      "চুল পড়া", "খুশকি", "একজিমা", "দাউদ", "ঘামাচি", "itch", "itching", "allergy", "rash",
      "acne", "pimple", "skin", "hair fall", "dandruff", "eczema", "dermatology", "chulkani"
    ],
    icon_color: "bg-purple-600 text-white",
  },
  6: {
    jargon_term: "Orthopaedics (অর্থোপেডিক)",
    jargon_explanation_bn: "অর্থোপেডিক মানে হাড় ও জোড় বিশেষজ্ঞ—হাড় ভাঙা, মচকানো, হাঁটু ও কোমর ব্যথার ডাক্তার।",
    jargon_explanation_en: "Orthopaedics handles bone fractures, knee pain, lower back ache, joints & arthritis.",
    search_aliases: [
      "হাড়", "হাড্ডি", "হাঁটু ব্যথা", "কোমর ব্যথা", "পিঠ ব্যথা", "মচকানো", "ভাঙা", "জয়েন্ট",
      "বাত", "ঘাড় ব্যথা", "অর্থোপেডিক", "bone", "knee pain", "back pain", "fracture", "joint",
      "arthritis", "orthopaedics", "orthopedic", "had", "hantu betha", "komor betha"
    ],
    icon_color: "bg-emerald-600 text-white",
  },
  7: {
    jargon_term: "ENT / Otolaryngology (ইএনটি)",
    jargon_explanation_bn: "ইএনটি মানে নাক, কান ও গলা বিশেষজ্ঞ—কানে কম শোনা, পুঁজ, টনসিল ও সাইনাসের ডাক্তার।",
    jargon_explanation_en: "ENT specializes in ear discharge, hearing issues, chronic sinusitis, tonsils & sore throat.",
    search_aliases: [
      "কান", "নাক", "গলা", "টনসিল", "সাইনাস", "কানে ব্যথা", "পুঁজ", "কম শোনা", "নাক বন্ধ",
      "গলা ব্যথা", "ইএনটি", "ear", "nose", "throat", "tonsil", "sinus", "hearing", "sore throat",
      "ent", "kan betha", "gola betha", "nak bondho"
    ],
    icon_color: "bg-teal-600 text-white",
  },
  8: {
    jargon_term: "Ophthalmology (অপথালমোলজি)",
    jargon_explanation_bn: "অপথালমোলজি মানে চক্ষু বিশেষজ্ঞ—চোখে ঝাপসা দেখা, ছানি, লাল হওয়া ও চোখের ডাক্তার।",
    jargon_explanation_en: "Ophthalmology treats blurred eyesight, cataracts, glaucoma, red eyes & vision correction.",
    search_aliases: [
      "চোখ", "দৃষ্টি", "ঝাপসা", "ছানি", "চোখ লাল", "পানি পড়া", "চশমা", "চক্ষু", "eye",
      "vision", "blurry", "cataract", "red eye", "ophthalmology", "chokh", "jhapsha", "chani"
    ],
    icon_color: "bg-cyan-600 text-white",
  },
  9: {
    jargon_term: "Psychiatry (সাইকিয়াট্রি)",
    jargon_explanation_bn: "সাইকিয়াট্রি মানে মানসিক স্বাস্থ্য বিশেষজ্ঞ—দুশ্চিন্তা, বিষণ্ণতা, অনিদ্রা ও মানসিক চাপের ডাক্তার।",
    jargon_explanation_en: "Psychiatry cares for emotional distress, anxiety, depression, insomnia & behavioral health.",
    search_aliases: [
      "মানসিক", "মন", "দুশ্চিন্তা", "অনিদ্রা", "ঘুম", "বিষণ্ণতা", "প্যানিক", "স্ট্রেস", "ভয়",
      "কাউন্সেলিং", "সাইকিয়াট্রি", "mental", "anxiety", "sleep", "insomnia", "depression",
      "stress", "panic", "psychiatry", "dushchinta", "ghum"
    ],
    icon_color: "bg-indigo-600 text-white",
  },
  10: {
    jargon_term: "Hematology (হেমাটোলজি)",
    jargon_explanation_bn: "হেমাটোলজি মানে রক্তরোগ বিশেষজ্ঞ—রক্তস্বল্পতা, থ্যালাসেমিয়া, রক্তক্ষরণ ও প্লাটিলেটের ডাক্তার।",
    jargon_explanation_en: "Hematology covers blood disorders, anemia, thalassemia, platelet deficiency & bleeding.",
    search_aliases: [
      "রক্ত", "রক্তস্বল্পতা", "অ্যানিমিয়া", "রক্তশূন্যতা", "থ্যালাসেমিয়া", "প্লাটিলেট", "রক্তক্ষরণ",
      "হিমোগ্লোবিন", "হেমাটোলজি", "blood", "anemia", "thalassemia", "platelet", "bleeding",
      "hemoglobin", "hematology", "rokto", "roktoshunnota"
    ],
    icon_color: "bg-red-600 text-white",
  },
  11: {
    jargon_term: "Nephrology (নেফ্রোলজি)",
    jargon_explanation_bn: "নেফ্রোলজি মানে কিডনি ও প্রস্রাব রোগ বিশেষজ্ঞ—প্রস্রাবে জ্বালা, ইনফেকশন, কিডনিতে পাথর ও ডায়ালাইসিস।",
    jargon_explanation_en: "Nephrology specializes in kidney health, burning urination, kidney stones & renal care.",
    search_aliases: [
      "কিডনি", "প্রস্রাব", "জ্বালাপোড়া", "পাথর", "পা ফোলা", "পিঠে ব্যথা", "নেফ্রোলজি",
      "ইউরোলজি", "kidney", "urine", "burning urination", "stone", "swelling", "nephrology",
      "proshrab", "kidney stone"
    ],
    icon_color: "bg-emerald-700 text-white",
  },
};

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  Stethoscope,
  Baby,
  User,
  HeartPulse,
  Sparkles,
  Bone,
  Ear,
  Eye,
  Brain,
  Droplet,
  Activity,
};

/** Quick 1-tap symptom chips common citizens search for */
const QUICK_SYMPTOM_TAGS = [
  { bn: "জ্বর ও ঠান্ডা", en: "Fever & Cold", term: "জ্বর" },
  { bn: "বুকে ব্যথা (Chest Pain)", en: "Chest Pain", term: "বুকে ব্যথা" },
  { bn: "মাথা ব্যথা", en: "Headache", term: "মাথা ব্যথা" },
  { bn: "শিশুর জ্বর বা ঠান্ডা", en: "Child Health", term: "শিশু" },
  { bn: "চুলকানি ও অ্যালার্জি", en: "Skin Rash & Itch", term: "চুলকানি" },
  { bn: "হাঁটু ও কোমর ব্যথা", en: "Joint & Back Pain", term: "কোমর ব্যথা" },
  { bn: "নাক-কান-গলা", en: "Ear-Nose-Throat", term: "কান" },
  { bn: "চোখে ঝাপসা বা ছানি", en: "Blurry Vision", term: "চোখ" },
  { bn: "দুশ্চিন্তা ও অনিদ্রা", en: "Anxiety & Sleep", term: "দুশ্চিন্তা" },
  { bn: "রক্তস্বল্পতা বা রক্তরোগ", en: "Anemia / Blood", term: "রক্ত" },
  { bn: "প্রস্রাবে জ্বালা বা কিডনি", en: "Urine / Kidney", term: "কিডনি" },
];

export function DoctorSpecialtyGuide({
  onSelectSpecialty,
  onViewAllDoctors,
  selectedSpecialtyId = null,
  selectedSpecialtySlug = null,
  onDismiss,
  isModal = false,
}: DoctorSpecialtyGuideProps) {
  const { lang, t } = useAppShell();
  const isBn = lang === "bn";
  const searchInputId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChip, setActiveChip] = useState<string | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    if (!isModal && !onDismiss) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModal, onDismiss]);

  // Filter specialties according to search query
  const filteredSpecialties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return DEMO_SPECIALTIES;

    return DEMO_SPECIALTIES.filter((s: Specialty) => {
      const meta = SPECIALTY_META[s.id];
      const name = `${s.bn} ${s.en} ${s.slug}`.toLowerCase();
      const symptoms = `${s.symptoms_bn} ${s.symptoms_en}`.toLowerCase();
      const desc = `${s.description_bn} ${s.description_en}`.toLowerCase();
      const concerns = (s.common_concerns_bn || []).join(" ").toLowerCase();
      const aliases = meta ? meta.search_aliases.join(" ").toLowerCase() : "";

      return (
        name.includes(q) ||
        symptoms.includes(q) ||
        desc.includes(q) ||
        concerns.includes(q) ||
        aliases.includes(q)
      );
    });
  }, [searchQuery]);

  const handleChipClick = (term: string) => {
    if (activeChip === term) {
      setActiveChip(null);
      setSearchQuery("");
    } else {
      setActiveChip(term);
      setSearchQuery(term);
    }
  };

  const handleSelect = (s: Specialty | null) => {
    if (s === null) {
      if (onViewAllDoctors) {
        onViewAllDoctors();
      } else {
        onSelectSpecialty(null, null);
      }
    } else {
      onSelectSpecialty(s.id, s.slug);
    }
    onDismiss?.();
  };

  const content = (
    <div className="w-full">
      {/* Official Government Health Portal Header Section */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 p-6 sm:p-8 text-white shadow-lg">
        {/* Decorative backdrop glow */}
        <div
          className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -left-12 -bottom-12 h-56 w-56 rounded-full bg-teal-400/15 blur-2xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="max-w-3xl space-y-3">
            {/* National emblem badge */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700/80 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-100 shadow-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                <span>
                  {isBn
                    ? "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার · জাতীয় স্বাস্থ্য গাইড"
                    : "Govt. of Bangladesh · Citizen Health Portal"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-600/90 border border-rose-300/40 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                <span>{isBn ? "১০০% বিনামূল্যে সরকারি পরামর্শ" : "100% Free Consultations"}</span>
              </span>
            </div>

            {/* Requirement 2 Primary Heading: 'কোন ধরণের বিশেষজ্ঞ ডাক্তার আপনার প্রয়োজন?' / 'Which Specialist Doctor Do You Need?' */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight font-display">
              {isBn
                ? "কোন ধরণের বিশেষজ্ঞ ডাক্তার আপনার প্রয়োজন?"
                : "Which Specialist Doctor Do You Need?"}
            </h2>
            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed max-w-2xl">
              {isBn
                ? "চিকিৎসা বিজ্ঞানের কঠিন পরিভাষা (যেমন: Cardiology, Hematology, Nephrology) সাধারণ নাগরিকদের বুঝতে কষ্ট হতে পারে। আপনার রোগ বা কষ্ট অনুযায়ী সহজ ভাষায় সঠিক বিশেষজ্ঞ ডাক্তার বেছে নিন।"
                : "Medical jargon can be intimidating and confusing. Simply type your symptoms or choose from everyday health concerns to find the right specialist."}
            </p>
          </div>

          {/* Quick Action at Top: 'সকল ডাক্তার সরাসরি দেখুন' */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 self-start">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/25 px-4 py-2.5 text-xs sm:text-sm font-bold text-white backdrop-blur-md transition-all active:scale-98 cursor-pointer shadow-sm hover:border-white/40"
            >
              <span>{isBn ? "সকল ডাক্তার সরাসরি দেখুন" : "Show all doctors directly"}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label={t("nav.close")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white transition-colors cursor-pointer self-end sm:self-auto"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Jargon Buster Guide Note */}
        <div className="mt-5 rounded-2xl bg-black/25 border border-white/15 p-3.5 sm:p-4 text-xs sm:text-[13px] text-emerald-100/90 flex items-start gap-3">
          <Info className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <span className="font-bold text-white block">
              {isBn
                ? "সহজ ভাষায় মেডিকেল পরিভাষার অর্থ (Jargon Buster):"
                : "Medical Terms Explained in Plain Language:"}
            </span>
            <p className="leading-relaxed text-emerald-100/85">
              {isBn ? (
                <>
                  <span className="font-semibold text-emerald-200">Cardiology</span> = হার্ট ও প্রেশার বিশেষজ্ঞ ·{" "}
                  <span className="font-semibold text-emerald-200">Hematology</span> = রক্তস্বল্পতা ও রক্তরোগ বিশেষজ্ঞ ·{" "}
                  <span className="font-semibold text-emerald-200">Nephrology</span> = কিডনি ও প্রস্রাব রোগ বিশেষজ্ঞ ·{" "}
                  <span className="font-semibold text-emerald-200">Orthopaedics</span> = হাড় ও জোড় ব্যথা বিশেষজ্ঞ
                </>
              ) : (
                <>
                  <span className="font-semibold text-emerald-200">Cardiology</span> = Heart & Blood Pressure ·{" "}
                  <span className="font-semibold text-emerald-200">Hematology</span> = Blood disorders & Anemia ·{" "}
                  <span className="font-semibold text-emerald-200">Nephrology</span> = Kidney & Urine problems ·{" "}
                  <span className="font-semibold text-emerald-200">Orthopaedics</span> = Bones & Joint ache
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Requirement 2 Subheading & Interactive Search Section */}
      <div className="mt-6 space-y-4">
        {/* Required Secondary Subheading: 'আপনার শারীরিক লক্ষণ বা সমস্যা বেছে নিন:' / 'Select your symptoms or health concern:' */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <label
            htmlFor={searchInputId}
            className="text-base sm:text-lg font-bold text-ink flex items-center gap-2"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-brand-deep text-xs font-bold">
              ✓
            </span>
            <span>
              {isBn
                ? "আপনার শারীরিক লক্ষণ বা সমস্যা বেছে নিন:"
                : "Select your symptoms or health concern:"}
            </span>
          </label>
          <span className="text-xs font-semibold text-muted">
            {isBn
              ? `${filteredSpecialties.length}টি বিভাগ উপলব্ধ`
              : `${filteredSpecialties.length} specialties available`}
          </span>
        </div>

        {/* Interactive Symptom Search Box */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted">
            <Search className="h-5 w-5" aria-hidden="true" />
          </div>
          <input
            id={searchInputId}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveChip(null);
            }}
            placeholder={
              isBn
                ? "লক্ষণ দিয়ে খুঁজুন (যেমন: জ্বর, মাথা ব্যথা, বুকে ব্যথা, চুলকানি, পেট খারাপ, দাঁত ব্যথা)..."
                : "Search symptoms (e.g. fever, chest pain, headache, rash, cough, blood pressure)..."
            }
            className="w-full rounded-2xl border-2 border-line bg-surface py-3.5 pl-12 pr-12 text-sm sm:text-base text-ink placeholder:text-subtle focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 shadow-xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveChip(null);
              }}
              aria-label={isBn ? "মুছুন" : "Clear search"}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-muted hover:text-ink cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Quick Symptom Chips */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {isBn ? "জনপ্রিয় লক্ষণসমূহ:" : "Quick Symptom Tags:"}
            </span>
            <span className="text-[11px] text-subtle">
              {isBn ? "(ক্লিক করে তাৎক্ষণিক ফিল্টার করুন)" : "(click to filter instantly)"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_SYMPTOM_TAGS.map((chip) => {
              const isActive =
                activeChip === chip.term ||
                searchQuery.toLowerCase().includes(chip.term.toLowerCase());
              return (
                <button
                  key={chip.en}
                  type="button"
                  onClick={() => handleChipClick(chip.term)}
                  aria-pressed={isActive}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-xs font-bold"
                      : "border-line bg-surface text-ink hover:border-emerald-300 hover:bg-emerald-50/50"
                  }`}
                >
                  <span>{isBn ? chip.bn : chip.en}</span>
                  {isActive && <Check className="h-3 w-3" aria-hidden="true" />}
                </button>
              );
            })}
            {(searchQuery || activeChip) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveChip(null);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                <span>{isBn ? "রিসেট করুন" : "Reset Filter"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid / Bento of Specialty Cards */}
      <div className="mt-8">
        {filteredSpecialties.length === 0 ? (
          <div className="rounded-3xl border border-line bg-surface p-10 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertCircle className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-ink">
                {isBn
                  ? `"${searchQuery}" এর জন্য সরাসরি কোনো বিশেষত্ব পাওয়া যায়নি`
                  : `No specialty found matching "${searchQuery}"`}
              </h3>
              <p className="text-sm text-muted max-w-md mx-auto">
                {isBn
                  ? "সাধারণ রোগ বা প্রাথমিক পরামর্শের জন্য মেডিসিন (General Medicine) ডাক্তার দেখান অথবা সকল ডাক্তার তালিকা দেখুন।"
                  : "Start by consulting a General Medicine specialist for all initial concerns, or browse all doctors directly."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const medicine = DEMO_SPECIALTIES.find((s) => s.id === 1);
                  handleSelect(medicine ?? null);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer shadow-xs"
              >
                <Stethoscope className="h-4 w-4" />
                <span>{isBn ? "মেডিসিন ডাক্তার দেখুন" : "View Medicine Doctors"}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-elevated transition-colors cursor-pointer"
              >
                <span>{isBn ? "সকল ডাক্তার সরাসরি দেখুন" : "Show all doctors directly"}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSpecialties.map((s: Specialty) => {
              const Icon = ICON_MAP[s.icon_name] || Stethoscope;
              const isSelected =
                selectedSpecialtyId === s.id ||
                (Boolean(selectedSpecialtySlug) && selectedSpecialtySlug === s.slug);
              const meta = SPECIALTY_META[s.id];

              return (
                <div
                  key={s.id}
                  className={`group relative flex flex-col justify-between rounded-3xl border transition-all duration-200 p-5 sm:p-6 ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500 shadow-md"
                      : "border-line bg-surface hover:border-emerald-300 hover:shadow-md"
                  }`}
                >
                  <div className="space-y-4">
                    {/* Top card bar: Icon + Specialty Names (BN & EN) */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-xs ${
                            meta?.icon_color ?? "bg-brand text-white"
                          }`}
                        >
                          <Icon className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-ink group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors">
                            {isBn ? s.bn : s.en}
                          </h3>
                          <span className="text-xs font-semibold text-muted block">
                            {isBn ? s.en : s.bn}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          <span>{isBn ? "নির্বাচিত" : "Selected"}</span>
                        </span>
                      )}
                    </div>

                    {/* What this doctor does (Description in plain Bengali & English) */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                        {isBn ? "ডাক্তার যা চিকিৎসা করেন:" : "What this doctor treats:"}
                      </span>
                      <p className="text-xs sm:text-sm text-ink/90 leading-relaxed font-medium">
                        {isBn ? s.description_bn : s.description_en}
                      </p>
                    </div>

                    {/* Plain language symptoms list */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                        {isBn ? "যেসব লক্ষণ দেখলে যাবেন:" : "Common Symptoms & Concerns:"}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {s.common_concerns_bn.map((concern: string, idx: number) => (
                          <span
                            key={idx}
                            className="rounded-lg bg-elevated border border-line/60 px-2.5 py-1 text-xs font-medium text-ink"
                          >
                            {concern}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted leading-normal pt-1">
                        <span className="font-semibold text-ink/80">
                          {isBn ? "শারীরিক লক্ষণ: " : "Symptoms: "}
                        </span>
                        {isBn ? s.symptoms_bn : s.symptoms_en}
                      </p>
                    </div>
                  </div>

                  {/* 1-click 'ডাক্তার দেখুন (View Doctors)' button */}
                  <div className="mt-5 pt-4 border-t border-line/70 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      {isBn ? "বিনামূল্যে সেবা" : "100% Free"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelect(s)}
                      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl px-4 font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-xs active:scale-98 ${
                        isSelected
                          ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                          : "bg-surface hover:bg-emerald-600 hover:text-white text-ink border border-line hover:border-emerald-600"
                      }`}
                    >
                      <span>
                        {isBn
                          ? `${s.bn} ডাক্তার দেখুন`
                          : `View ${s.en} Doctors`}
                      </span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Action at Bottom: 'সকল ডাক্তার সরাসরি দেখুন' & 24/7 Helpline Banner */}
      <div className="mt-10 rounded-3xl border border-line bg-gradient-to-r from-slate-50 via-emerald-50/30 to-slate-50 dark:from-slate-900/40 dark:via-emerald-950/20 dark:to-slate-900/40 p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 shadow-xs">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
              ★
            </span>
            <h4 className="text-base sm:text-lg font-bold text-ink">
              {isBn
                ? "কোন নির্দিষ্ট লক্ষণ বুঝতে পারছেন না?"
                : "Not sure which symptom fits your condition?"}
            </h4>
          </div>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            {isBn
              ? "কোন ফিল্টার ছাড়াই আমাদের সকল যাচাইকৃত সরকারি ও বিশেষজ্ঞ ডাক্তারদের তালিকা একসাথে দেখুন। যেকোনো জরুরি শারীরিক সমস্যায় অবিলম্বে স্বাস্থ্য বাতায়ন ১৬২৬৩ বা জরুরি সেবা ৯৯৯ এ কল করুন।"
              : "Browse the complete directory of verified doctors across all specialties directly, or call the 24/7 national health helpline 16263."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <a
            href="tel:16263"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface hover:bg-elevated px-4 text-xs sm:text-sm font-bold text-ink transition-colors cursor-pointer"
          >
            <PhoneCall className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span>{isBn ? "স্বাস্থ্য বাতায়ন ১৬২৬৩" : "Helpline 16263"}</span>
          </a>

          {/* Quick action at bottom: 'সকল ডাক্তার সরাসরি দেখুন' */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white px-5 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
          >
            <span>{isBn ? "সকল ডাক্তার সরাসরি দেখুন" : "Show all doctors directly"}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  // If rendered as a Modal
  if (isModal) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          isBn
            ? "কোন ধরণের বিশেষজ্ঞ ডাক্তার আপনার প্রয়োজন? লক্ষণ ও বিশেষত্ব নির্দেশিকা"
            : "Which Specialist Doctor Do You Need? Symptom & Specialty Guide"
        }
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onDismiss}
      >
        <div
          className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-3xl bg-bg border border-line p-4 sm:p-8 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  // If rendered inline
  return (
    <section
      role="region"
      aria-label={
        isBn
          ? "লক্ষণ ও বিশেষজ্ঞ ডাক্তার নির্দেশিকা"
          : "Symptom & Doctor Specialty Guide"
      }
      className="w-full"
    >
      {content}
    </section>
  );
}

export default DoctorSpecialtyGuide;

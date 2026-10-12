/**
 * About Page — Medilink (মেডিলিঙ্ক)
 *
 * Government Digital Health Initiative of Bangladesh
 * - Free doctor telemedicine consultations across 64 districts
 * - Instant emergency blood matching network with geocoded donor discovery
 * - BMDC-verified doctors and national health guidelines
 * - High-contrast, WCAG AA compliant, fully accessible layout
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Activity,
  ArrowRight,
  Droplet,
  MapPin,
  Megaphone,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { SectionHeader } from "@/components/ui.tsx";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const COPY = {
  // Hero
  eyebrow: {
    bn: "গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের ডিজিটাল স্বাস্থ্য উদ্যোগ",
    en: "Government Digital Health Initiative of Bangladesh",
  },
  heroTitle: { bn: "মেডিলিঙ্ক — ৬৪ জেলায়", en: "Medilink — Across 64 districts," },
  heroAccent: { bn: "সবার জন্য ডিজিটাল স্বাস্থ্যসেবা।", en: "life-saving digital healthcare." },
  heroBody: {
    bn: "মেডিলিঙ্ক (Medilink) বাংলাদেশ সরকারের একটি জাতীয় ডিজিটাল স্বাস্থ্য উদ্যোগ। দেশের ৬৪টি জেলায় জরুরি রক্তের তাৎক্ষণিক ম্যাচিং, সম্পূর্ণ বিনামূল্যে বিশেষজ্ঞ ডাক্তারের টেলিমেডিসিন পরামর্শ এবং নির্ভরযোগ্য জাতীয় স্বাস্থ্য নির্দেশনা — যেকোনো সময়, যেকোনো প্রান্ত থেকে সবার জন্য উন্মুক্ত।",
    en: "Medilink is a national Government Digital Health Initiative in Bangladesh. Instant emergency blood donor matching across all 64 districts, 100% free verified doctor telemedicine, and trusted medical guidance — accessible to every citizen from any corner of the country.",
  },

  // Hero Quick Badges
  badgeDistricts: { bn: "৬৪ জেলা কভারেজ", en: "64 Districts Covered" },
  badgeTelemedicine: { bn: "১০০% ফ্রি টেলিমেডিসিন", en: "100% Free Telemedicine" },
  badgeBloodMatch: { bn: "তাৎক্ষণিক রক্ত ম্যাচিং", en: "Instant Blood Matching" },
  badgeGov: { bn: "সরকারি ডিজিটাল উদ্যোগ", en: "Government Initiative" },

  // Mission
  missionEyebrow: { bn: "আমাদের লক্ষ্য ও অঙ্গীকার", en: "Our Mission & Commitment" },
  missionTitle: { bn: "জীবন রক্ষায় মেডিলিঙ্কের তিন মূল স্তম্ভ", en: "Medilink's Three Core Pillars" },
  missionSub: {
    bn: "জরুরি রক্তের তাৎক্ষণিক সন্ধান, বিনামূল্যে চিকিৎসাসেবা এবং জাতীয় স্বাস্থ্য তথ্য — প্রতিটি উপজেলায় পৌঁছে দেওয়া।",
    en: "Instant emergency blood matching, free consultations, and verified health guidance — in every upazila.",
  },
  missionCardTitle: {
    bn: "মেডিলিঙ্ক — ৬৪ জেলায় সরকারি ডিজিটাল স্বাস্থ্য বিপ্লব",
    en: "Medilink — Transforming Public Digital Healthcare Across 64 Districts",
  },
  missionLead: {
    bn: "গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের ডিজিটাল স্বাস্থ্য রূপকল্পের অংশ হিসেবে মেডিলিঙ্ক প্রতিষ্ঠিত। মধ্যরাতে রক্তের সন্ধানে দিশেহারা পরিবার থেকে শুরু করে প্রত্যন্ত অঞ্চলের সাধারণ নাগরিক—সবার জন্য জীবনরক্ষাকারী স্বাস্থ্যসেবা নিশ্চিত করাই আমাদের লক্ষ্য। বিএমডিসি-নিবন্ধিত চিকিৎসকদের বিনামূল্যে পরামর্শ এবং ৬৪ জেলায় স্বয়ংক্রিয় রক্তদাতা ম্যাচিং সম্পূর্ণ জনকল্যাণে নিবেদিত।",
    en: "Built as part of Bangladesh's national vision for universal digital health, Medilink eliminates geographical and financial barriers. From families desperately searching for blood at midnight to citizens in remote upazilas needing doctor guidance, we ensure immediate, verified care at zero cost.",
  },

  // Three Pillars
  pillarBloodTitle: {
    bn: "৬৪ জেলায় জরুরি রক্তের ম্যাচিং",
    en: "Emergency Blood Matching (64 Districts)",
  },
  pillarBloodBody: {
    bn: "রক্তের গ্রুপ ও উপাদান (হোল ব্লাড, প্লাটিলেট, প্লাজমা) অনুযায়ী ৬৪ জেলার ৪৯৫টি উপজেলায় সামঞ্জস্যপূর্ণ রক্তদাতাদের সাথে তাৎক্ষণিক সংযোগ।",
    en: "Instant ABO/Rh and blood component matching connecting patients with verified donors across all 495+ upazilas in 64 districts.",
  },
  pillarDocTitle: {
    bn: "বিনামূল্যে বিশেষজ্ঞ ডাক্তারের টেলিমেডিসিন",
    en: "100% Free Doctor Telemedicine",
  },
  pillarDocBody: {
    bn: "বিএমডিসি-নিবন্ধিত বিশেষজ্ঞ চিকিৎসকদের সাথে ঘরে বসেই বিনামূল্যে ডিজিটাল পরামর্শ। প্রেসক্রিপশন ও নির্দেশনা সংরক্ষণ যেকোনো জেলা থেকে।",
    en: "Connect directly with BMDC-verified doctors for telemedicine consultations, free prescriptions, and structured follow-ups.",
  },
  pillarGovTitle: {
    bn: "সরকারি ডিজিটাল স্বাস্থ্য উদ্যোগ",
    en: "Government Digital Health Initiative",
  },
  pillarGovBody: {
    bn: "স্বাস্থ্য সেবা বিভাগ ও সরকারি জরুরি হটলাইন ৯৯৯ এবং ১৬২৬৩-এর সাথে সংযুক্ত। চিকিৎসকদের দ্বারা প্রস্তুতকৃত নির্ভরযোগ্য স্বাস্থ্য নির্দেশনা।",
    en: "Aligned with national health policies and integrated with emergency helplines 999 and Shastho Batayon 16263 for seamless citizen care.",
  },

  // Stats
  statsEyebrow: { bn: "জাতীয় পরিসংখ্যান", en: "National Metrics" },
  statsTitle: { bn: "এক নজরে মেডিলিঙ্ক নেটওয়ার্ক", en: "Medilink Network at a Glance" },
  statDistricts: { val: "৬৪", valEn: "64", label: { bn: "জেলা কভারেজ", en: "Districts Covered" } },
  statUpazilas: { val: "৪৯৫+", valEn: "495+", label: { bn: "উপজেলা নেটওয়ার্ক", en: "Upazilas Connected" } },
  statFee: { val: "০ ৳", valEn: "0 ৳", label: { bn: "নাগরিক পরামর্শ ফি (সম্পূর্ণ ফ্রি)", en: "Cost to Citizens (100% Free)" } },
  statUptime: { val: "২৪/৭", valEn: "24/7", label: { bn: "জরুরি জাতীয় নেটওয়ার্ক", en: "Emergency Network Active" } },

  // DoGrid
  doEyebrow: { bn: "ডিজিটাল স্বাস্থ্য সেবা", en: "Digital Health Services" },
  doTitle: { bn: "মেডিলিঙ্কে আপনি যা করতে পারেন", en: "What You Can Do on Medilink" },
  doSub: {
    bn: "জরুরি রক্ত সন্ধান, বিনামূল্যে ডাক্তারের পরামর্শ এবং সরকারি স্বাস্থ্য নির্দেশিকা — তিনটি সহজ সেবা।",
    en: "Three core services — find blood, talk to a doctor for free, and access national health advisories.",
  },
  doFindDonor: { bn: "জরুরি রক্তদাতা খুঁজুন (৬৪ জেলা)", en: "Find Blood Donors (64 Districts)" },
  doFindDonorBody: {
    bn: "রক্তের গ্রুপ, উপাদান ও উপজেলা নির্বাচন করে মুহূর্তেই কাছের উপযুক্ত রক্তদাতাদের সাথে যোগাযোগ করুন।",
    en: "Select a blood group and upazila to immediately view compatible, verified donors nearest to the patient.",
  },
  doConsultDoc: { bn: "বিনামূল্যে বিশেষজ্ঞ ডাক্তারের পরামর্শ", en: "Free Doctor Telemedicine" },
  doConsultDocBody: {
    bn: "ঘরে বসেই বিএমডিসি-যাচাইকৃত ডাক্তারের সাথে অনলাইনে বিনামূল্যে স্বাস্থ্য পরামর্শ ও প্রেসক্রিপশন নিন।",
    en: "Consult verified physicians online without travel or fees, receiving secure digital medical advice.",
  },
  doUpdates: { bn: "জাতীয় স্বাস্থ্য নির্দেশিকা ও বুলেটিন", en: "National Health Advisories & Articles" },
  doUpdatesBody: {
    bn: "সরকারি স্বাস্থ্য বুলেটিন, রোগ প্রতিরোধ নির্দেশিকা এবং চিকিৎসকদের লেখা নির্ভরযোগ্য নিবন্ধসমূহ পড়ুন।",
    en: "Official public health guidelines, disease prevention campaigns, and articles written by licensed physicians.",
  },
  doOpen: { bn: "সেবা গ্রহণ করুন", en: "Access Service" },

  // Final CTA
  ctaLead: { bn: "জাতীয় স্বাস্থ্য সেবায় অংশ নিন", en: "Join the National Initiative" },
  ctaTitle: { bn: "জরুরি রক্তের প্রয়োজন? নাকি জীবন বাঁচাতে চান?", en: "Need blood urgently, or ready to save lives?" },
  ctaBody: {
    bn: "মেডিলিঙ্ক প্ল্যাটফর্মে দেশের যেকোনো জেলা থেকে রক্তদাতা খুঁজুন, রক্তের অনুরোধ জানান, অথবা অভিজ্ঞ চিকিৎসকের বিনামূল্যে পরামর্শ নিন।",
    en: "Search donors across Bangladesh, submit an emergency blood request, or talk to a verified doctor right now.",
  },
  ctaDonors: { bn: "রক্তদাতা খুঁজুন", en: "Find a Blood Donor" },
  ctaDoctors: { bn: "বিনামূল্যে ডাক্তার পরামর্শ", en: "Free Doctor Consultation" },
  ctaRequest: { bn: "জরুরি রক্ত অনুরোধ পোস্ট করুন", en: "Post Emergency Request" },
  ctaHelpline: { bn: "জরুরি হেল্পলাইন ও ৯৯৯", en: "Emergency Helplines (999)" },
} as const;

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

function Hero() {
  const { lang } = useAppShell();
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        el.querySelectorAll("[data-hero-reveal]"),
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.08, duration: 0.65 },
        0.1
      );
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="relative overflow-hidden" aria-labelledby="about-hero-h1">
      <div className="aurora absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-16 sm:pt-24 pb-8 sm:pb-12 text-center">
        {/* Government badge */}
        <div
          data-hero-reveal
          className="reveal-init inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft/70 px-4 py-1.5 text-xs font-bold text-brand-deep mb-5 shadow-2xs"
        >
          <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
          <span>{COPY.eyebrow[lang]}</span>
        </div>

        <h1
          id="about-hero-h1"
          data-hero-reveal
          className="reveal-init display mx-auto mt-2 max-w-5xl text-[clamp(2.25rem,5.2vw,4.5rem)] text-ink leading-[1.1]"
        >
          {COPY.heroTitle[lang]}
          <span className="text-brand"> {COPY.heroAccent[lang]}</span>
        </h1>

        <p
          data-hero-reveal
          className="reveal-init mx-auto mt-6 max-w-3xl text-base sm:text-lg text-muted leading-relaxed"
        >
          {COPY.heroBody[lang]}
        </p>

        {/* Quick Highlights Strip */}
        <div
          data-hero-reveal
          className="reveal-init mt-8 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm font-semibold text-ink"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 backdrop-blur-xs px-3.5 py-1.5 shadow-2xs">
            <MapPin className="h-4 w-4 text-brand" aria-hidden="true" />
            <span>{COPY.badgeDistricts[lang]}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 backdrop-blur-xs px-3.5 py-1.5 shadow-2xs">
            <Stethoscope className="h-4 w-4 text-brand" aria-hidden="true" />
            <span>{COPY.badgeTelemedicine[lang]}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 backdrop-blur-xs px-3.5 py-1.5 shadow-2xs">
            <Droplet className="h-4 w-4 text-blood" aria-hidden="true" />
            <span>{COPY.badgeBloodMatch[lang]}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 backdrop-blur-xs px-3.5 py-1.5 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
            <span>{COPY.badgeGov[lang]}</span>
          </span>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Mission & Core Pillars                                                      */
/* -------------------------------------------------------------------------- */

function Mission() {
  const { lang } = useAppShell();
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll("[data-mission-card]"),
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.55,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    },
    { scope: ref }
  );

  const pillars = [
    {
      icon: Droplet,
      tint: "text-blood",
      bgTint: "bg-blood-soft/60",
      title: COPY.pillarBloodTitle[lang],
      body: COPY.pillarBloodBody[lang],
      tag: lang === "bn" ? "৬৪ জেলা নেটওয়ার্ক" : "64 District Network",
    },
    {
      icon: Stethoscope,
      tint: "text-brand",
      bgTint: "bg-brand-soft/60",
      title: COPY.pillarDocTitle[lang],
      body: COPY.pillarDocBody[lang],
      tag: lang === "bn" ? "১০০% বিনামূল্যে" : "100% Free Consultation",
    },
    {
      icon: ShieldCheck,
      tint: "text-ink-brand",
      bgTint: "bg-ink-brand-soft/60",
      title: COPY.pillarGovTitle[lang],
      body: COPY.pillarGovBody[lang],
      tag: lang === "bn" ? "সরকারি স্বীকৃতি" : "Government Initiative",
    },
  ];

  return (
    <section
      ref={ref}
      className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24"
      aria-labelledby="mission-h2"
    >
      <SectionHeader
        eyebrow={COPY.missionEyebrow[lang]}
        title={<span id="mission-h2">{COPY.missionTitle[lang]}</span>}
        body={COPY.missionSub[lang]}
      />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 grid-flow-dense gap-4">
        {/* Full-width government initiative banner */}
        <div
          data-mission-card
          className="reveal-init md:col-span-3 group relative overflow-hidden rounded-3xl bg-brand p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start gap-5 shadow-sm"
        >
          <div
            className="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-white/5"
            aria-hidden="true"
          />
          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
            <ShieldCheck className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div>
            <span className="inline-block rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold text-white mb-2">
              {COPY.eyebrow[lang]}
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-white">
              {COPY.missionCardTitle[lang]}
            </h3>
            <p className="mt-2 text-sm sm:text-[15px] text-white/90 max-w-3xl leading-relaxed">
              {COPY.missionLead[lang]}
            </p>
          </div>
        </div>

        {/* 3 Pillars */}
        {pillars.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              data-mission-card
              className="reveal-init md:col-span-1 group relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-7 flex flex-col justify-between hover:border-line-strong hover:shadow-md transition-all duration-300"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${item.bgTint}`}>
                    <Icon
                      className={`h-5 w-5 transition-transform duration-500 ease-out group-hover:scale-110 ${item.tint}`}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-[11px] font-bold tracking-wide uppercase text-muted">
                    {item.tag}
                  </span>
                </div>
                <h3 className="mt-5 text-base sm:text-[17px] font-bold text-ink leading-snug">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-sm text-muted leading-relaxed">{item.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Stats — National Reach & Impact                                             */
/* -------------------------------------------------------------------------- */

function Stats() {
  const { lang } = useAppShell();
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll("[data-stat-card]"),
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    },
    { scope: ref }
  );

  const statsList = [
    {
      val: lang === "bn" ? COPY.statDistricts.val : COPY.statDistricts.valEn,
      label: COPY.statDistricts.label[lang],
      icon: MapPin,
      tint: "text-brand",
    },
    {
      val: lang === "bn" ? COPY.statUpazilas.val : COPY.statUpazilas.valEn,
      label: COPY.statUpazilas.label[lang],
      icon: Activity,
      tint: "text-ink-brand",
    },
    {
      val: lang === "bn" ? COPY.statFee.val : COPY.statFee.valEn,
      label: COPY.statFee.label[lang],
      icon: Stethoscope,
      tint: "text-brand-deep",
    },
    {
      val: lang === "bn" ? COPY.statUptime.val : COPY.statUptime.valEn,
      label: COPY.statUptime.label[lang],
      icon: Droplet,
      tint: "text-blood",
    },
  ];

  return (
    <section
      ref={ref}
      className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24"
      aria-labelledby="stats-h2"
    >
      <SectionHeader
        eyebrow={COPY.statsEyebrow[lang]}
        title={<span id="stats-h2">{COPY.statsTitle[lang]}</span>}
        body={
          lang === "bn"
            ? "সারাদেশের মানুষের কাছে জরুরি রক্তের সংযোগ ও স্বাস্থ্য সুরক্ষা পৌঁছে দিতে আমাদের বিস্তার।"
            : "Expanding universal digital health and blood connectivity across all districts of Bangladesh."
        }
      />

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statsList.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              data-stat-card
              className="reveal-init rounded-3xl border border-line bg-surface p-5 sm:p-6 text-center hover:border-line-strong transition-colors"
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-elevated/80 mb-3">
                <Icon className={`h-5 w-5 ${stat.tint}`} aria-hidden="true" />
              </div>
              <p className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
                {stat.val}
              </p>
              <p className="mt-1.5 text-xs sm:text-sm font-medium text-muted">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* DoGrid — What Citizens Can Do: Donors, Doctors, Health Guidelines           */
/* -------------------------------------------------------------------------- */

function DoGrid() {
  const { lang } = useAppShell();
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll("[data-do-card]"),
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.55,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    },
    { scope: ref }
  );

  const cards = [
    {
      icon: Droplet,
      tint: "text-blood",
      bgTint: "bg-blood-soft/60",
      title: COPY.doFindDonor[lang],
      body: COPY.doFindDonorBody[lang],
      to: "/donors",
      ariaLabel: lang === "bn" ? "৬৪ জেলায় জরুরি রক্তদাতা অনুসন্ধান পাতায় যান" : "Go to emergency blood donor search page",
    },
    {
      icon: Stethoscope,
      tint: "text-brand",
      bgTint: "bg-brand-soft/60",
      title: COPY.doConsultDoc[lang],
      body: COPY.doConsultDocBody[lang],
      to: "/doctors?guide=open",
      ariaLabel: lang === "bn" ? "বিনামূল্যে বিশেষজ্ঞ ডাক্তারের পরামর্শ পাতায় যান" : "Go to free doctor telemedicine page",
    },
    {
      icon: Megaphone,
      tint: "text-ink-brand",
      bgTint: "bg-ink-brand-soft/60",
      title: COPY.doUpdates[lang],
      body: COPY.doUpdatesBody[lang],
      to: "/articles",
      ariaLabel: lang === "bn" ? "জাতীয় স্বাস্থ্য নির্দেশিকা ও নিবন্ধ পাতায় যান" : "Go to national health advisories and articles page",
    },
  ];

  return (
    <section
      ref={ref}
      className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24"
      aria-labelledby="do-h2"
    >
      <SectionHeader
        eyebrow={COPY.doEyebrow[lang]}
        title={<span id="do-h2">{COPY.doTitle[lang]}</span>}
        body={COPY.doSub[lang]}
      />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 grid-flow-dense gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.to}
              to={card.to}
              aria-label={card.ariaLabel}
              data-do-card
              className="reveal-init md:col-span-1 group relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-7 flex flex-col justify-between hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div>
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${card.bgTint}`}>
                  <Icon
                    className={`h-5 w-5 transition-transform duration-500 ease-out group-hover:scale-110 ${card.tint}`}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-5 text-[17px] font-bold text-ink leading-snug">{card.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{card.body}</p>
              </div>
              <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between">
                <span className="text-sm font-semibold text-brand group-hover:text-brand-deep">
                  {COPY.doOpen[lang]}
                </span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA (Action)                                                          */
/* -------------------------------------------------------------------------- */

function FinalCta() {
  const { t, lang } = useAppShell();
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll("[data-cta-reveal]"),
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.1,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    },
    { scope: ref }
  );

  return (
    <section
      ref={ref}
      className="mx-auto max-w-7xl px-4 sm:px-6 mt-20 sm:mt-28 mb-16"
      aria-label={COPY.ctaTitle[lang]}
    >
      <div className="grain relative overflow-hidden rounded-[2.5rem] bg-brand px-6 py-16 sm:px-12 sm:py-20 text-center shadow-lg">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(42rem 30rem at 80% -10%, rgba(138,27,46,0.42), transparent 60%), radial-gradient(36rem 28rem at 8% 110%, rgba(215,38,61,0.22), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-3xl">
          <p
            data-cta-reveal
            className="reveal-init inline-block rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white"
          >
            {COPY.ctaLead[lang]}
          </p>
          <h2
            data-cta-reveal
            className="reveal-init display mt-4 text-[clamp(2rem,4.5vw,3.5rem)] text-white leading-tight"
          >
            {COPY.ctaTitle[lang]}
          </h2>
          <p data-cta-reveal className="reveal-init mx-auto mt-4 max-w-2xl text-base text-white/90 leading-relaxed">
            {COPY.ctaBody[lang]}
          </p>

          <div
            data-cta-reveal
            className="reveal-init mt-8 flex flex-wrap items-center justify-center gap-3.5"
          >
            <Link
              to="/donors"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-brand hover:bg-white/90 hover:-translate-y-0.5 transition-all duration-300 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            >
              <Droplet className="h-4.5 w-4.5 text-blood" strokeWidth={2} aria-hidden="true" />
              <span>{COPY.ctaDonors[lang]}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/doctors?guide=open"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/40 bg-white/10 backdrop-blur-xs px-7 text-[15px] font-semibold text-white hover:bg-white/20 hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            >
              <Stethoscope className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
              <span>{COPY.ctaDoctors[lang]}</span>
            </Link>
          </div>

          <div
            data-cta-reveal
            className="reveal-init mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-white/80"
          >
            <Link
              to="/requests/new"
              className="underline hover:text-white transition-colors"
            >
              {COPY.ctaRequest[lang]}
            </Link>
            <span>·</span>
            <Link
              to="/helpline"
              className="underline hover:text-white transition-colors"
            >
              {COPY.ctaHelpline[lang]}
            </Link>
          </div>

          <p data-cta-reveal className="reveal-init mt-6 text-xs text-white/70">
            {t("footer.notice")}
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function About() {
  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <Hero />
      <Mission />
      <Stats />
      <DoGrid />
      <FinalCta />
    </div>
  );
}
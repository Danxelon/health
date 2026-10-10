/**
 * <design_plan>
 * 1. RNG (seed = "About".length % 101 = 5):
 *    random.choice("Hero")      -> "Editorial claim" — one big two-line H1, soft aurora, no buttons
 *    random.choice("Component") -> "Privacy triptych" — three bordered rounded-3xl cards
 *    random.choice("GSAP")      -> "intro rise + card stagger + timeline rail scrub-draw"
 *    random.choice("Fonts")     -> "Cabinet Grotesk / Satoshi" — the brand stack, never Inter
 * 2. AIDA: attention  = editorial hero claim ("nearby help, kept private");
 *    interest         = mission bento naming who it serves;
 *    desire           = privacy triptych + the principles timeline;
 *    action           = maroon final CTA offering /donors and /doctors.
 * 3. Hero math: H1 `max-w-6xl` with clamp(2.5rem, 5.6vw, 4.75rem) keeps the ~20-glyph
 *    Bengali phrase on exactly 2 lines at 320px and at 1440px. No stamps, no hero pill tags.
 * 4. Bento density: mission grid md:grid-cols-3 grid-flow-dense [3,1,1,1] = 6 cells / 2 full rows;
 *    privacy  grid md:grid-cols-3 grid-flow-dense [3,1,1,1] = 6 cells / 2 full rows;
 *    principles  md:grid-cols-4 = 4 cells / 1 full row. 16/16 filled, zero voids.
 * 5. Label sweep: no "SECTION 01", no emoji; primary CTA bg-brand + white text (AA on both themes),
 *    secondary border-line; maroon panels carry ink-brand-soft text so AA holds in light and dark.
 * </design_plan>
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  Droplet,
  HeartPulse,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { SectionHeader } from "@/components/ui.tsx";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const COPY = {
  heroTitle: { bn: "কাছের সাহায্য,", en: "Help close by," },
  heroAccent: { bn: "গোপন রাখা।", en: "kept private." },
  heroBody: {
    bn: "রক্তদাতা, ডাক্তার ও স্বাস্থ্য তথ্য — এক জায়গায়। জরুরি মুহূর্তে কাছের সাহায্য, আর প্রতিটি ধাপে গোপনীয়তা।",
    en: "Donors, doctors, and health information in one place — nearby help in a crisis, and privacy at every step.",
  },
  heroTrust: {
    bn: "নিবন্ধন থেকে প্রকাশ — প্রতিটি ধাপে গোপনীয়তা।",
    en: "From registration to release — privacy at every step.",
  },

  missionTitle: { bn: "আমরা যা করি", en: "What we do" },
  missionSub: {
    bn: "রক্ত, ডাক্তার আর স্বাস্থ্য তথ্য — প্রতিটি উপজেলায় পৌঁছে দেওয়া।",
    en: "Blood, doctors, and health guidance — reachable from every upazila.",
  },
  missionCardTitle: { bn: "জীবন রক্ষা মানে কাছের সাহায্য", en: "Jibon Rokkha means help that is close" },
  missionLead: {
    bn: "জীবন রক্ষা একটি সেবামূলক প্ল্যাটফর্ম — বাংলাদেশের প্রতিটি উপজেলায় স্বাস্থ্যসেবা পৌঁছানোর জন্য। রক্ত প্রয়োজন হলে নিকটস্থ সামঞ্জস্যপূর্ণ রক্তদাতা খুঁজে পাই, ডাক্তারি পরামর্শের ব্যবস্থা করি, আর ডাক্তারদের লেখা নির্ভরযোগ্য স্বাস্থ্য তথ্য প্রকাশ করি।",
    en: "Jibon Rokkha is a public-health platform — built to bring care to every upazila of Bangladesh. When blood is needed, we surface the compatible donors nearest to you; when you need guidance, we connect you to a doctor; when you need to understand, we publish health information written by the doctors themselves.",
  },
  whoPatients: { bn: "মধ্যরাতে যারা রক্ত খুঁজছেন", en: "A family searching at 2 a.m." },
  whoPatientsBody: {
    bn: "কাছের, নির্ভরযোগ্য রক্তদাতা — কয়েক মিনিটের মধ্যে।",
    en: "A reliable donor nearby — within minutes.",
  },
  whoDonors: { bn: "পাশের বাড়ির রক্তদাতা", en: "The donor next door" },
  whoDonorsBody: {
    bn: "যদি পারেন, বাঁচাতে পারেন — দূরত্ব শুধু ব্যান্ডে।",
    en: "If you can, you can save — distance stays a band.",
  },
  whoDoctors: { bn: "প্রতিটি উপজেলার ডাক্তার", en: "A doctor in every upazila" },
  whoDoctorsBody: {
    bn: "যাচাইকৃত ডাক্তারের পরামর্শ, নথিবদ্ধ বার্তায়।",
    en: "Advice from verified doctors, in a recorded thread.",
  },

  privacyTitle: { bn: "গোপনীয়তা কীভাবে কাজ করে", en: "How privacy works" },
  privacySub: {
    bn: "তিনটি স্তরে গোপনীয়তা — পরিচয়, যোগাযোগ আর অবস্থান।",
    en: "Privacy in three layers — identity, contact, location.",
  },
  privacyBannerTitle: { bn: "দুটি নিয়ম আমরা কখনো ভাঙি না", en: "Two rules we never break" },
  privacyBannerBody: {
    bn: "জাতীয় পরিচয়পত্র কখনো সরাসরি সংরক্ষিত হয় না, এবং অনুসন্ধানে কখনো সঠিক অবস্থান দেখা যায় না।",
    en: "Your national ID is never stored as written, and a search never reveals your exact location.",
  },
  nidTitle: { bn: "এনআইডি কখনো সরাসরি নয়", en: "NID is never stored as written" },
  nidBody: {
    bn: "নিবন্ধনের সময় পুরো নম্বরটি কোথাও লেখা হয় না — শুধু একটি অপরিবর্তনীয় হ্যাশ ও শেষ ৪ সংখ্যা রাখা হয়।",
    en: "The full number is never written down at registration — only a one-way hash and the last four digits are kept.",
  },
  phoneTitle: { bn: "রাজি হলে তবে নম্বর", en: "Contact, only after acceptance" },
  phoneBody: {
    bn: "রক্তদাতা রাজি না করা পর্যন্ত ফোন নম্বর কারো কাছে প্রকাশ হয় না — প্রতিটি প্রকাশ লিপিবদ্ধ থাকে।",
    en: "A donor's phone number is released to no one until the donor accepts — and every release is logged.",
  },
  locationTitle: { bn: "সঠিক অবস্থান কখনো নয়", en: "Never an exact location" },
  locationBody: {
    bn: "অনুসন্ধানে শুধু দূরত্বের ব্যান্ড দেখানো হয় — ঠিকানা বা সঠিক স্থানাঙ্ক কখনো ফেরত দেওয়া হয় না।",
    en: "Search returns only a distance band — an address or exact coordinates are never shared.",
  },

  timelineEyebrow: { bn: "আমাদের অঙ্গীকার", en: "Our commitments" },
  timelineTitle: { bn: "আমাদের নীতি", en: "Our principles" },
  timelineSub: {
    bn: "নিবন্ধন থেকে প্রতিটি প্রকাশ — কোন নীতি কোথায় প্রযোজ্য।",
    en: "From registration to every release — the rule that governs each step.",
  },

  ctaLead: { bn: "সঙ্গে শুরু করুন", en: "Start here" },
  ctaTitle: { bn: "রক্তের প্রয়োজন? নাকি দিতে পারেন?", en: "Need blood, or ready to give?" },
  ctaBody: {
    bn: "দুটি পথ — কাছের রক্তদাতা খুঁজুন, অথবা ডাক্তারের পরামর্শ নিন।",
    en: "Two ways in — find a nearby donor, or consult a doctor.",
  },
  ctaDonors: { bn: "রক্তদাতা খুঁজুন", en: "Find a donor" },
  ctaDoctors: { bn: "ডাক্তারের সাথে কথা বলুন", en: "Talk to a doctor" },
} as const;

const PRINCIPLES = [
  {
    title: { bn: "পরিচয় হ্যাশে সুরক্ষিত", en: "Identity stays hashed" },
    body: {
      bn: "যাচাইয়ের পর এনআইডি শুধু একটি হ্যাশ হয়ে থেকে যায়।",
      en: "After verification, an NID exists only as a hash.",
    },
  },
  {
    title: { bn: "সম্মতি ছাড়া যোগাযোগ নেই", en: "No contact without consent" },
    body: {
      bn: "যোগাযোগের তথ্য দুই পক্ষের সম্মতিতে তবেই ছড়ায়।",
      en: "Contact passes only when both sides say yes.",
    },
  },
  {
    title: { bn: "দূরত্বই একমাত্র তথ্য", en: "Distance is all we share" },
    body: {
      bn: "অনুসন্ধানে শুধু দূরত্বের ব্যান্ড — দিক বা ঠিকানা নয়।",
      en: "Search shares a distance band — never a direction or address.",
    },
  },
  {
    title: { bn: "প্রতিটি প্রকাশ লিপিবদ্ধ", en: "Every release is logged" },
    body: {
      bn: "যোগাযোগ দেখার প্রতিটি ঘটনা প্রোফাইলে থেকে যায়।",
      en: "Every contact view stays on your profile record.",
    },
  },
];

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

function Hero() {
  const { t, lang } = useAppShell();
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        el.querySelectorAll("[data-hero-reveal]"),
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.1, duration: 0.7 },
        0.15
      );
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="relative overflow-hidden" aria-labelledby="about-hero-h1">
      <div className="aurora absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-16 sm:pt-24 pb-8 sm:pb-14 text-center">
        <p
          data-hero-reveal
          className="reveal-init text-xs font-semibold uppercase tracking-[0.18em] text-ink-brand"
        >
          {t("footer.about")}
        </p>

        <h1
          id="about-hero-h1"
          data-hero-reveal
          className="reveal-init display mx-auto mt-4 max-w-6xl text-[clamp(2.5rem,5.6vw,4.75rem)] text-ink"
        >
          {COPY.heroTitle[lang]}
          <span className="text-brand"> {COPY.heroAccent[lang]}</span>
        </h1>

        <p
          data-hero-reveal
          className="reveal-init mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted"
        >
          {COPY.heroBody[lang]}
        </p>

        <div
          data-hero-reveal
          className="reveal-init mx-auto mt-8 flex items-center justify-center gap-2 text-xs text-muted"
        >
          <ShieldCheck className="h-4 w-4 text-success" strokeWidth={1.8} aria-hidden="true" />
          <span>{COPY.heroTrust[lang]}</span>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Mission — bento: one full-width statement + who it serves                   */
/* -------------------------------------------------------------------------- */

function Mission() {
  const { t, lang } = useAppShell();
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll("[data-mission-card]"),
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    },
    { scope: ref }
  );

  const who = [
    { icon: HeartPulse, tint: "text-blood", title: COPY.whoPatients[lang], body: COPY.whoPatientsBody[lang] },
    { icon: Droplet, tint: "text-brand", title: COPY.whoDonors[lang], body: COPY.whoDonorsBody[lang] },
    { icon: Stethoscope, tint: "text-ink-brand", title: COPY.whoDoctors[lang], body: COPY.whoDoctorsBody[lang] },
  ];

  return (
    <section
      ref={ref}
      className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24"
      aria-labelledby="mission-h2"
    >
      <SectionHeader
        eyebrow={t("app.name")}
        title={<span id="mission-h2">{COPY.missionTitle[lang]}</span>}
        body={COPY.missionSub[lang]}
      />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 grid-flow-dense gap-3">
        <div
          data-mission-card
          className="reveal-init md:col-span-3 group relative overflow-hidden rounded-3xl bg-ink-brand p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start gap-5"
        >
          <div
            className="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-white/5"
            aria-hidden="true"
          />
          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-ink-brand-soft">
            <ShieldCheck className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-ink-brand-soft">
              {COPY.missionCardTitle[lang]}
            </h3>
            <p className="mt-2 text-sm sm:text-[15px] text-ink-brand-soft/75 max-w-2xl leading-relaxed">
              {COPY.missionLead[lang]}
            </p>
          </div>
        </div>

        {who.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              data-mission-card
              className="reveal-init md:col-span-1 group relative overflow-hidden rounded-3xl border border-line bg-surface p-6"
            >
              <Icon
                className={`h-6 w-6 transition-transform duration-700 ease-out group-hover:scale-110 ${item.tint}`}
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <h3 className="mt-4 text-[15px] font-bold text-ink">{item.title}</h3>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Privacy — banner thesis + the mandated NID / phone / location triptych      */
/* -------------------------------------------------------------------------- */

function Privacy() {
  const { t, lang } = useAppShell();
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll("[data-privacy-card]"),
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.55,
          stagger: 0.09,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    },
    { scope: ref }
  );

  const cards = [
    { icon: ShieldCheck, tint: "text-brand", title: COPY.nidTitle[lang], body: COPY.nidBody[lang] },
    { icon: Phone, tint: "text-ink-brand", title: COPY.phoneTitle[lang], body: COPY.phoneBody[lang] },
    { icon: MapPin, tint: "text-blood", title: COPY.locationTitle[lang], body: COPY.locationBody[lang] },
  ];

  return (
    <section
      ref={ref}
      className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24"
      aria-labelledby="privacy-h2"
    >
      <SectionHeader
        eyebrow={t("footer.legal")}
        title={<span id="privacy-h2">{COPY.privacyTitle[lang]}</span>}
        body={COPY.privacySub[lang]}
      />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 grid-flow-dense gap-3">
        <div
          data-privacy-card
          className="reveal-init md:col-span-3 rounded-3xl border border-line-strong bg-elevated p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4"
        >
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
            <Lock className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-[15px] font-bold text-ink">{COPY.privacyBannerTitle[lang]}</h3>
            <p className="mt-1 text-sm text-muted">{COPY.privacyBannerBody[lang]}</p>
          </div>
        </div>

        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              data-privacy-card
              className="reveal-init md:col-span-1 rounded-3xl border border-line bg-surface p-6"
            >
              <Icon className={`h-6 w-6 ${card.tint}`} strokeWidth={1.8} aria-hidden="true" />
              <h3 className="mt-4 text-[15px] font-bold text-ink">{card.title}</h3>
              <p className="mt-1 text-sm text-muted">{card.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Principles — a stepped timeline with a scrubbed drawing rail                */
/* -------------------------------------------------------------------------- */

function Principles() {
  const { lang } = useAppShell();
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;

      const rail = el.querySelector(".timeline-rail");
      if (rail) {
        gsap.fromTo(
          rail,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top 78%", scrub: 0.6 },
          }
        );
      }

      gsap.fromTo(
        el.querySelectorAll("[data-principle]"),
        { y: 26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.55,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 82%" },
        }
      );
    },
    { scope: ref }
  );

  return (
    <section
      ref={ref}
      className="mx-auto max-w-7xl px-4 sm:px-6 mt-20 sm:mt-28"
      aria-labelledby="principles-h2"
    >
      <SectionHeader
        eyebrow={COPY.timelineEyebrow[lang]}
        title={<span id="principles-h2">{COPY.timelineTitle[lang]}</span>}
        body={COPY.timelineSub[lang]}
      />

      <div className="mt-10 relative">
        <div
          className="timeline-rail absolute left-6 right-6 top-6 hidden h-px origin-left bg-line-strong md:block"
          aria-hidden="true"
        />
        <ol className="grid grid-cols-1 md:grid-cols-4 grid-flow-dense gap-10 sm:gap-6">
          {PRINCIPLES.map((step, i) => (
            <li key={step.title.en} data-principle className="reveal-init md:col-span-1 relative">
              <div className="flex items-start gap-4 md:block">
                <span className="relative z-10 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-brand-deep font-bold tnum">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="md:mt-4">
                  <h3 className="text-[15px] font-bold text-ink">{step.title[lang]}</h3>
                  <p className="mt-1.5 text-sm text-muted">{step.body[lang]}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
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
      className="mx-auto max-w-7xl px-4 sm:px-6 mt-20 sm:mt-28"
      aria-label={COPY.ctaTitle[lang]}
    >
      <div className="grain relative overflow-hidden rounded-[2rem] bg-ink-brand px-6 py-16 sm:px-12 sm:py-20 text-center">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(42rem 30rem at 80% -10%, rgba(14,124,110,0.42), transparent 60%), radial-gradient(36rem 28rem at 8% 110%, rgba(215,38,61,0.22), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-3xl">
          <p
            data-cta-reveal
            className="reveal-init text-xs font-semibold uppercase tracking-[0.18em] text-ink-brand-soft"
          >
            {COPY.ctaLead[lang]}
          </p>
          <h2
            data-cta-reveal
            className="reveal-init display mt-3 text-[clamp(2rem,4.5vw,3.5rem)] text-ink-brand-soft"
          >
            {COPY.ctaTitle[lang]}
          </h2>
          <p data-cta-reveal className="reveal-init mx-auto mt-4 max-w-xl text-[15px] text-ink-brand-soft/75">
            {COPY.ctaBody[lang]}
          </p>

          <div
            data-cta-reveal
            className="reveal-init mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              to="/donors"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white hover:bg-brand-deep hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            >
              <Droplet className="h-4.5 w-4.5" strokeWidth={2} aria-hidden="true" />
              {COPY.ctaDonors[lang]}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/doctors"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-ink-brand-soft/30 bg-white/5 px-7 text-[15px] font-semibold text-ink-brand-soft hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            >
              <Stethoscope className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
              {COPY.ctaDoctors[lang]}
            </Link>
          </div>

          <p data-cta-reveal className="reveal-init mt-5 text-xs text-ink-brand-soft/60">
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
      <Privacy />
      <Principles />
      <FinalCta />
    </div>
  );
}
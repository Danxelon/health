/**
 * <design_plan>
 * 1. RNG (seed = "About".length % 101 = 5):
 *    random.choice("Hero")      -> "Editorial claim" — one big two-line H1, soft aurora, no buttons
 *    random.choice("Component") -> "Three plain ways in" — bordered rounded-3xl bento cards
 *    random.choice("GSAP")      -> "intro rise + card stagger"
 *    random.choice("Fonts")     -> "Cabinet Grotesk / Satoshi" — the brand stack, never Inter
 * 2. AIDA: attention  = editorial hero claim ("nearby help, lives on");
 *    interest         = mission bento naming who it serves;
 *    desire           = the do-grid — donors, doctors, national updates;
 *    action           = maroon final CTA landing on the two roads in (/donors, /doctors).
 * 3. Hero math: H1 `max-w-6xl` with clamp(2.5rem, 5.6vw, 4.75rem) keeps the ~20-glyph
 *    Bengali phrase on exactly 2 lines at 320px and at 1440px. No stamps, no hero pill tags.
 * 4. Bento density: mission grid md:grid-cols-3 grid-flow-dense [3,1,1,1] = 6 cells / 2 full rows;
 *    do-grid md:grid-cols-3 grid-flow-dense [1,1,1] = 3 cells / 1 full row. All cells filled.
 * 5. Label sweep: no "SECTION 01", no emoji; primary CTA bg-white on the maroon panel (AA in both
 *    themes), secondary border-white/30; no privacy claims — the page speaks to what the
 *    platform does, never to how NID or contact is stored.
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
  Megaphone,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { SectionHeader } from "@/components/ui.tsx";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const COPY = {
  heroTitle: { bn: "কাছের সাহায্য,", en: "Help close by," },
  heroAccent: { bn: "দীর্ঘজীবী হোক।", en: "lives on." },
  heroBody: {
    bn: "রক্তদাতা, ডাক্তার আর স্বাস্থ্য তথ্য — এক জায়গায়। জরুরি মুহূর্তে কাছের সঙ্গতিপূর্ণ রক্তদাতা, যেকোনো উপজেলা থেকে ডাক্তারি পরামর্শ, আর ডাক্তারদের লেখা নির্ভরযোগ্য স্বাস্থ্য তথ্য।",
    en: "Donors, doctors, and health information — in one place. A compatible donor nearby in a crisis, doctor consultations from every upazila, and health guidance written by the doctors.",
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
    bn: "পাশের মানুষটিই পারেন বাঁচাতে — কয়েক মিনিটেই।",
    en: "The person next door can be the one who saves — within minutes.",
  },
  whoDoctors: { bn: "প্রতিটি উপজেলার ডাক্তার", en: "A doctor in every upazila" },
  whoDoctorsBody: {
    bn: "যাচাইকৃত ডাক্তারের পরামর্শ, নথিবদ্ধ বার্তায়।",
    en: "Advice from verified doctors, in a recorded thread.",
  },

  doEyebrow: { bn: "আজই শুরু করুন", en: "Take the first step" },
  doTitle: { bn: "এখানে যা করতে পারেন", en: "What you can do here" },
  doSub: {
    bn: "তিনটি কাজ — রক্তদাতা খুঁজুন, ডাক্তারের সাথে কথা বলুন, আর জাতীয় স্বাস্থ্য নির্দেশনা দেখুন।",
    en: "Three things — find a donor, talk to a doctor, and follow the national health guidance.",
  },
  doFindDonor: { bn: "সঙ্গতিপূর্ণ রক্তদাতা খুঁজুন", en: "Find a matched donor" },
  doFindDonorBody: {
    bn: "রক্তের গ্রুপ ও উপজেলা দিন — যারা দিতে পারবেন, কাছের মানুষকে দেখতে পাবেন।",
    en: "Give a blood group and an upazila; see the compatible people nearest to you.",
  },
  doConsultDoc: { bn: "ডাক্তারের সাথে কথা বলুন", en: "Consult a doctor" },
  doConsultDocBody: {
    bn: "প্রতিটি উপজেলায় অন্তত একজন ডাক্তার — কয়েক মিনিটেই সাক্ষাৎ নিন।",
    en: "At least one doctor in every upazila — book a consultation in minutes.",
  },
  doUpdates: { bn: "জাতীয় স্বাস্থ্য আপডেট", en: "National health updates" },
  doUpdatesBody: {
    bn: "সরকারি নির্দেশনা, কর্মসূচি ও ঘোষণা — ডাক্তারদের লেখা নিবন্ধসহ।",
    en: "Official advisories, campaigns and notices — alongside doctor-written articles.",
  },
  doOpen: { bn: "খুলুন", en: "Open" },

  ctaLead: { bn: "সঙ্গে শুরু করুন", en: "Start here" },
  ctaTitle: { bn: "রক্তের প্রয়োজন? নাকি দিতে পারেন?", en: "Need blood, or ready to give?" },
  ctaBody: {
    bn: "দুটি পথ — কাছের রক্তদাতা খুঁজুন, অথবা ডাক্তারের পরামর্শ নিন।",
    en: "Two ways in — find a nearby donor, or consult a doctor.",
  },
  ctaDonors: { bn: "রক্তদাতা খুঁজুন", en: "Find a donor" },
  ctaDoctors: { bn: "ডাক্তারের সাথে কথা বলুন", en: "Talk to a doctor" },
} as const;

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
          className="reveal-init md:col-span-3 group relative overflow-hidden rounded-3xl bg-brand p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start gap-5"
        >
          <div
            className="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-white/5"
            aria-hidden="true"
          />
          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
            <ShieldCheck className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-white">
              {COPY.missionCardTitle[lang]}
            </h3>
            <p className="mt-2 text-sm sm:text-[15px] text-white/80 max-w-2xl leading-relaxed">
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
/* DoGrid — what the platform lets you do: donors, doctors, national updates   */
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
        { y: 26, opacity: 0 },
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
      tint: "text-brand",
      title: COPY.doFindDonor[lang],
      body: COPY.doFindDonorBody[lang],
      to: "/donors",
    },
    {
      icon: Stethoscope,
      tint: "text-ink-brand",
      title: COPY.doConsultDoc[lang],
      body: COPY.doConsultDocBody[lang],
      to: "/doctors?guide=open",
    },
    {
      icon: Megaphone,
      tint: "text-blood",
      title: COPY.doUpdates[lang],
      body: COPY.doUpdatesBody[lang],
      to: "/articles",
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

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 grid-flow-dense gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.to}
              to={card.to}
              data-do-card
              className="reveal-init md:col-span-1 group relative overflow-hidden rounded-3xl border border-line bg-surface p-6 hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
            >
              <Icon
                className={`h-6 w-6 transition-transform duration-700 ease-out group-hover:scale-110 ${card.tint}`}
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <h3 className="mt-4 text-[15px] font-bold text-ink">{card.title}</h3>
              <p className="mt-1 text-sm text-muted">{card.body}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                {COPY.doOpen[lang]}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
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
      className="mx-auto max-w-7xl px-4 sm:px-6 mt-20 sm:mt-28"
      aria-label={COPY.ctaTitle[lang]}
    >
      <div className="grain relative overflow-hidden rounded-[2rem] bg-brand px-6 py-16 sm:px-12 sm:py-20 text-center">
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
            className="reveal-init text-xs font-semibold uppercase tracking-[0.18em] text-white"
          >
            {COPY.ctaLead[lang]}
          </p>
          <h2
            data-cta-reveal
            className="reveal-init display mt-3 text-[clamp(2rem,4.5vw,3.5rem)] text-white"
          >
            {COPY.ctaTitle[lang]}
          </h2>
          <p data-cta-reveal className="reveal-init mx-auto mt-4 max-w-xl text-[15px] text-white/80">
            {COPY.ctaBody[lang]}
          </p>

          <div
            data-cta-reveal
            className="reveal-init mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              to="/donors"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-brand hover:bg-white/90 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            >
              <Droplet className="h-4.5 w-4.5" strokeWidth={2} aria-hidden="true" />
              {COPY.ctaDonors[lang]}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/doctors?guide=open"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 bg-white/5 px-7 text-[15px] font-semibold text-white hover:bg-white/10 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            >
              <Stethoscope className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
              {COPY.ctaDoctors[lang]}
            </Link>
          </div>

          <p data-cta-reveal className="reveal-init mt-5 text-xs text-white/70">
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
      <DoGrid />
      <FinalCta />
    </div>
  );
}
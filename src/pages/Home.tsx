/**
 * Home — AIDA Structure & High-End Design
 * Rebranded for medilink (মেডিলিঙ্ক) with seamless theme & language reactivity
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  Building2,
  Droplet,
  Megaphone,
  Stethoscope,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import { fetchArticles } from "@/api/articles.ts";
import { fetchNationalUpdates } from "@/api/health-updates.ts";
import type { ArticleFeedItem, NationalHealthUpdate } from "@/domain/types.ts";
import BloodBankStockCard from "@/components/BloodBankStockCard.tsx";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

/** Resolved theme (light|dark) as actually applied to <html data-theme>. */
function useResolvedDark(): boolean {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.getAttribute("data-theme") === "dark";
  });

  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setIsDark(el.getAttribute("data-theme") === "dark");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  return isDark;
}

function Hero() {
  const { t, lang } = useAppShell();
  const { requireAuth } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const isDark = useResolvedDark();

  // Theme-reactive hero logo: the light wordmark carries a transparent
  // background and reads on light surfaces; the dark wordmark is built for
  // dark surfaces (the previous logo.png was a white-boxed raster that
  // floated awkwardly on the dark hero).
  const logoSrc = isDark ? "/logo-dark.png" : "/logo-light.png";

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll("[data-hero-reveal]"),
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.12, duration: 0.8, ease: "power3.out" }
      );
    },
    { scope: ref }
  );

  return (
    <section
      ref={ref}
      className="relative overflow-hidden scroll-mt-20 pt-12 pb-16 md:pt-20 md:pb-24 border-b border-line bg-gradient-to-b from-surface via-surface to-elevated/40"
      aria-labelledby="hero-h1"
    >
      <div className="aurora absolute inset-0 -z-10 opacity-70" aria-hidden="true" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
        {/* medilink full logo in the main screen */}
        <img
          data-hero-reveal
          src={logoSrc}
          alt="medilink — মেডিলিঙ্ক"
          className="mx-auto h-72 sm:h-80 w-auto max-w-full object-contain"
        />

        {/* Hero Title — Bangladesh's First Intelligent Blood Matching Network */}
        <h1
          id="hero-h1"
          data-hero-reveal
          className="display mx-auto max-w-5xl text-[clamp(2.5rem,5.5vw,4.75rem)] text-ink leading-[1.05] break-words [overflow-wrap:anywhere] text-balance"
        >
          {lang === "bn" ? (
            <>
              বাংলাদেশের প্রথম{" "}
              <span className="text-brand">ইন্টেলিজেন্ট ব্লাড ম্যাচিং নেটওয়ার্ক</span>
            </>
          ) : (
            <>
              Bangladesh&rsquo;s First{" "}
              <span className="text-brand">Intelligent Blood Matching Network</span>
            </>
          )}
        </h1>

        {/* Hero Sub-copy */}
        <p
          data-hero-reveal
          className="mx-auto mt-6 max-w-2xl text-base sm:text-xl text-muted font-normal leading-relaxed"
        >
          {lang === "bn"
            ? "সময় যখন জরুরি, আপনার উপযুক্ত রক্তদাতা ভাবনার চেয়েও কাছে।"
            : "When time matters, your matching donor is closer than you think."}
        </p>

        {/* Main CTAs */}
        <div data-hero-reveal className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => requireAuth("/donors")}
            className="w-full sm:w-auto inline-flex h-14 items-center justify-center gap-3 rounded-full bg-brand px-8 text-base font-bold text-white shadow-lg hover:bg-brand-deep hover:shadow-xl transition-all cursor-pointer active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            <Droplet className="h-5 w-5 fill-current" />
            <span>{t("home.ctaPrimary")}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => requireAuth("/doctors?guide=open")}
            className="w-full sm:w-auto inline-flex h-14 items-center justify-center gap-3 rounded-full border-2 border-ink-brand bg-surface px-8 text-base font-bold text-ink-brand hover:bg-ink-brand-soft transition-all cursor-pointer active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-ink-brand focus:ring-offset-2"
          >
            <Stethoscope className="h-5 w-5" />
            <span>{t("home.ctaSecondary")}</span>
          </button>
        </div>

        {/* Trust Badges Bar */}
        <div
          data-hero-reveal
          className="mt-10 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs sm:text-sm font-semibold text-muted"
        >
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            {lang === "bn" ? "১০০% বিনামূল্যে সেবা" : "100% Free Public Service"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            {lang === "bn" ? "বিএমডিসি যাচাইকৃত ডাক্তার" : "BMDC-Verified Doctors"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            {lang === "bn" ? "তাৎক্ষণিক লোকেশন ম্যাচিং" : "Real-time Location Matching"}
          </span>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Action Options Bento Grid                                                  */
/* -------------------------------------------------------------------------- */

function ActionOptions() {
  const { t, lang } = useAppShell();
  const { requireAuth } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll("[data-option]"),
        { y: 32, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.15,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
        }
      );
    },
    { scope: ref }
  );

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20" ref={ref} aria-labelledby="actions-h2">
      <h2 id="actions-h2" className="sr-only">
        {t("donors.title")} · {t("doctors.title")}
      </h2>

      <div className="grid gap-6 md:grid-cols-2 grid-flow-dense">
        {/* Option 1 — matched donor */}
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              requireAuth("/donors");
            }
          }}
          onClick={() => requireAuth("/donors")}
          data-option
          className="group relative overflow-hidden rounded-[2.5rem] border border-brand/20 bg-gradient-to-br from-surface via-surface to-brand-soft/30 dark:to-brand-soft/10 p-8 sm:p-12 text-ink flex flex-col justify-between min-h-[20rem] shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-brand"
        >
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-brand/10 blur-2xl" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-xs">
              <Droplet className="h-7 w-7 fill-current" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider bg-brand-soft text-brand-deep px-3.5 py-1.5 rounded-full border border-brand/20">
              {lang === "bn" ? "মেডিলিঙ্ক ব্লাড ম্যাচ" : "medilink Blood Match"}
            </span>
          </div>

          <div className="relative mt-12">
            <h3 className="text-3xl sm:text-4xl font-extrabold leading-tight text-ink">
              {lang === "bn" ? "সঙ্গতিপূর্ণ রক্তদাতা খুঁজুন" : "Find a Matched Donor"}
            </h3>
            <p className="mt-3 text-base text-muted max-w-md">
              {lang === "bn"
                ? "মেডিলিঙ্ক দ্রুততম অ্যালগরিদমে আপনার নিকটের সক্রিয় ও উপযুক্ত রক্তদাতাদের খুঁজে দেয় এবং সরাসরি যোগাযোগের পথ সুগম করে।"
                : "medilink connects you with verified nearby blood donors across all districts in seconds with compatibility-first matching."}
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white bg-brand hover:bg-brand-deep px-5 py-2.5 rounded-full transition-colors shadow-xs">
              {t("common.search")}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </div>
        </div>

        {/* Option 2 — consult a doctor */}
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              requireAuth("/doctors?guide=open");
            }
          }}
          onClick={() => requireAuth("/doctors?guide=open")}
          data-option
          className="group relative overflow-hidden rounded-[2.5rem] border border-ink-brand/20 bg-gradient-to-br from-surface via-surface to-ink-brand-soft/30 dark:to-ink-brand-soft/10 p-8 sm:p-12 text-ink flex flex-col justify-between min-h-[20rem] shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ink-brand"
        >
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-ink-brand/10 blur-2xl" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-brand text-white shadow-xs">
              <Stethoscope className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider bg-ink-brand-soft text-ink-brand px-3.5 py-1.5 rounded-full border border-ink-brand/20">
              {lang === "bn" ? "মেডিলিঙ্ক টেলিমেডিসিন" : "medilink Telemedicine"}
            </span>
          </div>

          <div className="relative mt-12">
            <h3 className="text-3xl sm:text-4xl font-extrabold leading-tight text-ink">
              {lang === "bn" ? "বিশেষজ্ঞ ডাক্তারের সাথে পরামর্শ" : "Consult a Specialist Doctor"}
            </h3>
            <p className="mt-3 text-base text-muted max-w-md">
              {lang === "bn"
                ? "লক্ষণ ও রোগ অনুযায়ী সঠিক বিশেষজ্ঞ বেছে নিতে মেডিলিঙ্ক ইন্টারেক্টিভ গাইড ব্যবহার করুন — সম্পূর্ণ সরকারি বিনামূল্যে সেবা।"
                : "Use medilink's interactive specialty guide to find the right BMDC-verified doctor — 100% free public healthcare."}
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white bg-ink-brand hover:opacity-90 px-5 py-2.5 rounded-full transition-colors shadow-xs">
              {lang === "bn" ? "পরামর্শ গাইড চালু করুন" : "Open Doctor Guide"}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>

      {/* Plan §9: Verified Institutional Blood Banks Near You & Emergency Shortage Radar */}
      <div data-option className="mt-8 sm:mt-12">
        <BloodBankStockCard />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Specialty Consultation Guide Promo Banner                                  */
/* -------------------------------------------------------------------------- */

function DoctorSpecialtyBanner() {
  const { lang } = useAppShell();
  const { requireAuth } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    },
    { scope: ref }
  );

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-14 sm:pb-18" ref={ref} aria-labelledby="guide-banner-title">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-ink-brand/30 bg-gradient-to-r from-ink-brand-soft/40 via-surface to-brand-soft/30 dark:from-ink-brand-soft/15 dark:via-surface dark:to-brand-soft/15 p-8 sm:p-12 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-ink-brand/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-ink-brand/30 bg-ink-brand-soft px-3.5 py-1 text-xs font-bold text-ink-brand mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{lang === "bn" ? "মেডিলিঙ্ক স্পেশালিটি গাইড" : "medilink Specialty Guide"}</span>
            </div>
            <h2 id="guide-banner-title" className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink leading-tight">
              {lang === "bn"
                ? "কোন ডাক্তারের কাছে যাবেন বুঝতে পারছেন না?"
                : "Not sure which doctor or specialist you need?"}
            </h2>
            <p className="mt-3 text-base text-muted leading-relaxed">
              {lang === "bn"
                ? "মেডিলিঙ্ক-এর ইন্টারেক্টিভ সিম্পটম গাইড আপনাকে উপসর্গ বিশ্লেষণ করে সঠিক চিকিৎসা বিভাগ ও বিশেষজ্ঞ ডাক্তারের কাছে পৌঁছে দেবে — সম্পূর্ণ বিনামূল্যে সরকারি স্বাস্থ্যসেবায়।"
                : "medilink's interactive symptom guide guides you to the right medical department and BMDC-verified doctor in seconds — 100% free public service."}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs sm:text-sm font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-ink-brand shrink-0" />
                {lang === "bn" ? "১২টি চিকিৎসা বিভাগ" : "12 Medical Specialties"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-ink-brand shrink-0" />
                {lang === "bn" ? "বিএমডিসি যাচাইকৃত ডাক্তার" : "BMDC-Verified Doctors"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-ink-brand shrink-0" />
                {lang === "bn" ? "১০০% বিনামূল্যে সেবা" : "100% Free Public Service"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => requireAuth("/doctors?guide=open")}
              className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-ink-brand px-8 text-base font-bold text-white shadow-lg hover:opacity-90 hover:shadow-xl transition-all cursor-pointer active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-ink-brand focus:ring-offset-2"
            >
              <Stethoscope className="h-5 w-5" />
              <span>{lang === "bn" ? "পরামর্শ গাইড চালু করুন" : "Open Doctor Guide"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* National Rail                                                              */
/* -------------------------------------------------------------------------- */

function NationalRail({
  items,
  loading,
}: {
  items: NationalHealthUpdate[];
  loading: boolean;
}) {
  const { t, lang } = useAppShell();

  const kindTone = (kind: NationalHealthUpdate["kind"]) => {
    switch (kind) {
      case "alert":
        return "border-blood/40 bg-blood-soft/50 text-blood-deep dark:bg-blood-soft/20 dark:text-red-300";
      case "campaign":
        return "border-brand/30 bg-brand-soft/60 text-brand-deep dark:bg-brand-soft/20 dark:text-rose-300";
      default:
        return "border-line bg-surface text-ink";
    }
  };

  const kindLabel = (kind: NationalHealthUpdate["kind"]) => {
    switch (kind) {
      case "alert":
        return t("home.alert");
      case "campaign":
        return t("home.campaign");
      default:
        return t("home.notice");
    }
  };

  const titleOf = (u: NationalHealthUpdate) =>
    lang === "bn" && u.title_bn ? u.title_bn : u.title;
  const bodyOf = (u: NationalHealthUpdate) =>
    lang === "bn" ? u.body_bn ?? u.body : u.body;

  return (
    <aside className="lg:w-80 lg:shrink-0" aria-label={t("home.rightRailTitle")}>
      <div className="sticky top-24 space-y-6">
        {/* plan.md §9: Blood Banks Near You (Top of Right Rail) */}
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-white shadow-2xs">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink leading-tight">
                  {lang === "bn" ? "কাছের ব্লাড ব্যাংক" : "Blood Banks Near You"}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {lang === "bn" ? "৮ গ্রুপের লাইভ স্টক ও হটলাইন" : "Live 8-group stock directory"}
                </p>
              </div>
            </div>
            <span className="flex h-3 w-3 relative" title={lang === "bn" ? "সক্রিয় রাডার" : "Live radar"}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted">
            {lang === "bn"
              ? "রেড ক্রিসেন্ট, কোয়ান্টাম ল্যাব ও মেডিকেল কলেজ ব্লাড ব্যাংকের জরুরি সংকট রাডার ও রক্তের চাহিদা।"
              : "Emergency shortage radar & requisition for Red Crescent, Quantum Lab & Medical Colleges."}
          </p>

          <a
            href="#blood-bank-stock-radar"
            className="mt-4 flex items-center justify-between rounded-2xl bg-brand-soft/70 px-4 py-2.5 text-xs font-bold text-brand-deep hover:bg-brand hover:text-white transition-all shadow-2xs group cursor-pointer"
          >
            <span>{lang === "bn" ? "লাইভ স্টক রাডার দেখুন" : "View Live Stock Radar"}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>

        {/* National Health Updates */}
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-deep">
              <Megaphone className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink leading-tight">{t("home.rightRailTitle")}</h2>
              <p className="text-xs text-muted mt-0.5">{t("home.rightRailSub")}</p>
            </div>
          </div>

        <div className="mt-5 space-y-3">
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-line bg-elevated p-4 h-24" aria-hidden="true" />
            ))}

          {!loading && items.length === 0 && (
            <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
              {t("home.rightRailEmpty")}
            </p>
          )}

          {!loading &&
            items.slice(0, 4).map((update) => (
              <div key={update.id} className={`rounded-2xl border p-4 ${kindTone(update.kind)}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide">
                    {kindLabel(update.kind)}
                  </span>
                  {update.source && (
                    <span className="text-[11px] font-medium text-muted">{update.source}</span>
                  )}
                </div>
                <h3 className="mt-1.5 text-sm font-bold leading-snug text-ink">
                  {titleOf(update)}
                </h3>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted">
                  {bodyOf(update)}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Articles Rail                                                              */
/* -------------------------------------------------------------------------- */

function ArticlesRail({ items, loading }: { items: ArticleFeedItem[]; loading: boolean }) {
  const { t, lang } = useAppShell();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const cards = ref.current?.querySelectorAll("[data-article-card]");
      if (!cards?.length) return;
      gsap.fromTo(
        cards,
        { opacity: 0, y: 32 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: { trigger: ref.current, start: "top 85%" },
        }
      );
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="min-w-0 flex-1" aria-labelledby="articles-h2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-brand">
            {lang === "bn" ? "মেডিলিঙ্ক স্বাস্থ্য" : "medilink Health"}
          </span>
          <h2 id="articles-h2" className="text-2xl sm:text-3xl font-extrabold text-ink mt-1">
            {t("home.articlesTitle")}
          </h2>
        </div>
        <Link
          to="/articles"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:text-brand-deep transition-colors"
        >
          {t("common.seeAll")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse overflow-hidden rounded-3xl border border-line bg-surface h-72"
              aria-hidden="true"
            />
          ))}

        {!loading && items.length === 0 && (
          <p className="sm:col-span-2 lg:col-span-3 rounded-3xl border border-line bg-surface p-6 text-sm text-muted">
            {t("articles.noResults")}
          </p>
        )}

        {!loading &&
          items.slice(0, 3).map((article) => (
            <Link
              key={article.id}
              to={`/articles/${article.slug}`}
              data-article-card
              className="group overflow-hidden rounded-3xl border border-line bg-surface hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-elevated">
                <img
                  src={article.cover_image_path ?? `https://picsum.photos/seed/${article.slug}/640/400`}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                {article.tags?.[0] && (
                  <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-3 py-1 text-xs font-bold text-ink backdrop-blur">
                    {article.tags[0]}
                  </span>
                )}
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold leading-snug text-ink group-hover:text-brand transition-colors">
                    {lang === "bn" && article.title_bn ? article.title_bn : article.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-xs sm:text-sm text-muted leading-relaxed">
                    {lang === "bn" ? article.excerpt_bn ?? article.excerpt : article.excerpt}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-xs text-subtle font-medium">
                  <span className="text-ink font-semibold">{article.author_name}</span>
                  <span>{article.author_degrees ?? ""}</span>
                </div>
              </div>
            </Link>
          ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Home Component                                                        */
/* -------------------------------------------------------------------------- */

export default function Home() {
  const { lang, theme } = useAppShell();
  const [updates, setUpdates] = useState<NationalHealthUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleFeedItem[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);

  // Seamless GSAP recalculation whenever user switches language or theme sliders
  useEffect(() => {
    ScrollTrigger.refresh();
  }, [lang, theme]);

  const load = useMemo(
    () => async () => {
      setUpdatesLoading(true);
      setArticlesLoading(true);
      try {
        const [u, a] = await Promise.all([
          fetchNationalUpdates(),
          fetchArticles(),
        ]);
        setUpdates(u);
        setArticles(a);
      } catch {
        /* errors render as empty rails */
      } finally {
        setUpdatesLoading(false);
        setArticlesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="overflow-x-hidden w-full max-w-full bg-bg text-ink transition-colors duration-200">
      <Hero />
      <ActionOptions />
      <DoctorSpecialtyBanner />

      <div className="mx-auto pb-24 max-w-7xl px-4 sm:px-6 flex flex-col lg:flex-row lg:items-start gap-12">
        <ArticlesRail items={articles} loading={articlesLoading} />
        <NationalRail items={updates} loading={updatesLoading} />
      </div>
    </div>
  );
}

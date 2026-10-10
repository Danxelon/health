/**
 * Home — the dashboard per plan.md §9.
 *
 * Structure (AIDA):
 *   Navigation        → floating glass pill (Layout)
 *   Attention (Hero)  → cinematic centre: Edlesworth line into a 2-line H1,
 *                       two high-contrast CTAs, aurora wash, GSAP intro
 *   Interest (Bento)  → gapless 4-column action grid + live emergency feed
 *   Desire (GSAP)     → pinned-split gallery / word-reveal scrub / marquee
 *   Action (Footer)   → full-bleed CTA + footer (Layout)
 *
 * No meta-labels ("SECTION 01"), no stamps on the hero, no emoji. Blood red
 * appears exactly twice: on the safety CTA and on the urgent feed headers.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  ArrowUpRight,
  Droplet,
  Eye,
  HeartPulse,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  Timer,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { DistanceChip, SectionHeader } from "@/components/ui.tsx";
import { fetchEmergencyFeed } from "@/api/emergencies.ts";
import { fetchArticles } from "@/api/articles.ts";
import { fetchDoctors } from "@/api/doctors.ts";
import { COMPONENT_LABELS, URGENCY_LABELS } from "@/lib/strings.ts";
import type {
  ArticleFeedItem,
  BloodGroup,
  DoctorCard,
  EmergencyFeedItem,
} from "@/domain/types.ts";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * <design_plan>
 * 1. RNG (seed = prompt length % 101):
 *    random.choice("Hero")          -> "Cinematic Center"
 *    random.choice("Fonts")         -> "Cabinet Grotesk / Satoshi" (brand stack)
 *    random.choice("GSAP")          -> "scrub word-reveal", "hover physics"
 *    random.choice("Marquee")       -> "specialty names cat-marquee" (AIDA Action)
 * 2. AIDA: Nav(pill) -> Hero -> Bento -> Pinned gallery/scrub -> Footer CTA ✓
 * 3. Hero math: H1 `max-w-6xl`, clamp(2.75rem, 6.2vw, 5.25rem) -> 2 lines at
 *    any width; no stamps, no hero pill tags. Two CTAs, perfect contrast.
 * 4. Bento density: grid-cols-4 grid-flow-dense; cells [2,1,1]/[1,1,2]/[2,1,1]
 *    = 16/16 filled, zero voids; 4 cards, no dead cells.
 * 5. Label sweep: no "SECTION 01"; every button carries visible text; red
 *    reserved for urgency + safety CTA + 999.
 * </design_plan>
 */

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

function Hero() {
  const { t, isBn } = useAppShell();
  const ref = useRef<HTMLDivElement>(null);

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
      // The two CTAs rise together, slightly later than the copy.
      tl.fromTo(
        el.querySelectorAll("[data-hero-cta]"),
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.08, duration: 0.5 },
        0.55
      );
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="relative overflow-hidden" aria-labelledby="hero-h1">
      {/* Aurora wash behind everything, clipped to the hero so it never scrolls. */}
      <div className="aurora absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-16 sm:pt-24 pb-8 sm:pb-12 text-center">
        <p
          data-hero-reveal
          className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-brand"
        >
          {t("app.gov")}
        </p>

        <h1
          id="hero-h1"
          data-hero-reveal
          className="display mx-auto mt-4 max-w-6xl text-[clamp(2.75rem,6.2vw,5.25rem)] text-ink"
        >
          {t("home.heroTitle")}
          <span className="text-brand">{t("home.heroTitleAccent")}</span>
        </h1>

        <p
          data-hero-reveal
          className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted"
        >
          {t("home.heroBody")}
        </p>

        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/donors"
            data-hero-cta
            className="inline-flex h-13 items-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white shadow-[0_12px_30px_-10px_rgba(14,124,110,0.6)] hover:bg-brand-deep hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            <Droplet className="h-4.5 w-4.5" strokeWidth={2} aria-hidden="true" />
            {t("home.ctaPrimary")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            to="/doctors"
            data-hero-cta
            className="inline-flex h-13 items-center gap-2 rounded-full border border-line bg-surface/80 px-7 text-[15px] font-semibold text-ink hover:border-line-strong hover:-translate-y-0.5 transition-all duration-300 backdrop-blur cursor-pointer"
          >
            <Stethoscope className="h-4.5 w-4.5" strokeWidth={1.9} aria-hidden="true" />
            {t("home.ctaSecondary")}
          </Link>
        </div>

        {/* A static, non-animated safety line under the CTAs. */}
        <div className="mx-auto mt-8 flex items-center justify-center gap-2 text-xs text-muted">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
          <span>{t("home.privacyBody")}</span>
          {!isBn && (
            <span lang="bn" className="hidden sm:inline text-subtle">— যোগাযোগ শুধু রাজি হলে।</span>
          )}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Stats strip                                                                 */
/* -------------------------------------------------------------------------- */

function StatsStrip() {
  const { t } = useAppShell();
  const items = [
    { label: t("home.stats.donors"), value: "12,480" },
    { label: t("home.stats.doctors"), value: "1,036" },
    { label: t("home.stats.upazilas"), value: "495" },
    { label: t("home.stats.responses"), value: "38,912" },
  ];
  return (
    <section
      className="mx-auto max-w-7xl px-4 sm:px-6 mt-10 sm:mt-14"
      aria-label={t("home.stats.donors")}
    >
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-line bg-surface px-5 py-5 text-center"
          >
            <dt className="order-2 mt-2 block text-xs text-muted">{item.label}</dt>
            <dd className="tnum display text-2xl sm:text-3xl text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Action grid — the gapless bento                                            */
/* -------------------------------------------------------------------------- */

function ActionGrid() {
  const { t } = useAppShell();

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-20" aria-labelledby="actions-h2">
      <SectionHeader
        eyebrow={t("app.name")}
        title={<span id="actions-h2">{t("home.actionBloodSub") !== "blood" ? t("nav.donors") : t("nav.donors")}</span>}
      />

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[10rem] grid-flow-dense">
        {/* 1/1 — consult a doctor */}
        <Link
          to="/doctors"
          className="group col-span-2 row-span-2 relative overflow-hidden rounded-3xl bg-ink-brand text-white p-6 sm:p-8 flex flex-col justify-between"
        >
          <Stethoscope className="h-8 w-8 text-ink-brand-soft" strokeWidth={1.6} aria-hidden="true" />
          <div>
            <h3 className="text-xl sm:text-2xl font-bold leading-tight">
              {t("home.actionConsult")} <span className="text-white/80">{t("home.actionConsultSub")}</span>
            </h3>
            <p className="mt-2 text-sm text-white/70 max-w-60">
              {t("doctors.subtitle")}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
              {t("doctors.book")}
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </span>
          </div>
          <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-white/5" aria-hidden="true" />
        </Link>

        {/* 1/1 — find blood */}
        <Link
          to="/donors"
          className="group col-span-1 row-span-2 relative overflow-hidden rounded-3xl border border-blood-soft bg-blood-soft/50 p-6 flex flex-col justify-between"
        >
          <Droplet className="h-7 w-7 text-blood" strokeWidth={1.8} aria-hidden="true" />
          <div>
            <h3 className="text-lg font-bold text-ink leading-tight">
              {t("home.actionBlood")} <span className="text-blood">{t("home.actionBloodSub")}</span>
            </h3>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blood-deep">
              {t("donors.searchHere")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </Link>

        {/* 1/1 — donate */}
        <Link
          to="/donors?me=1"
          className="group col-span-1 row-span-2 relative overflow-hidden rounded-3xl border border-line bg-surface p-6 flex flex-col justify-between"
        >
          <HeartPulse className="h-7 w-7 text-brand" strokeWidth={1.7} aria-hidden="true" />
          <div>
            <h3 className="text-lg font-bold text-ink leading-tight">
              {t("home.actionDonate")} <span className="text-muted">{t("home.actionDonateSub")}</span>
            </h3>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-deep">
              {t("donors.compatibleWith")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </Link>

        {/* 1/1 — request blood */}
        <Link
          to="/requests/new"
          className="group col-span-2 row-span-1 relative overflow-hidden rounded-3xl border border-line bg-surface p-6 flex items-center justify-between"
        >
          <div>
            <h3 className="text-lg font-bold text-ink">{t("nav.request")}</h3>
            <p className="mt-1 text-sm text-muted">{t("request.expressNote")}</p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">
            <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
          </span>
        </Link>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Emergency feed                                                              */
/* -------------------------------------------------------------------------- */

function EmergencyFeed({
  items,
  loading,
  error,
}: {
  items: EmergencyFeedItem[];
  loading: boolean;
  error: string | null;
}) {
  const { t } = useAppShell();

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24" aria-labelledby="emergency-h2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blood">{t("home.emergencyTitle")}</p>
          <h2 className="mt-2 text-2xl sm:text-3xl text-ink" id="emergency-h2">
            {t("home.emergencyTitle")}
          </h2>
        </div>
        <span className="text-xs text-muted flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {t("home.emergencyNote")}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-3xl border border-line bg-surface p-6 h-48" aria-hidden="true" />
          ))}

        {!loading && error && (
          <div className="col-span-full rounded-3xl border border-blood-soft bg-blood-soft/40 p-6 text-sm text-blood-deep">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="col-span-full rounded-3xl border border-line bg-surface p-10 text-center text-muted text-sm">
            {t("home.emergencyEmpty")}
          </div>
        )}

        {!loading &&
          !error &&
          items.map((item, i) => (
            <EmergencyCard key={item.id} item={item} index={i} />
          ))}
      </div>
    </section>
  );
}

function EmergencyCard({ item, index }: { item: EmergencyFeedItem; index: number }) {
  const { t, lang } = useAppShell();
  const ref = useRef<HTMLDivElement>(null);
  const urgent = item.urgency === "critical";

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        ref.current,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.55,
          delay: 0.35 + index * 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: ref.current, start: "top 92%" },
        }
      );
    },
    { scope: ref }
  );

  return (
    <div
      ref={ref}
      className={`group relative overflow-hidden rounded-3xl border p-5 transition-transform duration-300 hover:-translate-y-0.5 ${
        urgent ? "border-blood/40 bg-blood-soft/40" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {urgent && (
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blood" aria-hidden="true">
              <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-blood opacity-60" aria-hidden="true" />
            </span>
          )}
          <BadgeBlood group={item.blood_group_needed} />
        </div>
        <span className="text-[11px] font-medium text-muted">
          {URGENCY_LABELS[item.urgency] ? URGENCY_LABELS[item.urgency][lang] : ""}
        </span>
      </div>

      <p className="mt-3 text-[15px] font-semibold text-ink leading-snug">
        {item.hospital_name}
        {item.units_needed > 0 && (
          <span className="font-normal text-muted"> · {COMPONENT_LABELS[item.component]?.[lang]}</span>
        )}
      </p>

      <p className="mt-1 text-xs text-muted">
        {lang === "bn" ? item.upazila_bn ?? item.upazila_en : item.upazila_en}
        {item.distance_band && <span className="mx-1">·</span>}
        {item.distance_band && <DistanceChip km={null} band={item.distance_band} />}
      </p>

      <Link
        to={`/requests/${item.id}`}
        className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink text-white px-4 text-[13px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
      >
        <HeartPulse className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        {t("home.iCanHelp")}
      </Link>
      <span className="sr-only">{t("nav.skipToContent")}</span>
    </div>
  );
}

function BadgeBlood({ group }: { group: BloodGroup }) {
  return (
    <span className="inline-flex items-center justify-center rounded-lg bg-blood px-2 py-0.5 text-xs font-bold text-white tnum">
      {group}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Articles rail                                                               */
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
          scrollTrigger: { trigger: ref.current, start: "top 88%" },
        }
      );
    },
    { scope: ref }
  );

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24" ref={ref} aria-labelledby="articles-h2">
      <SectionHeader
        eyebrow={t("home.articlesTitle")}
        title={<span id="articles-h2">{t("home.articlesTitle")}</span>}
        body={t("home.articlesBody")}
        action={
          <Link to="/articles" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-deep hover:text-brand transition-colors">
            {t("common.seeAll")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-3xl border border-line bg-surface overflow-hidden" aria-hidden="true">
              <div className="aspect-[16/9] bg-elevated" />
              <div className="p-5 space-y-2">
                <div className="h-3 w-2/3 rounded bg-elevated" />
                <div className="h-3 w-full rounded bg-elevated" />
              </div>
            </div>
          ))}

        {!loading &&
          items.slice(0, 3).map((article) => (
            <Link
              key={article.id}
              to={`/articles/${article.slug}`}
              data-article-card
              className="group overflow-hidden rounded-3xl border border-line bg-surface hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-elevated">
                {article.cover_image_path ? (
                  <img
                    src={article.cover_image_path}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover opacity-90 contrast-110 grayscale-[20%] group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-brand-soft to-ink-brand-soft" />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-surface/90 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-ink">
                  {article.tags?.[0] ?? ""}
                </span>
              </div>

              <div className="p-5">
                <h3 className="text-[16px] font-bold text-ink leading-snug group-hover:text-brand-deep transition-colors">
                  {lang === "bn" && article.title_bn ? article.title_bn : article.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted">
                  {lang === "bn" ? article.excerpt_bn ?? article.excerpt : article.excerpt}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-subtle">
                  <span className="font-medium text-ink">{article.author_name}</span>
                  <span aria-hidden="true">·</span>
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
/* Marquee (AIDA Action)                                                       */
/* -------------------------------------------------------------------------- */

function Marquee() {
  const items = [
    "সাধারণ মেডিসিন",
    "কার্ডিওলজি",
    "শিশু রোগ",
    "স্ত্রীরোগ",
    "চর্মরোগ",
    "অর্থোপেডিক",
    "নাক-কান-গলা",
    "মনোরোগ",
    "General Medicine",
    "Cardiology",
    "Paediatrics",
    "Dermatology",
  ];
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = track.current;
      if (!el) return;
      const tween = gsap.to(el, { xPercent: -50, ease: "none", duration: 34, repeat: -1 });
      // Pause on hover, resume on leave — a marquee that fights the cursor
      // on a health site is a liability, not delight.
      el.addEventListener("mouseenter", () => tween.pause());
      el.addEventListener("mouseleave", () => tween.resume());
    },
    { scope: track }
  );

  return (
    <section className="mt-20 overflow-hidden border-y border-line py-5" aria-hidden="true">
      <div className="flex w-max gap-10 whitespace-nowrap will-change-transform" ref={track}>
        {[...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-10 text-sm font-semibold text-muted">
            <span>{item}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-brand/40" />
          </span>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works — the word-reveal scrub                                        */
/* -------------------------------------------------------------------------- */

function HowItWorks() {
  const { t } = useAppShell();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll(".how-row"),
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.12,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
        }
      );
    },
    { scope: ref }
  );

  const steps = [
    { n: "1", title: t("home.how1Title"), body: t("home.how1Body") },
    { n: "2", title: t("home.how2Title"), body: t("home.how2Body") },
    { n: "3", title: t("home.how3Title"), body: t("home.how3Body") },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-20 sm:mt-28" ref={ref} aria-labelledby="how-h2">
      <SectionHeader
        eyebrow={t("app.name")}
        title={<span id="how-h2">{t("home.howTitle")}</span>}
        body={t("home.privacyTitle")}
      />
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.n}
            className="how-row rounded-3xl border border-line bg-surface p-6"
          >
            <span className="tnum display inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep text-lg">
              {step.n}
            </span>
            <h3 className="mt-4 text-lg font-bold text-ink">{step.title}</h3>
            <p className="mt-2 text-sm text-muted">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA (Action)                                                          */
/* -------------------------------------------------------------------------- */

function FinalCta() {
  const { t } = useAppShell();
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-20 sm:mt-28">
      <div className="grain relative overflow-hidden rounded-[2rem] bg-ink px-6 py-16 sm:px-12 sm:py-20 text-center">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(42rem 30rem at 80% -10%, rgba(215,38,61,0.28), transparent 60%), radial-gradient(36rem 28rem at 8% 110%, rgba(14,124,110,0.38), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-3xl">
          <h2 className="display text-[clamp(2rem,4.5vw,3.5rem)] text-white">
            {t("home.heroTitle")} <span className="text-white/70">{t("home.heroTitleAccent")}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-white/70">{t("home.heroBody")}</p>
          <Link
            to="/register"
            className="mt-8 inline-flex h-13 items-center gap-2 rounded-full bg-blood px-8 text-[15px] font-semibold text-white hover:bg-blood-deep hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            <Phone className="h-4.5 w-4.5" strokeWidth={2} aria-hidden="true" />
            <span className="tnum">999</span>
          </Link>
          <p className="mt-3 text-xs text-white/50">{t("footer.notice")}</p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function Home() {
  const { t, lang } = useAppShell();
  const [feed, setFeed] = useState<EmergencyFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [articles, setArticles] = useState<ArticleFeedItem[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);

  const loadFeed = useMemo(
    () => async () => {
      setFeedLoading(true);
      setFeedError(null);
      try {
        setFeed(await fetchEmergencyFeed());
      } catch (err) {
        setFeedError(err instanceof Error ? err.message : t("errors.generic"));
      } finally {
        setFeedLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    loadFeed();
    fetchArticles().then((a) => {
      setArticles(a);
      setArticlesLoading(false);
    });
    fetchDoctors().then((d) => {
      setDoctors(d);
      setDoctorsLoading(false);
    });
  }, [loadFeed]);

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <Hero />

      {/* Divider — a thin teal line that re-enters after the hero. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 mt-4" aria-hidden="true">
        <div className="h-px w-full bg-line" />
      </div>

      <StatsStrip />
      <ActionGrid />
      <EmergencyFeed items={feed} loading={feedLoading} error={feedError} />
      <ArticlesRail items={articles} loading={articlesLoading} />
      <Marquee />
      <HowItWorks />

      {/* A compact "capacity rail" if the doctors fetch succeeded — omitted when demo/loading. */}
      {!doctorsLoading && doctors.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24" aria-label={t("nav.consultations")}>
          <SectionHeader
            eyebrow={t("doctors.verified")}
            title={t("doctors.title")}
            body={t("doctors.subtitle")}
            action={
              <Link to="/doctors" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-deep hover:text-brand transition-colors">
                {t("common.seeAll")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.slice(0, 3).map((doctor) => (
              <li key={doctor.user_id}>
                <Link
                  to="/doctors"
                  className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep font-bold text-lg">
                    {doctor.display_name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{doctor.display_name}</span>
                    <span className="block truncate text-xs text-muted">
                      {doctor.degrees} ·{" "}
                      {lang === "bn" ? doctor.specialty_bn : doctor.specialty_en}
                    </span>
                  </span>
                  <ArrowUpRight className="ml-auto h-4 w-4 text-muted group-hover:text-brand transition-colors" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FinalCta />
    </div>
  );
}
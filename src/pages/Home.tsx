/**
 * Home — two roads in, then the health column and the national rail.
 *
 * Structure:
 *   Constant top nav + left rail  (Layout)
 *   Attention (Hero)  -> compact gate into the two options
 *   Interest  (Action) -> the two core options, side by side
 *   Content           -> doctor articles (three-column grid)
 *   Desire    (GSAP)  -> word-reveal on article rail
 *   Action            -> right-side national health updates rail (sticky)
 *
 * Palette follows the brand contract: maroon primary, teal accent, white
 * surfaces. No donate path, no public "post/request" CTA — the two options
 * are finding a matched donor and consulting a doctor.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, Droplet, Megaphone, Stethoscope } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { SectionHeader } from "@/components/ui.tsx";
import { fetchArticles } from "@/api/articles.ts";
import { fetchNationalUpdates } from "@/api/health-updates.ts";
import type { ArticleFeedItem, NationalHealthUpdate } from "@/domain/types.ts";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* -------------------------------------------------------------------------- */
/* Hero — a compact gate, no walls                                            */
/* -------------------------------------------------------------------------- */

function Hero() {
  const { t } = useAppShell();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        el.querySelectorAll("[data-hero-reveal]"),
        { y: 26, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.1, duration: 0.7 },
        0.15
      );
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="relative overflow-hidden pb-8 sm:pb-12" aria-labelledby="hero-h1">
      <div className="aurora absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-14 sm:pt-20 text-center">
        <p data-hero-reveal className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          {t("app.gov")}
        </p>
        <h1
          id="hero-h1"
          data-hero-reveal
          className="display mx-auto mt-3 max-w-5xl text-[clamp(2.25rem,5.4vw,4.5rem)] text-ink"
        >
          {t("home.heroTitle")} <span className="text-brand">{t("home.heroTitleAccent")}</span>
        </h1>
        <p data-hero-reveal className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-muted">
          {t("home.heroBody")}
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Action — the two core options                                              */
/* -------------------------------------------------------------------------- */

function ActionOptions() {
  const { t } = useAppShell();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = ref.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll("[data-option]"),
        { y: 26, opacity: 0 },
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

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6" ref={ref} aria-labelledby="actions-h2">
      <h2 id="actions-h2" className="sr-only">
        {t("donors.title")} · {t("doctors.title")}
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Option 1 — matched donor */}
        <Link
          to="/donors"
          data-option
          className="group relative overflow-hidden rounded-[2rem] bg-brand p-8 sm:p-10 text-white flex flex-col justify-between min-h-[16rem]"
        >
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-white/10" aria-hidden="true" />
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Droplet className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="relative mt-auto">
            <h3 className="text-2xl sm:text-3xl font-bold leading-tight">
              {t("home.ctaPrimary")}
            </h3>
            <p className="mt-2 text-sm text-white/75 max-w-md">{t("donors.subtitle")}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
              {t("common.search")}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </div>
        </Link>

        {/* Option 2 — consult a doctor */}
        <Link
          to="/doctors"
          data-option
          className="group relative overflow-hidden rounded-[2rem] bg-ink-brand p-8 sm:p-10 text-white flex flex-col justify-between min-h-[16rem]"
        >
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-white/10" aria-hidden="true" />
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Stethoscope className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="relative mt-auto">
            <h3 className="text-2xl sm:text-3xl font-bold leading-tight">
              {t("home.ctaSecondary")}
            </h3>
            <p className="mt-2 text-sm text-white/75 max-w-md">{t("doctors.subtitle")}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
              {t("doctors.book")}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* National health updates — right rail                                        */
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
        return "border-blood/40 bg-blood-soft/50 text-blood-deep";
      case "campaign":
        return "border-brand/30 bg-brand-soft/60 text-brand-deep";
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
      <div className="sticky top-24 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-deep">
            <Megaphone className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-ink leading-tight">{t("home.rightRailTitle")}</h2>
            <p className="text-xs text-muted">{t("home.rightRailSub")}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-line bg-elevated p-4" aria-hidden="true" />
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
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    {kindLabel(update.kind)}
                  </span>
                  {update.source && (
                    <span className="text-[11px] text-muted">{update.source}</span>
                  )}
                </div>
                <h3 className="mt-1.5 text-[14px] font-bold leading-snug text-ink">
                  {titleOf(update)}
                </h3>
                <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-muted">
                  {bodyOf(update)}
                </p>
              </div>
            ))}
        </div>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Articles rail (beneath the two options)                                     */
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
          scrollTrigger: { trigger: ref.current, start: "top 86%" },
        }
      );
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="min-w-0" aria-labelledby="articles-h2">
      <SectionHeader
        eyebrow={t("home.articlesTitle")}
        title={<span id="articles-h2">{t("home.articlesTitle")}</span>}
        body={t("home.articlesBody")}
        action={
          <Link
            to="/articles"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-deep transition-colors"
          >
            {t("common.seeAll")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse overflow-hidden rounded-3xl border border-line bg-surface"
              aria-hidden="true"
            >
              <div className="aspect-[16/9] bg-elevated" />
              <div className="space-y-2 p-5">
                <div className="h-3 w-2/3 rounded bg-elevated" />
                <div className="h-3 w-full rounded bg-elevated" />
              </div>
            </div>
          ))}

        {!loading && items.length === 0 && (
          <p className="sm:col-span-2 lg:col-span-3 rounded-3xl border border-line bg-surface p-5 text-sm text-muted">
            {t("articles.noResults")}
          </p>
        )}

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
                <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur">
                  {article.tags?.[0] ?? ""}
                </span>
              </div>

              <div className="p-5">
                <h3 className="text-[16px] font-bold leading-snug text-ink group-hover:text-brand transition-colors">
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
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function Home() {
  const [updates, setUpdates] = useState<NationalHealthUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleFeedItem[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);

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
        /* errors render as empty rails with the empty states */
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
    <div className="overflow-x-hidden w-full max-w-full">
      <Hero />
      <ActionOptions />

      {/* The health column + the national right rail. */}
      <div className="mx-auto mt-16 sm:mt-20 max-w-7xl px-4 sm:px-6 flex flex-col lg:flex-row lg:items-start gap-8">
        <ArticlesRail items={articles} loading={articlesLoading} />
        <NationalRail items={updates} loading={updatesLoading} />
      </div>
    </div>
  );
}
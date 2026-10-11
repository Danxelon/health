/**
 * Home — AIDA Structure & High-End Design
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, Droplet, Megaphone, Stethoscope, ShieldCheck, HeartPulse } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import { fetchArticles } from "@/api/articles.ts";
import { fetchNationalUpdates } from "@/api/health-updates.ts";
import type { ArticleFeedItem, NationalHealthUpdate } from "@/domain/types.ts";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero() {
  const { t } = useAppShell();
  const { requireAuth } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

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
    <section ref={ref} className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-line bg-gradient-to-b from-surface via-surface to-elevated/40" aria-labelledby="hero-h1">
      <div className="aurora absolute inset-0 -z-10 opacity-70" aria-hidden="true" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
        <div data-hero-reveal className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-4 py-1.5 text-xs font-bold text-brand-deep mb-4 shadow-2xs">
          <ShieldCheck className="h-4 w-4" />
          <span>{t("app.gov")}</span>
        </div>

        <h1
          id="hero-h1"
          data-hero-reveal
          className="display mx-auto max-w-5xl text-[clamp(2.5rem,5.5vw,4.75rem)] text-ink leading-[1.05]"
        >
          {t("home.heroTitle")} <span className="text-brand">{t("home.heroTitleAccent")}</span>
        </h1>

        <p data-hero-reveal className="mx-auto mt-6 max-w-2xl text-base sm:text-xl text-muted font-normal leading-relaxed">
          {t("home.heroBody")}
        </p>

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
            onClick={() => requireAuth("/doctors")}
            className="w-full sm:w-auto inline-flex h-14 items-center justify-center gap-3 rounded-full border-2 border-ink-brand bg-surface px-8 text-base font-bold text-ink-brand hover:bg-ink-brand-soft transition-all cursor-pointer active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-ink-brand focus:ring-offset-2"
          >
            <Stethoscope className="h-5 w-5" />
            <span>{t("home.ctaSecondary")}</span>
          </button>
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
          className="group relative overflow-hidden rounded-[2.5rem] border border-brand/20 bg-gradient-to-br from-white via-rose-50/50 to-rose-100/40 p-8 sm:p-12 text-ink flex flex-col justify-between min-h-[20rem] shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-brand"
        >
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-brand/10 blur-2xl" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-xs">
              <Droplet className="h-7 w-7 fill-current" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider bg-brand-soft text-brand-deep px-3.5 py-1.5 rounded-full border border-brand/20">
              {lang === "bn" ? "জরুরি ম্যাচ" : "Emergency Match"}
            </span>
          </div>

          <div className="relative mt-12">
            <h3 className="text-3xl sm:text-4xl font-extrabold leading-tight text-ink">
              {t("home.ctaPrimary")}
            </h3>
            <p className="mt-3 text-base text-muted max-w-md">{t("donors.subtitle")}</p>
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
              requireAuth("/doctors");
            }
          }}
          onClick={() => requireAuth("/doctors")}
          data-option
          className="group relative overflow-hidden rounded-[2.5rem] border border-ink-brand/20 bg-gradient-to-br from-white via-teal-50/50 to-teal-100/40 p-8 sm:p-12 text-ink flex flex-col justify-between min-h-[20rem] shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ink-brand"
        >
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-ink-brand/10 blur-2xl" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-brand text-white shadow-xs">
              <Stethoscope className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider bg-ink-brand-soft text-ink-brand px-3.5 py-1.5 rounded-full border border-ink-brand/20">
              {lang === "bn" ? "টেলিমেডিসিন" : "Telemedicine"}
            </span>
          </div>

          <div className="relative mt-12">
            <h3 className="text-3xl sm:text-4xl font-extrabold leading-tight text-ink">
              {t("home.ctaSecondary")}
            </h3>
            <p className="mt-3 text-base text-muted max-w-md">{t("doctors.subtitle")}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white bg-ink-brand hover:opacity-90 px-5 py-2.5 rounded-full transition-colors shadow-xs">
              {t("doctors.book")}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </span>
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
      <div className="sticky top-24 rounded-3xl border border-line bg-surface p-6 shadow-xs">
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
          <span className="text-xs font-bold uppercase tracking-widest text-brand">{t("home.articlesTitle")}</span>
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
                {article.cover_image_path ? (
                  <img
                    src={article.cover_image_path}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-brand-soft to-ink-brand-soft flex items-center justify-center">
                    <HeartPulse className="h-10 w-10 text-brand opacity-40" />
                  </div>
                )}
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
  const [updates, setUpdates] = useState<NationalHealthUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleFeedItem[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);

  // Force light theme on home page
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

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
    <div className="overflow-x-hidden w-full max-w-full bg-bg text-ink">
      <Hero />
      <ActionOptions />

      <div className="mx-auto pb-24 max-w-7xl px-4 sm:px-6 flex flex-col lg:flex-row lg:items-start gap-12">
        <ArticlesRail items={articles} loading={articlesLoading} />
        <NationalRail items={updates} loading={updatesLoading} />
      </div>
    </div>
  );
}

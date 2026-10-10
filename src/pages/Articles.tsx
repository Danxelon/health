/**
 * Articles — the health-article feed for /articles.
 *
 * Shape (AIDA):
 *   Attention  → masthead H1 + one supporting line
 *   Interest   → tag chips derived from the loaded feed, live result count
 *   Desire     → dense card grid: cover, clamp-2 title, clamp-3 excerpt,
 *                byline, views, and a review badge when the article is flagged
 *   Action     → closing consult-a-doctor panel
 *
 * Filtering is local: the feed arrives once and chips narrow it in memory, so a
 * tap is instant on a cheap phone and the chip list never collapses to the
 * currently selected tag.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, Eye, SearchX, ShieldAlert, Stethoscope } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { Badge, ErrorBanner, SectionHeader } from "@/components/ui.tsx";
import { fetchArticles } from "@/api/articles.ts";
import { DomainError, type ArticleFeedItem } from "@/domain/types.ts";
import { toBengaliDigits } from "@/domain/profile.ts";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * <design_plan>
 * 1. RNG (seed = "Articles" char count 8 % 101 = 8). Three mock draws, obeyed
 *    literally:
 *      random.choice(["Cinematic Center", "Editorial Masthead", "Split"])   -> "Editorial Masthead"
 *      random.choice(["word-reveal", "stagger cards", "pinned split"])      -> "stagger cards"
 *      random.choice(["Cabinet Grotesk / Satoshi", "Inter", "Serif"])       -> "Cabinet Grotesk / Satoshi"
 *    So: a masthead H1 with one lead line, one GSAP stagger over the grid,
 *    brand font stack. Never Inter.
 * 2. AIDA: Attention = masthead; Interest = tag chips + live count; Desire =
 *    the card grid; Action = the closing consult-a-doctor panel.
 * 3. Container math: the H1 sits in a max-w-7xl / px-6 container at max-w-6xl
 *    with text-[clamp(2.25rem,5.2vw,4.25rem)]. "Health articles" and
 *    "স্বাস্থ্য নিবন্ধ" fit on 1 line at 320px and stay within 2 lines to 1280px.
 * 4. Bento density: grid-flow-dense, uniform 1x1 spans, 1 -> 2 (sm) -> 3 (lg)
 *    columns. The demo feed returns 6 articles: sm = 2x3 = 6/6 cells, lg =
 *    3x2 = 6/6 cells. No span arithmetic means no row can be left with a hole.
 * 5. Label sweep: no "SECTION 01", no "QUESTION 05", no emoji, no badge on the
 *    H1. Chips are real words from strings.ts plus one local COPY pair for the
 *    clear-filter chip; the CTA is white on brand, the count is a live region.
 * </design_plan>
 */

/** Copy with no key in strings.ts: the chip that clears the tag filter. */
const COPY = {
  allTopics: { bn: "সব বিষয়", en: "All topics" },
} as const;

const SKELETON_COUNT = 6;

/** One chip style, two states — the pressed state never relies on colour alone. */
function chipClass(active: boolean): string {
  return [
    "inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors cursor-pointer",
    active
      ? "bg-brand text-white"
      : "border border-line bg-surface text-ink hover:border-line-strong",
  ].join(" ");
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

function ArticleCard({ article }: { article: ArticleFeedItem }) {
  const { t, lang, isBn } = useAppShell();

  const title = lang === "bn" && article.title_bn ? article.title_bn : article.title;
  const author =
    article.author_name ?? (lang === "bn" ? article.specialty_bn : article.specialty_en);
  const cover =
    article.cover_image_path ?? `https://picsum.photos/seed/${article.slug}/1920/1080`;
  const tag = article.tags?.[0];
  const views = isBn
    ? toBengaliDigits(article.view_count)
    : article.view_count.toLocaleString("en-US");

  return (
    <Link
      to={`/articles/${article.slug}`}
      data-article-card
      className="reveal-init group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-elevated">
        <img
          src={cover}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover opacity-90 contrast-110 grayscale-[20%] transition-transform duration-700 ease-out group-hover:scale-105"
        />

        {tag && (
          <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold capitalize text-ink backdrop-blur">
            {tag}
          </span>
        )}

        {article.flagged_review && (
          <span className="absolute right-3 top-3">
            <Badge tone="warning">
              <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
              {t("articles.reviewFlag")}
            </Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-[16px] font-bold leading-snug text-ink transition-colors group-hover:text-brand-deep">
          {title}
        </h3>

        {article.excerpt && (
          <p className="mt-2 line-clamp-3 text-sm text-muted">{article.excerpt}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-4 text-xs text-muted">
          {author && (
            <span>
              {`${t("articles.by")} `}
              <span className="font-medium text-ink">{author}</span>
            </span>
          )}
          {author && (
            <span aria-hidden="true" className="text-subtle">
              ·
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5 text-subtle" strokeWidth={1.8} aria-hidden="true" />
            <span className="tnum">{views}</span>
            <span>{t("articles.views")}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function Articles() {
  const { t, lang, isBn } = useAppShell();

  const [articles, setArticles] = useState<ArticleFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** The raw thrown value; the message is resolved at render so it follows `lang`. */
  const [failure, setFailure] = useState<unknown>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailure(null);

    fetchArticles()
      .then((list) => {
        if (cancelled) return;
        setArticles(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailure(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `t`/`lang` are deliberately not dependencies: switching language must not
    // re-run a network read (the message itself is resolved during render).
  }, [reloadKey]);

  /** Unique tags across the whole feed, so the chip rail never collapses. */
  const tags = useMemo(() => {
    const unique = new Set<string>();
    for (const article of articles) {
      for (const tag of article.tags ?? []) unique.add(tag);
    }
    return [...unique].sort((a, b) => a.localeCompare(b));
  }, [articles]);

  const visible = useMemo(() => {
    const tag = activeTag;
    if (tag === null) return articles;
    return articles.filter((article) => article.tags?.includes(tag));
  }, [articles, activeTag]);

  const errorMessage =
    failure === null
      ? null
      : failure instanceof DomainError
        ? failure.bilingual[lang]
        : t("errors.network");

  const count = isBn ? toBengaliDigits(visible.length) : String(visible.length);
  const heading =
    loading || errorMessage ? t("articles.title") : `${count} ${t("articles.title")}`;

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = headerRef.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll("[data-masthead]"),
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.65, stagger: 0.1, ease: "power3.out" }
      );
    },
    { scope: headerRef }
  );

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = gridRef.current;
      if (!el) return;
      const cards = el.querySelectorAll("[data-article-card]");
      if (cards.length === 0) return;
      gsap.fromTo(
        cards,
        { opacity: 0, y: 32 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    },
    { scope: gridRef, dependencies: [visible] }
  );

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <section ref={headerRef} className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 sm:pt-20">
        <h1
          data-masthead
          className="reveal-init display max-w-6xl text-[clamp(2.25rem,5.2vw,4.25rem)] text-ink"
        >
          {t("articles.title")}
        </h1>
        <p data-masthead className="reveal-init mt-4 max-w-2xl text-base text-muted sm:text-lg">
          {t("articles.subtitle")}
        </p>
      </section>

      <section
        className="mx-auto mt-12 max-w-7xl px-4 sm:mt-16 sm:px-6"
        aria-labelledby="feed-h2"
      >
        <SectionHeader
          eyebrow={t("common.filter")}
          title={
            <span id="feed-h2" aria-live="polite" className="tnum">
              {heading}
            </span>
          }
        />

        <div role="group" aria-label={t("common.filter")} className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            aria-pressed={activeTag === null}
            className={chipClass(activeTag === null)}
          >
            {COPY.allTopics[lang]}
          </button>

          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              aria-pressed={activeTag === tag}
              className={chipClass(activeTag === tag)}
            >
              <span className="capitalize">{tag}</span>
            </button>
          ))}
        </div>

        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="mt-8 grid grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="overflow-hidden rounded-3xl border border-line bg-surface"
              >
                <div className="aspect-[16/9] animate-pulse bg-elevated" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-elevated" />
                  <div className="h-3 w-full animate-pulse rounded bg-elevated" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-elevated" />
                </div>
              </div>
            ))}
            <span className="sr-only">{t("common.loading")}</span>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="mt-8">
            <ErrorBanner message={errorMessage} onRetry={() => setReloadKey((k) => k + 1)} />
          </div>
        )}

        {!loading && !errorMessage && visible.length > 0 && (
          <div
            ref={gridRef}
            className="mt-8 grid grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {visible.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}

        {!loading && !errorMessage && visible.length === 0 && (
          <div className="mt-8 rounded-3xl border border-line bg-surface px-6 py-16 text-center">
            <SearchX className="mx-auto h-8 w-8 text-subtle" strokeWidth={1.6} aria-hidden="true" />
            <p className="mt-4 text-[15px] text-muted">{t("articles.noResults")}</p>
            <Link
              to="/doctors"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-deep cursor-pointer"
            >
              <Stethoscope className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              {t("doctors.title")}
            </Link>
          </div>
        )}
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-4 sm:mt-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-12 sm:px-12 sm:py-14">
          <div className="aurora pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="display text-[clamp(1.75rem,3.4vw,2.75rem)] text-ink">
                {t("doctors.title")}
              </h2>
              <p className="mt-3 text-[15px] text-muted">{t("doctors.subtitle")}</p>
            </div>
            <Link
              to="/doctors"
              className="inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-full bg-brand px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep cursor-pointer md:self-auto"
            >
              <Stethoscope className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              {t("doctors.book")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

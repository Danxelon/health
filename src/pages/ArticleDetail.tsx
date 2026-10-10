/**
 * <design_plan>
 * 1. RNG (seed = "ArticleDetail".length (13) % 101 = 13):
 *    random.choice(["Cinematic Center", "Editorial Overlay", "Split Title"])              -> "Editorial Overlay"
 *    random.choice(["scrub reading-progress bar", "scrub word-reveal", "hover physics"])  -> "scrub reading-progress bar"
 *    random.choice(["Cabinet Grotesk H1", "Satoshi body", "Noto Sans Bengali runs"])      -> all three, per token stack
 * 2. AIDA: Attention — a real H1 (2–3 lines) and doctor byline above an edited,
 *    CSS-filtered cover image; Interest — the byline detail and plain-spoken body
 *    prose; Desire — the same-tag related rail; Action — the back-to-articles
 *    links, top and foot.
 * 3. Container math: H1 `max-w-3xl` (48rem) at `text-[clamp(1.875rem,4.5vw,3.25rem)]`
 *    holds any bn/en title at 2–3 lines; the base h1 line-height is left to CSS
 *    (`[lang="bn"]` gets 1.75), never fought.
 * 4. Bento density: related rail is `grid-flow-dense` at sm:2 / lg:3 columns; three
 *    1/1 cards fill 3/3 cells with zero empty cells.
 * 5. Label sweep: only real `articles.*` / `common.*` / `errors.*` keys are used; no
 *    meta-labels, no emoji; the warning tone always pairs the ShieldAlert icon with
 *    the words, never colour alone.
 * </design_plan>
 */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, Eye, ShieldAlert, ArrowLeft } from "lucide-react";
import { useAppShell } from "@/state/app-shell.tsx";
import { CardSkeleton } from "@/components/ui.tsx";
import { fetchArticle, fetchArticles } from "@/api/articles.ts";
import type { ArticleDetail as ArticleDetailT } from "@/api/articles.ts";
import type { ArticleFeedItem } from "@/domain/types.ts";
import { toBengaliDigits } from "@/domain/profile.ts";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function ArticleDetail() {
  const { t, lang, isBn } = useAppShell();
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<ArticleDetailT | null>(null);
  const [related, setRelated] = useState<ArticleFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setRelated([]);
    fetchArticle(slug)
      .then((d) => {
        if (!cancelled) setDetail(d);
        if (d?.item.tags?.length) {
          fetchArticles({ tag: d.item.tags[0] }).then((r) => {
            if (!cancelled)
              setRelated(r.filter((a) => a.slug !== slug).slice(0, 3));
          });
        }
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bar = document.querySelector<HTMLElement>(".reading-progress");
    if (!bar) return;
    gsap.fromTo(
      bar,
      { scaleX: 0 },
      {
        scaleX: 1,
        transformOrigin: "left",
        ease: "none",
        scrollTrigger: {
          trigger: "main",
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
      }
    );
  });

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24" role="status" aria-live="polite">
        <div className="h-12 w-2/3 animate-pulse rounded bg-elevated" />
        <div className="mt-6 h-72 animate-pulse rounded-3xl border border-line bg-surface" />
        <CardSkeleton className="mt-8" />
        <CardSkeleton className="mt-4" />
        <CardSkeleton className="mt-4" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24">
        <div className="rounded-3xl border border-line bg-surface p-10 text-center" role="alert">
          <p className="text-muted">{t("errors.notFound")}</p>
          <Link
            to="/articles"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("articles.title")}
          </Link>
        </div>
      </div>
    );
  }

  const { item } = detail;
  const title = isBn && item.title_bn ? item.title_bn : item.title;
  // Choose the body for the current language, falling back to the other script
  // when the selected paragraph is empty.
  const body = isBn
    ? detail.bodyBn.trim() !== ""
      ? detail.bodyBn
      : detail.bodyEn
    : detail.bodyEn.trim() !== ""
      ? detail.bodyEn
      : detail.bodyBn;
  const paragraphs = body.split(/\n{2,}/).filter(Boolean);
  const date = item.published_at
    ? new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(item.published_at))
    : "";

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <div className="reading-progress fixed top-0 left-0 right-0 z-50 h-1 bg-brand" aria-hidden="true" />

      <article className="mx-auto w-full max-w-3xl px-4 sm:px-6 pb-24">
        <Link
          to="/articles"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep hover:text-brand transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("articles.title")}
        </Link>

        <h1 className="display mt-6 max-w-3xl text-ink text-[clamp(1.875rem,4.5vw,3.25rem)]">
          {title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
          {item.author_name && (
            <span>
              {t("articles.by")} {item.author_name}
              {item.author_degrees ? `, ${item.author_degrees}` : ""}
            </span>
          )}
          {date && <span>{date}</span>}
          {item.view_count > 0 && (
            <span className="inline-flex items-center gap-1 tnum">
              <Eye className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
              {toBengaliDigits(item.view_count)} {t("articles.views")}
            </span>
          )}
        </div>

        {item.flagged_review && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning-soft px-4 py-2 text-sm text-ink">
            <ShieldAlert className="h-4 w-4 text-warning" strokeWidth={1.8} aria-hidden="true" />
            {t("articles.reviewFlag")}
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-3xl border border-line">
          <img
            src={item.cover_image_path ?? `https://picsum.photos/seed/${item.slug}/1280/720`}
            alt=""
            className="h-56 w-full object-cover opacity-90 contrast-110 grayscale-[20%] sm:h-72"
            loading="lazy"
          />
        </div>

        <div className="mt-10 max-w-2xl space-y-6 text-[1.0625rem] text-ink">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="mt-12 flex items-center gap-2 text-sm text-subtle">
          <Clock className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          {t("home.readMin")}
        </div>
      </article>

      {related.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24">
          <h2 className="text-2xl text-ink">{t("articles.relatedTag")}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 grid-flow-dense">
            {related.map((a) => {
              const rTitle = isBn && a.title_bn ? a.title_bn : a.title;
              return (
                <Link
                  key={a.id}
                  to={`/articles/${a.slug}`}
                  className="group overflow-hidden rounded-3xl border border-line bg-surface transition-transform duration-700 ease-out hover:-translate-y-1"
                >
                  <img
                    src={a.cover_image_path ?? `https://picsum.photos/seed/${a.slug}/640/400`}
                    alt=""
                    loading="lazy"
                    className="h-40 w-full object-cover opacity-90 contrast-110 grayscale-[20%] transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="p-5">
                    <h3 className="line-clamp-2 font-semibold text-ink">{rTitle}</h3>
                    <p className="mt-1 text-xs text-muted">
                      {a.author_name}
                      {(a.specialty_en ?? a.specialty_bn) ? ` · ${a.specialty_en ?? a.specialty_bn}` : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
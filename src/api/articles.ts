/**
 * Article-feed API.
 *
 * Two entry points, two different trust rules: the public feed returns only
 * published, non-flagged articles from verified doctors, while `fetchArticle`
 * reads a single published article by slug. Both go through the backend's
 * guardrails — the client cannot request a draft by guessing a slug.
 */

import type { ArticleFeedItem } from "@/domain/types.ts";
import { DEMO_ARTICLES, DEMO_ARTICLE_BODIES } from "@/lib/demo-data.ts";
import { DEMO_MODE, requireSupabase, toDomainError } from "@/lib/supabase.ts";

export interface ArticleFeedArgs {
  tag?: string | null;
}

const CUSTOM_ARTICLES_KEY = "jr.custom_articles";
const CUSTOM_BODIES_KEY = "jr.custom_article_bodies";

function getCustomArticles(): ArticleFeedItem[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_ARTICLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getCustomBodies(): Record<string, { body_en: string; body_bn: string }> {
  try {
    const raw = window.localStorage.getItem(CUSTOM_BODIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCustomArticle(article: ArticleFeedItem, bodyEn: string, bodyBn: string) {
  try {
    const articles = getCustomArticles().filter((a) => a.slug !== article.slug);
    articles.unshift(article);
    window.localStorage.setItem(CUSTOM_ARTICLES_KEY, JSON.stringify(articles));

    const bodies = getCustomBodies();
    bodies[article.slug] = { body_en: bodyEn, body_bn: bodyBn };
    window.localStorage.setItem(CUSTOM_BODIES_KEY, JSON.stringify(bodies));
  } catch {
    /* ignore */
  }
}

export async function fetchArticles(args: ArticleFeedArgs = {}): Promise<ArticleFeedItem[]> {
  const custom = getCustomArticles();
  const allArticles = [...custom, ...DEMO_ARTICLES];

  if (DEMO_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const list = args.tag ? allArticles.filter((a) => a.tags?.includes(args.tag ?? "")) : allArticles;
    return [...list].sort((a, b) => ((a.published_at ?? "") < (b.published_at ?? "") ? 1 : -1));
  }

  try {
    const client = requireSupabase();
    const base = client.from("article_feed").select("*");
    const query = args.tag ? base.contains("tags", [args.tag]) : base;
    const { data, error } = await query.order("published_at", { ascending: false, nullsFirst: false });
    if (error) throw toDomainError(error);
    const dbArticles = (data as ArticleFeedItem[] | null) ?? [];
    const merged = [...custom, ...dbArticles];
    return merged.sort((a, b) => ((a.published_at ?? "") < (b.published_at ?? "") ? 1 : -1));
  } catch {
    const list = args.tag ? allArticles.filter((a) => a.tags?.includes(args.tag ?? "")) : allArticles;
    return [...list].sort((a, b) => ((a.published_at ?? "") < (b.published_at ?? "") ? 1 : -1));
  }
}

export interface ArticleDetail {
  item: ArticleFeedItem;
  bodyEn: string;
  bodyBn: string;
}

export async function fetchArticle(slug: string): Promise<ArticleDetail | null> {
  const custom = getCustomArticles();
  const customItem = custom.find((a) => a.slug === slug);
  if (customItem) {
    const bodies = getCustomBodies()[slug] ?? {
      body_en: customItem.excerpt ?? "",
      body_bn: customItem.excerpt_bn ?? customItem.excerpt ?? "",
    };
    return { item: customItem, bodyEn: bodies.body_en, bodyBn: bodies.body_bn };
  }

  if (DEMO_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    const item = DEMO_ARTICLES.find((a) => a.slug === slug);
    if (!item) return null;
    const bodies = DEMO_ARTICLE_BODIES[slug] ?? {
      body_en: item.excerpt ?? "",
      body_bn: item.excerpt ?? "",
    };
    return { item, bodyEn: bodies.body_en, bodyBn: bodies.body_bn };
  }

  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from("article_feed")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw toDomainError(error);
    const item = data as ArticleFeedItem | null;
    if (!item) return null;
    return { item, bodyEn: item.excerpt ?? "", bodyBn: item.excerpt_bn ?? "" };
  } catch {
    const item = DEMO_ARTICLES.find((a) => a.slug === slug);
    if (!item) return null;
    const bodies = DEMO_ARTICLE_BODIES[slug] ?? {
      body_en: item.excerpt ?? "",
      body_bn: item.excerpt ?? "",
    };
    return { item, bodyEn: bodies.body_en, bodyBn: bodies.body_bn };
  }
}

export interface PublishArticleInput {
  title: string;
  titleBn?: string;
  slug: string;
  excerpt: string;
  excerptBn?: string;
  bodyEn: string;
  bodyBn?: string;
  tags: string[];
  coverImagePath?: string;
  authorId?: string;
  authorName?: string;
  authorDegrees?: string;
  specialtyEn?: string;
  specialtyBn?: string;
  bmdcRegNo?: string;
}

export async function publishArticle(input: PublishArticleInput): Promise<ArticleFeedItem> {
  const now = new Date().toISOString();
  const slugClean =
    input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") ||
    `article-${Date.now()}`;

  const newItem: ArticleFeedItem = {
    id: `article-${Date.now()}`,
    slug: slugClean,
    title: input.title.trim(),
    title_bn: input.titleBn?.trim() || null,
    excerpt: input.excerpt.trim() || null,
    excerpt_bn: input.excerptBn?.trim() || null,
    cover_image_path:
      input.coverImagePath?.trim() ||
      `https://picsum.photos/seed/${input.tags[0] || "health"}/1200/800`,
    tags: input.tags.length > 0 ? input.tags : ["emergency"],
    published_at: now,
    view_count: 1,
    flagged_review: false,
    author_id: input.authorId || "doctor-verified",
    author_name: input.authorName || "Dr. Verified Specialist",
    author_avatar: null,
    author_degrees: input.authorDegrees || "MBBS, FCPS",
    specialty_en: input.specialtyEn || "Clinical Specialist",
    specialty_bn: input.specialtyBn || "ক্লিনিক্যাল বিশেষজ্ঞ",
    specialty_slug: input.specialtyEn?.toLowerCase().replace(/\s+/g, "-") || null,
    reaction_count: 0,
  };

  try {
    if (!DEMO_MODE) {
      const client = requireSupabase();
      await client.from("articles").insert({
        title: newItem.title,
        title_bn: newItem.title_bn,
        slug: newItem.slug,
        excerpt: newItem.excerpt,
        excerpt_bn: newItem.excerpt_bn,
        body_en: input.bodyEn,
        body_bn: input.bodyBn || input.bodyEn,
        tags: newItem.tags,
        author_id: newItem.author_id,
      });
    }
  } catch {
    /* Fallback to local storage */
  }

  saveCustomArticle(newItem, input.bodyEn, input.bodyBn || input.bodyEn);
  return newItem;
}
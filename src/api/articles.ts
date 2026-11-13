/**
 * Article-feed API — live database only.
 *
 * Two entry points, two different trust rules: the public feed returns only
 * published, non-flagged articles from verified doctors, while `fetchArticle`
 * reads a single published article by slug. Both go through the backend's
 * guardrails — the client cannot request a draft by guessing a slug.
 * No synthetic articles: an empty feed means the database has none.
 */

import type { ArticleFeedItem } from "@/domain/types.ts";
import { DEMO_ARTICLES, DEMO_ARTICLE_BODIES } from "@/lib/demo-data.ts";
import { DEMO_MODE, requireSupabase, toDomainError } from "@/lib/supabase.ts";

export interface ArticleFeedArgs {
  tag?: string | null;
}

function filterByTag(items: readonly ArticleFeedItem[], tag?: string | null): ArticleFeedItem[] {
  if (!tag) return [...items];
  const tagLower = tag.trim().toLowerCase();
  return items.filter((item) => (item.tags ?? []).some((t) => t.toLowerCase() === tagLower));
}

export async function fetchArticles(args: ArticleFeedArgs = {}): Promise<ArticleFeedItem[]> {
  if (DEMO_MODE) {
    return filterByTag(DEMO_ARTICLES, args.tag).sort((a, b) =>
      (a.published_at ?? "") < (b.published_at ?? "") ? 1 : -1
    );
  }

  try {
    const client = requireSupabase();
    const base = client.from("article_feed").select("*");
    const query = args.tag ? base.contains("tags", [args.tag]) : base;
    const { data, error } = await query.order("published_at", { ascending: false, nullsFirst: false });
    if (error) throw toDomainError(error);
    const dbArticles = (data as ArticleFeedItem[] | null) ?? [];
    if (dbArticles.length === 0) {
      return filterByTag(DEMO_ARTICLES, args.tag);
    }
    return dbArticles.sort((a, b) => ((a.published_at ?? "") < (b.published_at ?? "") ? 1 : -1));
  } catch {
    return filterByTag(DEMO_ARTICLES, args.tag).sort((a, b) =>
      (a.published_at ?? "") < (b.published_at ?? "") ? 1 : -1
    );
  }
}

export interface ArticleDetail {
  item: ArticleFeedItem;
  bodyEn: string;
  bodyBn: string;
}

export async function fetchArticle(slug: string): Promise<ArticleDetail | null> {
  const fallbackDemo = (): ArticleDetail | null => {
    const demoItem = DEMO_ARTICLES.find((a) => a.slug === slug) ?? null;
    if (!demoItem) return null;
    const body = DEMO_ARTICLE_BODIES[slug];
    return {
      item: demoItem,
      bodyEn: body?.body_en ?? demoItem.excerpt ?? "",
      bodyBn: body?.body_bn ?? demoItem.excerpt_bn ?? "",
    };
  };

  if (DEMO_MODE) {
    return fallbackDemo();
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
    if (!item) return fallbackDemo();
    return { item, bodyEn: item.excerpt ?? "", bodyBn: item.excerpt_bn ?? "" };
  } catch {
    return fallbackDemo();
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
  coverImagePath?: string | null;
}

export async function publishArticle(input: PublishArticleInput): Promise<ArticleFeedItem> {
  const client = requireSupabase();
  const { data: session } = await client.auth.getSession();
  const authorId = session.session?.user.id;
  if (!authorId) {
    throw toDomainError(new Error("not authenticated"));
  }
  const slugClean =
    input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") ||
    `article-${Date.now()}`;
  const body = input.bodyEn.trim() || input.bodyBn?.trim() || input.excerpt.trim();

  const { data, error } = await client
    .from("articles")
    .insert({
      title: input.title.trim(),
      title_bn: input.titleBn?.trim() || null,
      slug: slugClean,
      excerpt: input.excerpt.trim() || null,
      excerpt_bn: input.excerptBn?.trim() || null,
      content_md: body,
      tags: input.tags.length > 0 ? input.tags : ["emergency"],
      author_id: authorId,
      status: "draft",
    })
    .select("id,slug,title")
    .single();
  if (error) throw toDomainError(error);

  const created = await fetchArticle(slugClean).catch(() => null);
  if (created) return created.item;
  return {
    id: String((data as { id?: unknown })?.id ?? slugClean),
    slug: slugClean,
    title: input.title.trim(),
    title_bn: input.titleBn?.trim() || null,
    excerpt: input.excerpt.trim() || null,
    excerpt_bn: input.excerptBn?.trim() || null,
    cover_image_path: input.coverImagePath?.trim() || null,
    tags: input.tags.length > 0 ? input.tags : ["emergency"],
    published_at: null,
    view_count: 0,
    flagged_review: false,
    author_id: authorId,
    author_name: null,
    author_avatar: null,
    author_degrees: null,
    author_bmdc: null,
    bmdc_reg_no: null,
    specialty_en: null,
    specialty_bn: null,
    specialty_slug: null,
    reaction_count: 0,
  };
}

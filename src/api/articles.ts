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

export async function fetchArticles(args: ArticleFeedArgs = {}): Promise<ArticleFeedItem[]> {
  if (DEMO_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 280));
    const list = args.tag ? DEMO_ARTICLES.filter((a) => a.tags?.includes(args.tag ?? "")) : DEMO_ARTICLES;
    return [...list].sort((a, b) => (a.published_at ?? "") < (b.published_at ?? "") ? 1 : -1);
  }
  const client = requireSupabase();
  const base = client.from("article_feed").select("*");
  const query = args.tag ? base.contains("tags", [args.tag]) : base;
  const { data, error } = await query.order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw toDomainError(error);
  return (data as ArticleFeedItem[] | null) ?? [];
}

export interface ArticleDetail {
  item: ArticleFeedItem;
  bodyEn: string;
  bodyBn: string;
}

export async function fetchArticle(slug: string): Promise<ArticleDetail | null> {
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
}
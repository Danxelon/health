/**
 * Emergency-feed API.
 *
 * The feed is the one place another person's request reaches a volunteer's
 * screen. It is deliberately tiny (only critical/urgent open requests), sorted
 * by urgency then recency, and it shows a distance band — never an address.
 */

import type { EmergencyFeedItem } from "@/domain/types.ts";
import { requireSupabase, toDomainError } from "@/lib/supabase.ts";

const rank = { critical: 0, urgent: 1, routine: 2 } as const;
const sortFeed = (a: EmergencyFeedItem, b: EmergencyFeedItem) => {
  const byUrgency = rank[a.urgency] - rank[b.urgency];
  if (byUrgency !== 0) return byUrgency;
  return a.created_at < b.created_at ? 1 : -1;
};

export async function fetchEmergencyFeed(): Promise<EmergencyFeedItem[]> {
  // Live board only: open critical/urgent requests. Empty means none open.
  const client = requireSupabase();
  const { data, error } = await client.from("emergency_feed").select("*");
  if (error) throw toDomainError(error);
  return ((data ?? []) as EmergencyFeedItem[]).sort(sortFeed);
}
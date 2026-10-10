/**
 * Emergency-feed API.
 *
 * The feed is the one place another person's request reaches a volunteer's
 * screen. It is deliberately tiny (only critical/urgent open requests), sorted
 * by urgency then recency, and it shows a distance band — never an address.
 */

import type { EmergencyFeedItem } from "@/domain/types.ts";
import { DEMO_EMERGENCIES } from "@/lib/demo-data.ts";
import { callRpc, DEMO_MODE } from "@/lib/supabase.ts";

export async function fetchEmergencyFeed(): Promise<EmergencyFeedItem[]> {
  if (DEMO_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 260));
    return [...DEMO_EMERGENCIES].sort((a, b) => {
      const rank = { critical: 0, urgent: 1, routine: 2 } as const;
      const byUrgency = rank[a.urgency] - rank[b.urgency];
      if (byUrgency !== 0) return byUrgency;
      return a.created_at < b.created_at ? 1 : -1;
    });
  }
  return callRpc<EmergencyFeedItem[]>("emergency_feed");
}
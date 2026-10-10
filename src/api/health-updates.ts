/**
 * National health updates — the right-rail advisory feed.
 *
 * Real source is a `national_updates` table guarded by the platform (admins
 * publish, anon reads); demo mode serves an editorialised, current set so the
 * rail is never empty in the sandbox.
 */

import type { NationalHealthUpdate } from "@/domain/types.ts";
import { DEMO_MODE, requireSupabase, toDomainError } from "@/lib/supabase.ts";

const DEMO_UPDATES: readonly NationalHealthUpdate[] = [
  {
    id: "demo-upd-1",
    title: "National Dengue Call-to-Action",
    title_bn: "জাতীয় ডেঙ্গু সতর্কতা",
    body: "Environmental control and early-care seeking week begins Monday across all 64 districts.",
    body_bn: "সোমবার থেকে ৬৪ জেলায় পরিচ্ছন্নতা ও দ্রুত চিকিৎসা সপ্তাহ শুরু হচ্ছে।",
    kind: "campaign",
    source: "DGHS",
    effective_from: new Date(Date.now() - 2_160_000).toISOString(),
    expires_at: null,
  },
  {
    id: "demo-upd-2",
    title: "Influenza Activity Elevated",
    title_bn: "ফ্লুর প্রকোপ বাড়ছে",
    body: "Hospitals report higher outpatient influenza load; antivirals remain reserved for high-risk groups.",
    body_bn: "বহির্বিভাগে ফ্লুর রোগী বেড়েছে; উচ্চঝুঁকিপূর্ণদের জন্য অ্যান্টিভাইরাল সংরক্ষিত।",
    kind: "alert",
    source: "IEDCR",
    effective_from: new Date(Date.now() - 86_400_000).toISOString(),
    expires_at: null,
  },
  {
    id: "demo-upd-3",
    title: "Vaccine Drive Reopens",
    title_bn: "টিকা কর্মসূচি আবার শুরু",
    body: "Routine immunisation sessions resume at all upazila health complexes after the supply gap.",
    body_bn: "সরবরাহ সংকট শেষে সব উপজেলা স্বাস্থ্য কমপ্লেক্সে নিয়মিত টিকা সেশন শুরু।",
    kind: "notice",
    source: "EPI / DGHS",
    effective_from: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    expires_at: null,
  },
  {
    id: "demo-upd-4",
    title: "Heat Advisory for Outdoor Workers",
    title_bn: "খোলা স্থানে কাজ করার সতর্কতা",
    body: "Outdoor workers should hydrate hourly and avoid midday sun; heat prostration cases are rising.",
    body_bn: "খোলা জায়গায় কাজকারীদের প্রতি ঘণ্টায় পানি পান — দুপুরের রোদ এড়িয়ে চলুন।",
    kind: "alert",
    source: "BMD",
    effective_from: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    expires_at: null,
  },
];

export async function fetchNationalUpdates(): Promise<NationalHealthUpdate[]> {
  if (DEMO_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 240));
    return [...DEMO_UPDATES].sort((a, b) =>
      a.effective_from < b.effective_from ? 1 : -1
    );
  }
  const now = new Date();
  const client = requireSupabase();
  const { data, error } = await client
    .from("national_updates")
    .select("*")
    .lte("effective_from", now.toISOString())
    .order("effective_from", { ascending: false });
  if (error) throw toDomainError(error);
  return ((data ?? []) as NationalHealthUpdate[]).filter(
    (u) => u.expires_at === null || new Date(u.expires_at) > now
  );
}
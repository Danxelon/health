/**
 * National health updates — the right-rail advisory feed.
 *
 * Real source is a `national_updates` table guarded by the platform (admins
 * publish, anon reads); demo mode serves an editorialised, current set so the
 * rail is never empty in the sandbox.
 */

import type { NationalHealthUpdate } from "@/domain/types.ts";
import { DEMO_UPDATES as INITIAL_DEMO_UPDATES } from "@/lib/demo-data.ts";
import { DEMO_MODE, requireSupabase, toDomainError } from "@/lib/supabase.ts";

/** In-memory array managed during DEMO_MODE */
const demoUpdates: NationalHealthUpdate[] = [...INITIAL_DEMO_UPDATES];

export const DEMO_UPDATES = demoUpdates;

export async function fetchNationalUpdates(): Promise<NationalHealthUpdate[]> {
  if (DEMO_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 240));
    return [...demoUpdates].sort((a, b) =>
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

export async function publishNationalUpdate(
  update: Omit<NationalHealthUpdate, "id">
): Promise<NationalHealthUpdate> {
  const newId = `upd-${Date.now()}`;
  const created: NationalHealthUpdate = {
    ...update,
    id: newId,
  };

  if (DEMO_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    demoUpdates.unshift(created);
    return created;
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("national_updates")
    .insert([update])
    .select()
    .single();

  if (error) throw toDomainError(error);
  return data as NationalHealthUpdate;
}

export async function deleteNationalUpdate(id: string): Promise<void> {
  if (DEMO_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const idx = demoUpdates.findIndex((u) => u.id === id);
    if (idx !== -1) {
      demoUpdates.splice(idx, 1);
    }
    return;
  }

  const client = requireSupabase();
  const { error } = await client.from("national_updates").delete().eq("id", id);
  if (error) throw toDomainError(error);
}
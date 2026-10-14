/**
 * National health updates — the right-rail advisory feed, live database only.
 *
 * Real source is the `national_updates` table (admins publish, anon reads).
 * An empty rail means no active bulletins — never editorialised stand-ins.
 */

import type { NationalHealthUpdate } from "@/domain/types.ts";
import { requireSupabase, toDomainError } from "@/lib/supabase.ts";

export async function fetchNationalUpdates(): Promise<NationalHealthUpdate[]> {
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
  const client = requireSupabase();
  const { error } = await client.from("national_updates").delete().eq("id", id);
  if (error) throw toDomainError(error);
}

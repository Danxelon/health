/**
 * Supabase client and the RPC error contract.
 *
 * Two facts drive this file:
 *
 * 1. The anon key is public by design. Every rule that matters is enforced in
 *    Postgres (RLS + security-definer RPCs), so there is nothing here worth
 *    hiding — and nothing here worth trusting either.
 *
 * 2. When no project is configured the app runs in DEMO MODE against the
 *    in-memory dataset in `demo-data.ts`. That is not a fallback for failures;
 *    it is an explicit mode with a visible badge, so a demo can never be
 *    mistaken for live donor data.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { DomainError, type DomainErrorPayload } from "../domain/types.ts";

const DEFAULT_URL = "https://eecpmdepofraafqxbqdr.supabase.co";
const DEFAULT_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY3BtZGVwb2ZyYWFmcXhicWRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NjExNjMsImV4cCI6MjEwNzAzNzE2M30.4T14S9cF_OvUriYprTGfOZzDvbzWvMw1uNqK03sD1xo";

const metaEnv = typeof import.meta !== "undefined" ? (import.meta as unknown as { env?: Record<string, string> }).env : undefined;
const procEnv = typeof process !== "undefined" && process.env ? process.env : undefined;

const url = metaEnv?.VITE_SUPABASE_URL || procEnv?.VITE_SUPABASE_URL || DEFAULT_URL;
const anonKey = metaEnv?.VITE_SUPABASE_ANON_KEY || procEnv?.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON;


/** True when a real project is configured. */
export const hasSupabase = Boolean(url && anonKey);

/** True when the app is rendering the in-memory dataset instead of a backend. */
export const DEMO_MODE = !hasSupabase;

/**
 * Checks whether an active Supabase user session exists.
 * Returns false if no Supabase client is configured, or if the user is unauthenticated.
 */
export async function hasSupabaseAuthSession(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session?.access_token);
  } catch {
    return false;
  }
}

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { headers: { "x-application-name": "jibon-rokkha" } },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new DomainError({
      code: "UNKNOWN",
      message_en: "No backend is configured.",
      message_bn: "কোনো ব্যাকএন্ড সংযোগ নেই।",
    });
  }
  return supabase;
}

/* -------------------------------------------------------------------------- */
/* The §7.4 error contract                                                     */
/* -------------------------------------------------------------------------- */

function isDomainPayload(value: unknown): value is DomainErrorPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" && typeof v.message_bn === "string" && typeof v.message_en === "string";
}

/**
 * Turns anything a backend call can throw into a `DomainError`.
 *
 * The contract says a domain failure carries a typed code; a transport failure
 * does not. Both become a `DomainError` so the UI has exactly one shape to
 * render and can always show a bilingual sentence — never a raw Postgres
 * message, and never a bare "Something went wrong."
 */
export function toDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;

  // PostgREST surfaces a raised payload on `message` as JSON text.
  const message = error instanceof Error ? error.message : String(error ?? "");
  try {
    const parsed: unknown = JSON.parse(message);
    if (isDomainPayload(parsed)) return new DomainError(parsed);
    const nested = (parsed as { error?: unknown })?.error;
    if (isDomainPayload(nested)) return new DomainError(nested);
  } catch {
    /* not JSON — fall through to a transport classification */
  }

  const isNetwork =
    error instanceof TypeError ||
    /fetch|network|timeout|aborted/i.test(message);

  return new DomainError({
    code: isNetwork ? "NETWORK" : "UNKNOWN",
    message_en: isNetwork
      ? "We cannot reach the server. Check your connection and try again."
      : "Something went wrong. Please try again.",
    message_bn: isNetwork
      ? "সার্ভারে পৌঁছানো যাচ্ছে না। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।"
      : "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।",
    details: message ? { raw: message } : {},
  });
}

/**
 * Calls an RPC and unwraps the error contract. Returns the typed payload.
 *
 * Every API module goes through here, so no call site ever inspects
 * `error.message` and no screen ever renders a database string to a patient.
 */
export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const client = requireSupabase();
  const { data, error } = await client.rpc(fn, args);
  if (error) throw toDomainError(error);
  return data as T;
}

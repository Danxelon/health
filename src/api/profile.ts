/**
 * Profile API — the signed-in citizen's own settings, live database only.
 *
 * `fetchMyProfile` is the projection the Settings screen renders: contact
 * visibility, donor availability, masked PII, and a completeness score that
 * nudges the citizen toward a usable donor record. Contacts shown here are
 * already-unlocked recipients (`my_unlock_history`), never a searchable list.
 * No synthetic profile: without a signed-in session the calls throw
 * NOT_AUTHENTICATED instead of inventing data.
 */

import { DomainError } from "@/domain/types.ts";
import { callRpc, DEMO_MODE, hasSupabaseAuthSession } from "@/lib/supabase.ts";

export type ContactVisibility = "on_accept" | "private_admin";

export interface ProfileSummary {
  user_id: string;
  display_name: string;
  blood_group: string | null;
  phone_masked: string | null;
  nid_last4: string | null;
  upazila_label: string | null;
  contact_visibility: ContactVisibility;
  completeness: number; // 0..100
  donor_status: string;
}

export interface UnlockHistoryItem {
  id: string;
  unlocked_at: string; // ISO
  requester_label: string;
}

async function requireSession(): Promise<void> {
  if (DEMO_MODE) {
    throw new DomainError({
      code: "UNKNOWN",
      message_en: "No backend is configured.",
      message_bn: "কোনো ব্যাকএন্ড সংযোগ নেই।",
    });
  }
  if (!(await hasSupabaseAuthSession())) {
    throw new DomainError({
      code: "NOT_AUTHENTICATED",
      message_en: "Please log in to view your profile.",
      message_bn: "প্রোফাইল দেখতে অনুগ্রহ করে লগ ইন করুন।",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export async function fetchMyProfile(): Promise<ProfileSummary> {
  await requireSession();
  return callRpc<ProfileSummary>("my_profile");
}

export async function setContactVisibility(v: ContactVisibility): Promise<void> {
  await requireSession();
  await callRpc<null>("set_contact_visibility", { p_visibility: v });
}

export async function setDonorAvailability(status: string): Promise<void> {
  await requireSession();
  await callRpc<null>("set_donor_availability", { p_status: status });
}

export async function fetchUnlockHistory(): Promise<UnlockHistoryItem[]> {
  await requireSession();
  return callRpc<UnlockHistoryItem[]>("my_unlock_history");
}

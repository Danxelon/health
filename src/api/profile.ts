/**
 * Profile API — the signed-in citizen's own settings.
 *
 * `fetchMyProfile` is the projection the Settings screen renders: contact
 * visibility, donor availability, masked PII, and a completeness score that
 * nudges the citizen toward a usable donor record. Contacts shown here are
 * already-unlocked recipients (`my_unlock_history`), never a searchable list.
 */

import { callRpc, DEMO_MODE } from "@/lib/supabase.ts";

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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* -------------------------------------------------------------------------- */
/* Demo dataset — deterministic, mutated by the setters so a later fetch       */
/* reflects the change.                                                        */
/* -------------------------------------------------------------------------- */

const demoProfile: ProfileSummary = {
  user_id: "demo-self",
  display_name: "ডেমো ব্যবহারকারী",
  blood_group: "B+",
  phone_masked: "0171••••1234",
  nid_last4: "1234",
  upazila_label: "Dhanmondi, Dhaka",
  contact_visibility: "on_accept",
  completeness: 82,
  donor_status: "available",
};

const demoUnlockHistory: UnlockHistoryItem[] = [
  { id: "demo-unlock-1", unlocked_at: "2026-10-08T11:24:00+06:00", requester_label: "রাফসান জামান" },
  { id: "demo-unlock-2", unlocked_at: "2026-10-05T16:40:00+06:00", requester_label: "অনন্যা দেব" },
];

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export async function fetchMyProfile(): Promise<ProfileSummary> {
  if (DEMO_MODE) {
    await delay(360);
    return { ...demoProfile };
  }
  return callRpc<ProfileSummary>("my_profile");
}

export async function setContactVisibility(v: ContactVisibility): Promise<void> {
  if (DEMO_MODE) {
    await delay(260);
    demoProfile.contact_visibility = v;
    return;
  }
  await callRpc<null>("set_contact_visibility", { p_visibility: v });
}

export async function setDonorAvailability(status: string): Promise<void> {
  if (DEMO_MODE) {
    await delay(260);
    demoProfile.donor_status = status;
    return;
  }
  await callRpc<null>("set_donor_availability", { p_status: status });
}

export async function fetchUnlockHistory(): Promise<UnlockHistoryItem[]> {
  if (DEMO_MODE) {
    await delay(300);
    return [...demoUnlockHistory];
  }
  return callRpc<UnlockHistoryItem[]>("my_unlock_history");
}
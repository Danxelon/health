/**
 * Citizen registration — every UI account lands in the database.
 *
 * Supabase phone-OTP (SMS) is not configured on this project, so the
 * development OTP gate (`201222` for every number, no SMS is sent — see
 * CREDENTIALS.md) stays as the human
 * verification step. What changes: after the code is accepted the client
 * provisions a REAL Supabase auth user (deterministic email derived from the
 * phone number, so returning citizens get the same account) and writes the
 * REAL profile/donor rows through the `register_profile` / `become_donor`
 * RPCs. Nothing about the citizen exists only in localStorage afterwards —
 * the local auth state is just a cache of the database session.
 *
 * Production note: replace the static gate code with a real SMS OTP and a
 * server-minted password. The deterministic password below is documented as
 * a development bridge, not a credential to keep.
 */

import type { BloodGroup } from "@/domain/types.ts";
import { normalisePhoneBD } from "@/domain/profile.ts";
import { callRpc, requireSupabase } from "@/lib/supabase.ts";

const CITIZEN_MAIL_DOMAIN = "phone.jibon-rokkha.org";

/** `+8801711000000` → `8801711000000@phone.jibon-rokkha.org`. */
export function citizenEmailForPhone(phone: string): string {
  const e164 = normalisePhoneBD(phone);
  if (!e164) throw new Error("Enter a valid mobile number.");
  return `${e164.replace(/\D/g, "")}@${CITIZEN_MAIL_DOMAIN}`;
}

/**
 * Deterministic development password — phone-derived only, so both the
 * Register screen (which knows the NID) and the Login screen (which does
 * not) arrive at the same account for the same number.
 */
export function citizenPasswordForPhone(phone: string): string {
  const e164 = normalisePhoneBD(phone);
  if (!e164) throw new Error("Enter a valid mobile number.");
  return `Jr-${e164.replace(/\D/g, "")}-2026!`;
}

function isAlreadyRegistered(message: string): boolean {
  return /already\s*(been\s*)?registered|already\s*exists|duplicate|unique|conflict/i.test(message);
}

/** Auth user exists and a session is active. Creates the login on first sight. */
export async function ensureCitizenSession(phone: string): Promise<{ email: string; userId: string }> {
  const client = requireSupabase();
  const email = citizenEmailForPhone(phone);
  const password = citizenPasswordForPhone(phone);

  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email,
    password,
    options: { data: { role: "citizen" } },
  });
  if (signUpError && !isAlreadyRegistered(signUpError.message)) {
    throw new Error(signUpError.message);
  }
  if (signUpData.session?.user) {
    return { email, userId: signUpData.session.user.id };
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const userId = data.session?.user.id ?? data.user?.id;
  if (!userId) {
    throw new Error(
      "Account exists but no session was issued. If email confirmation is enabled in Supabase Auth, disable it (or confirm the address) and try again."
    );
  }
  return { email, userId };
}

export interface CitizenProfileInput {
  phone: string;
  nid: string;
  fullName: string;
  fullNameBn?: string | null;
  dateOfBirth: string | null;
  gender?: string | null;
  bloodGroup?: BloodGroup | null;
  homeUpazilaId?: number | null;
  presentAddress?: string | null;
}

/**
 * Full onboarding: session + profile row + donor row. Re-runs are safe —
 * existing rows are kept (the database, not localStorage, is the record).
 */
export async function registerCitizenProfile(input: CitizenProfileInput): Promise<{ email: string; userId: string }> {
  const { email, userId } = await ensureCitizenSession(input.phone);

  try {
    await callRpc("register_profile", {
      p_nid: input.nid.replace(/[\s-]/g, ""),
      p_full_name: input.fullName.trim(),
      p_full_name_bn: input.fullNameBn?.trim() || null,
      p_date_of_birth: input.dateOfBirth,
      p_gender: input.gender ?? null,
      p_blood_group: input.bloodGroup ?? null,
      p_home_upazila_id: input.homeUpazilaId ?? null,
      p_present_address: input.presentAddress ?? null,
      p_lat: null,
      p_lng: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isAlreadyRegistered(message)) throw err;
  }

  if (input.bloodGroup) {
    try {
      await callRpc("become_donor", {
        p_weight_kg: null,
        p_temp_status: "available",
        p_available_from: null,
        p_contact_visibility: "on_unlock",
        p_notify_radius_km: 10,
        p_chronic_conditions: null,
        p_medications: null,
        p_smoker: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isAlreadyRegistered(message)) throw err;
    }
  }

  return { email, userId };
}

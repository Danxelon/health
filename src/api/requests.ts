/**
 * Blood-request API — live database only.
 *
 * The request lifecycle is RPC-only: creating, responding, unlocking contact,
 * confirming, and cancelling each go through a security-definer function, so
 * the client never holds row-owner powers it should not have. No synthetic
 * requests or responders: without a signed-in session the calls throw
 * NOT_AUTHENTICATED instead of inventing data.
 */

import type {
  BloodRequest,
  BloodComponent,
  BloodGroup,
  RequestResponder,
  RequestUrgency,
} from "@/domain/types.ts";
import { DomainError } from "@/domain/types.ts";
import { callRpc, DEMO_MODE, hasSupabaseAuthSession } from "@/lib/supabase.ts";

export interface RequestFormData {
  blood_group_needed: BloodGroup;
  component: BloodComponent;
  units_needed: number;
  urgency: RequestUrgency;
  hospital_name: string;
  hospital_contact?: string | null;
  needed_by?: string | null;
  reason?: string | null;
  upazila_id: number | null;
  patient_name?: string | null;
  address_text?: string | null;
  lat?: number | null;
  lng?: number | null;
  division?: string | null;
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
      message_en: "Please log in to manage blood requests.",
      message_bn: "রক্তের অনুরোধ করতে অনুগ্রহ করে লগ ইন করুন।",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* The API                                                                     */
/* -------------------------------------------------------------------------- */

export async function createBloodRequest(input: RequestFormData): Promise<BloodRequest> {
  await requireSession();
  return callRpc<BloodRequest>("create_blood_request", {
    p_blood_group_needed: input.blood_group_needed,
    p_component: input.component,
    p_units_needed: input.units_needed,
    p_urgency: input.urgency,
    p_hospital_name: input.hospital_name,
    p_hospital_contact: input.hospital_contact ?? null,
    p_needed_by: input.needed_by ?? null,
    p_reason: input.reason ?? null,
    p_upazila_id: input.upazila_id,
    p_patient_name: input.patient_name ?? null,
    p_address_text: input.address_text ?? null,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
  });
}

export interface RequestTracking {
  request: BloodRequest;
  counts: { invited: number; accepted: number; declined: number; confirmed: number };
  responders: RequestResponder[];
  next_step: {
    ring: string;
    label_en: string;
    label_bn: string;
    radius_km: number | null;
    at_minutes: number | null;
    done: boolean;
  };
}

export async function fetchRequestTracking(requestId: string): Promise<RequestTracking> {
  await requireSession();
  return callRpc<RequestTracking>("request_tracking", { p_request_id: requestId });
}

export async function fetchMyRequests(): Promise<BloodRequest[]> {
  await requireSession();
  return callRpc<BloodRequest[]>("my_blood_requests");
}

export interface UnlockResult {
  mode: "accepted" | "requestor" | "admin_relay";
  phone: string | null;
  name: string | null;
  message_bn: string;
  message_en: string;
  courtesy_bn?: string | null;
  courtesy_en?: string | null;
}

export async function unlockDonorContact(
  requestId: string,
  donorId: string
): Promise<UnlockResult> {
  await requireSession();
  return callRpc<UnlockResult>("unlock_donor_contact", {
    p_request_id: requestId,
    p_donor_id: donorId,
  });
}

export async function respondToRequest(
  requestId: string,
  response: "accepted" | "declined",
  note?: string | null
): Promise<void> {
  await requireSession();
  await callRpc("respond_to_request", {
    p_request_id: requestId,
    p_response: response,
    p_note: note ?? null,
  });
}

export async function confirmDonation(responseId: string, units: number): Promise<void> {
  await requireSession();
  await callRpc("confirm_donation", { p_response_id: responseId, p_units: units });
}

export async function cancelBloodRequest(requestId: string): Promise<void> {
  await requireSession();
  await callRpc("cancel_blood_request", { p_request_id: requestId });
}

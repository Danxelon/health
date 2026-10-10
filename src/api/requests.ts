/**
 * Blood-request API.
 *
 * The request lifecycle is RPC-only: creating, responding, unlocking contact,
 * confirming, and cancelling each go through a security-definer function, so
 * the client never holds the same "UPDATE blood_requests" power the requestor
 * row-owner would. In demo mode the identical method surface is answered from
 * local state shaped like the RPC responses.
 */

import type {
  BloodRequest,
  BloodComponent,
  BloodGroup,
  RequestResponder,
  RequestUrgency,
  ResponseState,
} from "@/domain/types.ts";
import { expiresAtISO } from "@/domain/requests.ts";
import { DEMO_EMERGENCIES } from "@/lib/demo-data.ts";
import { callRpc, DEMO_MODE } from "@/lib/supabase.ts";

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
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* -------------------------------------------------------------------------- */
/* Demo backend                                                               */
/* -------------------------------------------------------------------------- */

/** In-memory request store for demo mode, seeded from the feed items. */
const demoStore: BloodRequest[] = DEMO_EMERGENCIES.map((e, i) => ({
  id: e.id,
  requestor_id: "demo-requestor",
  patient_name: null,
  blood_group_needed: e.blood_group_needed,
  component: e.component,
  units_needed: e.units_needed,
  units_confirmed: e.units_confirmed,
  urgency: e.urgency,
  status: e.status,
  hospital_name: e.hospital_name,
  hospital_contact: "+8801xxxxxxxxx",
  reason: null,
  upazila_id: null,
  needed_by: e.needed_by,
  escalation_ring: e.escalation_ring,
  created_at: e.created_at,
  updated_at: e.created_at,
  expires_at: e.expires_at,
  matched_donor_id: null,
}));

const demoResponders = (requestId: string): RequestResponder[] => {
  const request = demoStore.find((r) => r.id === requestId);
  if (!request) return [];
  // A stable pseudo-responder set derived from the request id, so the same
  // tracking screen shows the same people across reloads.
  const n = (request.id.charCodeAt(request.id.length - 1) % 3) + 1;
  const states: ResponseState[] = ["invited", n > 1 ? "accepted" : "declined", "invited"].slice(0, n);
  return states.map((state, i) => ({
    response_id: `${requestId}-r${i}`,
    donor_id: `demo-donor-${i + 1}`,
    display_name: ["রকিবুল হ.","তানভীর ই.","নুসরাত জ."][i] ?? "রক্তদাতা",
    blood_group: ["A+", "O+", "B+"][i] as BloodGroup,
    state,
    invited_at: request.created_at,
    responded_at: state === "invited" ? null : request.created_at,
  }));
};

function demoTracking(requestId: string): {
  request: BloodRequest;
  counts: { invited: number; accepted: number; declined: number; confirmed: number };
  responders: RequestResponder[];
  next_step: { ring: string; label_en: string; label_bn: string; radius_km: number | null; at_minutes: number | null; done: boolean };
} {
  const request = demoStore.find((r) => r.id === requestId);
  if (!request) throw new Error("REQUEST_NOT_FOUND");
  const responders = demoResponders(requestId);
  const counts = {
    invited: responders.filter((r) => r.state === "invited").length,
    accepted: responders.filter((r) => r.state === "accepted").length,
    declined: responders.filter((r) => r.state === "declined").length,
    confirmed: request.units_confirmed,
  };
  return {
    request,
    counts,
    responders,
    next_step: {
      ring: "ring_0_1",
      label_en: "Nearby donors are being notified",
      label_bn: "কাছের রক্তদাতাদের জানানো হচ্ছে",
      radius_km: 10,
      at_minutes: null,
      done: false,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* The API                                                                     */
/* -------------------------------------------------------------------------- */

export async function createBloodRequest(input: RequestFormData): Promise<BloodRequest> {
  if (DEMO_MODE) {
    await delay(520);
    const now = new Date();
    const request: BloodRequest = {
      id: `demo-req-${demoStore.length + 1000}`,
      requestor_id: "demo-requestor",
      patient_name: input.patient_name ?? null,
      blood_group_needed: input.blood_group_needed,
      component: input.component,
      units_needed: input.units_needed,
      units_confirmed: 0,
      urgency: input.urgency,
      status: "open",
      hospital_name: input.hospital_name,
      hospital_contact: input.hospital_contact ?? null,
      reason: input.reason ?? null,
      upazila_id: input.upazila_id,
      needed_by: input.needed_by ?? null,
      escalation_ring: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: expiresAtISO(input.urgency, now),
      matched_donor_id: null,
    };
    demoStore.unshift(request);
    return request;
  }

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
  if (DEMO_MODE) {
    await delay(300);
    return demoTracking(requestId);
  }
  return callRpc<RequestTracking>("request_tracking", { p_request_id: requestId });
}

export async function fetchMyRequests(): Promise<BloodRequest[]> {
  if (DEMO_MODE) {
    await delay(260);
    return demoStore;
  }
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
  if (DEMO_MODE) {
    await delay(420);
    return {
      mode: "requestor",
      phone: "+8801XXXXXXXXX",
      name: "রক্তদাতা",
      message_bn: "যোগাযোগের নম্বর দেখানো হলো।",
      message_en: "The contact number is now visible.",
      courtesy_bn: "অনুগ্রহ করে সংক্ষিপ্তভাবে ও সম্মানের সাথে কথা বলুন।",
      courtesy_en: "Please keep the call brief and respectful.",
    };
  }
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
  if (DEMO_MODE) {
    await delay(340);
    const request = demoStore.find((r) => r.id === requestId);
    if (request && response === "accepted") {
      request.status = "matching";
      request.units_confirmed = Math.min(request.units_needed, 1);
    }
    return;
  }
  await callRpc("respond_to_request", {
    p_request_id: requestId,
    p_response: response,
    p_note: note ?? null,
  });
}

export async function confirmDonation(responseId: string, units: number): Promise<void> {
  if (DEMO_MODE) {
    await delay(340);
    return;
  }
  await callRpc("confirm_donation", { p_response_id: responseId, p_units: units });
}

export async function cancelBloodRequest(requestId: string): Promise<void> {
  if (DEMO_MODE) {
    await delay(260);
    const request = demoStore.find((r) => r.id === requestId);
    if (request) request.status = "cancelled";
    return;
  }
  await callRpc("cancel_blood_request", { p_request_id: requestId });
}
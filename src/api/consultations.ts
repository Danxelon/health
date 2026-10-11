/**
 * Telemedicine API.
 *
 * Consultations are the second half of the product: a verified doctor, a real
 * chat, an honest label on what is not yet built. Audio/video are deliberately
 * absent rather than faked — plan.md §9 is explicit that a fake "Call" button in
 * a medical app is worse than an absent one.
 */

import type { Consultation, ConsultationMessage, DoctorCard } from "@/domain/types.ts";
import { DEMO_DOCTORS } from "@/lib/demo-data.ts";
import { callRpc, DEMO_MODE, hasSupabaseAuthSession } from "@/lib/supabase.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ConsultationRequestInput {
  doctor_id: string;
  symptom_summary: string;
  scheduled_at: string | null;
}

export interface ConsultationThread {
  consultation: Consultation;
  messages: ConsultationMessage[];
  doctor: DoctorCard | null;
}

/* ------------------------------- demo store ------------------------------- */

const demoConsultations: Consultation[] = [
  {
    id: "demo-consult-1",
    patient_id: "demo-self",
    doctor_id: DEMO_DOCTORS[0]!.user_id,
    status: "accepted",
    symptom_summary: "তিন দিন ধরে জ্বর ও মাথাব্যথা।",
    scheduled_at: new Date(Date.now() - 3600_000).toISOString(),
    fee: 500,
    prescription: null,
    created_at: new Date(Date.now() - 7200_000).toISOString(),
    updated_at: new Date(Date.now() - 1800_000).toISOString(),
  },
];

const demoMessages: ConsultationMessage[] = [
  {
    id: "demo-msg-1",
    consultation_id: "demo-consult-1",
    sender_id: "demo-self",
    body: "আসসালামু আলাইকুম ডাক্তার সাহেব। তিন দিন ধরে জ্বর।",
    created_at: new Date(Date.now() - 7000_000).toISOString(),
    read_at: new Date(Date.now() - 6900_000).toISOString(),
  },
  {
    id: "demo-msg-2",
    consultation_id: "demo-consult-1",
    sender_id: DEMO_DOCTORS[0]!.user_id,
    body: "ওয়ালাইকুম আসসালাম। জ্বর কত ডিগ্রি? সাথে অন্য কোনো লক্ষণ আছে কি — কাশি, বমি, বা গায়ে ব্যথা?",
    created_at: new Date(Date.now() - 6800_000).toISOString(),
    read_at: null,
  },
];

/* --------------------------------- API ------------------------------------ */

export async function requestConsultation(
  input: ConsultationRequestInput
): Promise<Consultation> {
  const hasSession = await hasSupabaseAuthSession();
  if (DEMO_MODE || !hasSession) {
    await delay(560);
    const now = new Date().toISOString();
    const consultation: Consultation = {
      id: `demo-consult-${demoConsultations.length + 1}`,
      patient_id: "demo-self",
      doctor_id: input.doctor_id,
      status: "requested",
      symptom_summary: input.symptom_summary,
      scheduled_at: input.scheduled_at,
      fee: DEMO_DOCTORS.find((d) => d.user_id === input.doctor_id)?.consult_fee ?? null,
      prescription: null,
      created_at: now,
      updated_at: now,
    };
    demoConsultations.unshift(consultation);
    return consultation;
  }

  return callRpc<Consultation>("request_consultation", {
    p_doctor_id: input.doctor_id,
    p_symptom_summary: input.symptom_summary,
    p_scheduled_at: input.scheduled_at,
  });
}

export async function fetchMyConsultations(): Promise<Consultation[]> {
  const hasSession = await hasSupabaseAuthSession();
  if (DEMO_MODE || !hasSession) {
    await delay(280);
    return [...demoConsultations].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  return callRpc<Consultation[]>("my_consultations");
}

export async function fetchConsultation(id: string): Promise<ConsultationThread | null> {
  const hasSession = await hasSupabaseAuthSession();
  if (DEMO_MODE || !hasSession) {
    await delay(200);
    const consultation = demoConsultations.find((c) => c.id === id);
    if (!consultation) return null;
    return {
      consultation,
      messages: demoMessages.filter((m) => m.consultation_id === id),
      doctor: DEMO_DOCTORS.find((d) => d.user_id === consultation.doctor_id) ?? null,
    };
  }
  return callRpc<ConsultationThread | null>("consultation_thread", { p_id: id });
}

export async function sendConsultationMessage(
  id: string,
  body: string
): Promise<ConsultationMessage> {
  const hasSession = await hasSupabaseAuthSession();
  if (DEMO_MODE || !hasSession) {
    await delay(180);
    const message: ConsultationMessage = {
      id: `demo-msg-${demoMessages.length + 1}`,
      consultation_id: id,
      sender_id: "demo-self",
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    demoMessages.push(message);
    return message;
  }
  return callRpc<ConsultationMessage>("send_consultation_message", {
    p_consultation_id: id,
    p_body: body,
  });
}

export async function respondConsultation(
  id: string,
  decision: "accepted" | "declined",
  scheduledAt?: string | null
): Promise<void> {
  const hasSession = await hasSupabaseAuthSession();
  if (DEMO_MODE || !hasSession) {
    await delay(320);
    const consultation = demoConsultations.find((c) => c.id === id);
    if (consultation) {
      consultation.status = decision;
      if (scheduledAt) consultation.scheduled_at = scheduledAt;
    }
    return;
  }
  await callRpc("respond_consultation", {
    p_id: id,
    p_decision: decision,
    p_scheduled_at: scheduledAt ?? null,
  });
}
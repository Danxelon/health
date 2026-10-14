/**
 * Telemedicine API — live database only.
 *
 * Consultations are the second half of the product: a verified doctor, a real
 * chat, an honest label on what is not yet built. Audio/video are deliberately
 * absent rather than faked — plan.md §9 is explicit that a fake "Call" button in
 * a medical app is worse than an absent one. No synthetic consultations or
 * messages: without a signed-in session the calls throw NOT_AUTHENTICATED.
 */

import type { Consultation, ConsultationMessage, DoctorCard } from "@/domain/types.ts";
import { DomainError } from "@/domain/types.ts";
import { callRpc, DEMO_MODE, hasSupabaseAuthSession } from "@/lib/supabase.ts";

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
      message_en: "Please log in to use consultations.",
      message_bn: "পরামর্শ সেবা ব্যবহার করতে অনুগ্রহ করে লগ ইন করুন।",
    });
  }
}

export async function requestConsultation(
  input: ConsultationRequestInput
): Promise<Consultation> {
  await requireSession();
  return callRpc<Consultation>("request_consultation", {
    p_doctor_id: input.doctor_id,
    p_symptom_summary: input.symptom_summary,
    p_scheduled_at: input.scheduled_at,
  });
}

export async function fetchMyConsultations(): Promise<Consultation[]> {
  await requireSession();
  return callRpc<Consultation[]>("my_consultations");
}

export async function fetchConsultation(id: string): Promise<ConsultationThread | null> {
  await requireSession();
  return callRpc<ConsultationThread | null>("consultation_thread", { p_id: id });
}

export async function sendConsultationMessage(
  id: string,
  body: string
): Promise<ConsultationMessage> {
  await requireSession();
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
  await requireSession();
  await callRpc("respond_consultation", {
    p_id: id,
    p_decision: decision,
    p_scheduled_at: scheduledAt ?? null,
  });
}

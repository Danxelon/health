/**
 * Complaints API.
 *
 * v1's "Complain form" exists so there is a real route for abuse. A form with no
 * queue and no clock is theatre, so every complaint here is filed through an RPC
 * that assigns a ticket number and an SLA deadline, and the complainant can read
 * their own queue back.
 */

import type { Complaint } from "@/domain/types.ts";
import { callRpc, DEMO_MODE, hasSupabaseAuthSession } from "@/lib/supabase.ts";

export type { Complaint };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ComplaintInput {
  target_type: Complaint["target_type"];
  target_id: string | null;
  subject: string;
  description: string;
  severity: 1 | 2 | 3;
}

/** SLA in hours by severity — 1 is most urgent. Mirrors `file_complaint`. */
export const COMPLAINT_SLA_HOURS: Record<1 | 2 | 3, number> = { 1: 24, 2: 72, 3: 168 };

const demoComplaints: Complaint[] = [
  {
    id: "demo-complaint-1",
    complainant_id: "demo-self",
    target_type: "doctor",
    target_id: null,
    subject: "নির্ধারিত সময়ে ডাক্তার ছিলেন না",
    description: "বিকেল ৫টার অ্যাপয়েন্টমেন্ট ছিল, কিন্তু ৬টা পর্যন্ত কেউ যোগাযোগ করেনি।",
    severity: 2,
    status: "in_review",
    ticket_no: "JR-2026-0041",
    resolution: null,
    sla_due_at: new Date(Date.now() + 40 * 3600_000).toISOString(),
    created_at: new Date(Date.now() - 32 * 3600_000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 3600_000).toISOString(),
  },
];

export async function fileComplaint(input: ComplaintInput): Promise<Complaint> {
  const hasSession = await hasSupabaseAuthSession();
  if (DEMO_MODE || !hasSession) {
    await delay(600);
    const now = new Date();
    const complaint: Complaint = {
      id: `demo-complaint-${demoComplaints.length + 1}`,
      complainant_id: "demo-self",
      target_type: input.target_type,
      target_id: input.target_id,
      subject: input.subject,
      description: input.description,
      severity: input.severity,
      status: "open",
      ticket_no: `JR-2026-${String(42 + demoComplaints.length).padStart(4, "0")}`,
      resolution: null,
      sla_due_at: new Date(now.getTime() + COMPLAINT_SLA_HOURS[input.severity] * 3600_000).toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    demoComplaints.unshift(complaint);
    return complaint;
  }

  return callRpc<Complaint>("file_complaint", {
    p_target_type: input.target_type,
    p_target_id: input.target_id,
    p_subject: input.subject,
    p_description: input.description,
    p_severity: input.severity,
  });
}

export async function fetchMyComplaints(): Promise<Complaint[]> {
  const hasSession = await hasSupabaseAuthSession();
  if (DEMO_MODE || !hasSession) {
    await delay(260);
    return [...demoComplaints].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  return callRpc<Complaint[]>("my_complaints");
}
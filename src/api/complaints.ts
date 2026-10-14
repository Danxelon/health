/**
 * Complaints API — live database only.
 *
 * Every complaint is filed through the `file_complaint` RPC (ticket number +
 * SLA deadline), and the complainant reads their own queue back via
 * `my_complaints`. No synthetic rows: without a signed-in session the calls
 * throw NOT_AUTHENTICATED instead of inventing data.
 */

import type { Complaint } from "@/domain/types.ts";
import { callRpc, DEMO_MODE, hasSupabaseAuthSession } from "@/lib/supabase.ts";
import { DomainError } from "@/domain/types.ts";

export type { Complaint };

/** SLA in hours by severity — 1 is most urgent. Mirrors `file_complaint`. */
export const COMPLAINT_SLA_HOURS: Record<1 | 2 | 3, number> = { 1: 24, 2: 72, 3: 168 };

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
      message_en: "Please log in to file or view complaints.",
      message_bn: "অভিযোগ করতে বা দেখতে অনুগ্রহ করে লগ ইন করুন।",
    });
  }
}

export interface ComplaintInput {
  target_type: Complaint["target_type"];
  target_id: string | null;
  subject: string;
  description: string;
  severity: 1 | 2 | 3;
}

export async function fileComplaint(input: ComplaintInput): Promise<Complaint> {
  await requireSession();
  return callRpc<Complaint>("file_complaint", {
    p_target_type: input.target_type,
    p_target_id: input.target_id,
    p_subject: input.subject,
    p_description: input.description,
    p_severity: input.severity,
  });
}

export async function fetchMyComplaints(): Promise<Complaint[]> {
  await requireSession();
  return callRpc<Complaint[]>("my_complaints");
}

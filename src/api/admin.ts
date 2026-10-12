/**
 * Admin data — live database source for the Admin Control Center.
 *
 * Every function reads a real Supabase table and maps rows onto the
 * Admin.tsx view-models. All functions throw on transport/RLS errors so
 * the caller can fall back to the bundled INITIAL_* demo arrays — the UI
 * is never blank, and a "Live DB" badge tells which source is showing.
 */

import { supabase } from "@/lib/supabase.ts";

export interface AdminDoctorRow {
  id: string;
  name: string;
  nameBn: string;
  bmdc: string;
  specialty: string;
  specialtyBn: string;
  degrees: string;
  hospital: string;
  experience: number;
  phone: string;
  appliedAt: string;
  appliedAtBn?: string;
  status: "pending" | "verified" | "rejected";
  dateOfBirth: string;
  age: number;
}

export interface AdminUpdateRow {
  id: string;
  title: string;
  titleBn: string;
  body: string;
  bodyBn: string;
  kind: "alert" | "campaign" | "notice";
  source: string;
  effectiveFrom: string;
  effectiveFromBn?: string;
  expiresAt: string;
}

export interface AdminArticleRow {
  id: string;
  title: string;
  titleBn: string;
  excerpt?: string;
  excerptBn?: string;
  doctorName: string;
  doctorNameBn?: string;
  bmdc: string;
  specialty: string;
  specialtyBn?: string;
  publishedAt: string;
  publishedAtBn?: string;
  views: number;
  status: "published" | "flagged";
}

export interface AdminComplaintRow {
  id: string;
  ticketNo: string;
  subject: string;
  subjectBn: string;
  targetType: "doctor" | "donor" | "blood_bank" | "platform";
  targetName: string;
  severity: 1 | 2 | 3;
  status: "open" | "in_review" | "resolved";
  slaClock: string;
  slaClockBn?: string;
  slaClockEn?: string;
  slaHours: number;
  submittedBy: string;
  submittedAt: string;
  submittedAtBn?: string;
  description: string;
  descriptionBn?: string;
}

function toNum(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : fallback;
}

function fmtDate(v: unknown): string {
  if (!v) return "";
  try {
    return new Date(v as string).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(v);
  }
}

/** Doctors queue: doctors + bilingual profile names + specialty names. */
export async function fetchAdminDoctors(): Promise<{
  pending: AdminDoctorRow[];
  verified: AdminDoctorRow[];
}> {
  if (!supabase) throw new Error("no-backend");
  const { data, error } = await supabase
    .from("doctors")
    .select(
      "user_id,bmdc_reg_no,degrees,experience_years,practice_address,verification,created_at,verified_at,profiles!inner(full_name,full_name_bn,phone,date_of_birth,age),specialties(name_en,name_bn)"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const map = (r: Record<string, unknown>): AdminDoctorRow => {
    const p = (r["profiles"] ?? {}) as Record<string, unknown>;
    const s = (r["specialties"] ?? {}) as Record<string, unknown>;
    const verification = String(r["verification"] ?? "pending");
    const degrees = Array.isArray(r["degrees"])
      ? (r["degrees"] as string[]).join(", ")
      : String(r["degrees"] ?? "");
    const dob = String(p["date_of_birth"] ?? "1990-01-01");
    return {
      id: String(r["user_id"] ?? ""),
      name: String(p["full_name"] ?? "Doctor"),
      nameBn: String(p["full_name_bn"] ?? p["full_name"] ?? "ডাক্তার"),
      bmdc: String(r["bmdc_reg_no"] ?? ""),
      specialty: String(s["name_en"] ?? "General Medicine"),
      specialtyBn: String(s["name_bn"] ?? s["name_en"] ?? "জেনারেল মেডিসিন"),
      degrees,
      hospital: String(r["practice_address"] ?? ""),
      experience: toNum(r["experience_years"], 0),
      phone: String(p["phone"] ?? ""),
      appliedAt: fmtDate(r["verified_at"] ?? r["created_at"]),
      status:
        verification === "verified"
          ? "verified"
          : verification === "rejected"
            ? "rejected"
            : "pending",
      dateOfBirth: dob,
      age: toNum(p["age"], 0),
    };
  };
  const all = rows.map(map).filter((d) => d.id);
  return {
    pending: all.filter((d) => d.status === "pending"),
    verified: all.filter((d) => d.status === "verified"),
  };
}

/** National bulletins straight from national_updates. */
export async function fetchAdminUpdates(): Promise<AdminUpdateRow[]> {
  if (!supabase) throw new Error("no-backend");
  const { data, error } = await supabase
    .from("national_updates")
    .select("id,title,title_bn,body,body_bn,kind,source,effective_from,expires_at")
    .order("effective_from", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((u) => ({
    id: String(u["id"] ?? ""),
    title: String(u["title"] ?? ""),
    titleBn: String(u["title_bn"] ?? u["title"] ?? ""),
    body: String(u["body"] ?? ""),
    bodyBn: String(u["body_bn"] ?? u["body"] ?? ""),
    kind: (["alert", "campaign", "notice"] as const).includes(
      u["kind"] as "alert"
    )
      ? (u["kind"] as "alert" | "campaign" | "notice")
      : "notice",
    source: String(u["source"] ?? "DGHS"),
    effectiveFrom: fmtDate(u["effective_from"]),
    expiresAt: u["expires_at"] ? fmtDate(u["expires_at"]) : "",
  }));
}

/** Moderation queue: published articles + verified author names. */
export async function fetchAdminArticles(): Promise<AdminArticleRow[]> {
  if (!supabase) throw new Error("no-backend");
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,title_bn,excerpt,excerpt_bn,status,flagged_review,published_at,view_count,author_id")
    .order("published_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const articles = (data ?? []) as Array<Record<string, unknown>>;
  const authorIds = [...new Set(articles.map((a) => String(a["author_id"] ?? "")).filter(Boolean))];
  let authorMap = new Map<string, Record<string, unknown>>();
  if (authorIds.length > 0) {
    const { data: docs } = await supabase
      .from("doctors")
      .select("user_id,bmdc_reg_no,profiles!inner(full_name,full_name_bn),specialties(name_en,name_bn)")
      .in("user_id", authorIds);
    for (const d of ((docs ?? []) as Array<Record<string, unknown>>)) {
      authorMap.set(String(d["user_id"]), d);
    }
  }
  return articles.map((a) => {
    const auth = authorMap.get(String(a["author_id"] ?? "")) ?? {};
    const p = (auth["profiles"] ?? {}) as Record<string, unknown>;
    const s = (auth["specialties"] ?? {}) as Record<string, unknown>;
    const flagged = a["flagged_review"] === true || a["status"] !== "published";
    return {
      id: String(a["id"] ?? ""),
      title: String(a["title"] ?? ""),
      titleBn: String(a["title_bn"] ?? a["title"] ?? ""),
      excerpt: String(a["excerpt"] ?? ""),
      excerptBn: String(a["excerpt_bn"] ?? a["excerpt"] ?? ""),
      doctorName: String(p["full_name"] ?? "Verified Doctor"),
      doctorNameBn: String(p["full_name_bn"] ?? p["full_name"] ?? ""),
      bmdc: String(auth["bmdc_reg_no"] ?? ""),
      specialty: String(s["name_en"] ?? ""),
      specialtyBn: String(s["name_bn"] ?? s["name_en"] ?? ""),
      publishedAt: fmtDate(a["published_at"]),
      views: toNum(a["view_count"], 0),
      status: flagged ? "flagged" : "published",
    };
  });
}

/** Complaints queue for the SLA monitor. */
export async function fetchAdminComplaints(): Promise<AdminComplaintRow[]> {
  if (!supabase) throw new Error("no-backend");
  const { data, error } = await supabase
    .from("complaints")
    .select("id,subject,description,severity,status,target_type,created_at,sla_due_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((c, i) => {
    const rawTarget = String(c["target_type"] ?? "platform");
    const targetType = (["doctor", "donor", "blood_bank", "platform"] as const).includes(
      rawTarget as "doctor"
    )
      ? (rawTarget as AdminComplaintRow["targetType"])
      : "platform";
    const status = String(c["status"] ?? "open");
    const sev = toNum(c["severity"], 2);
    return {
      id: String(c["id"] ?? `cmp-${i}`),
      ticketNo: `JR-${String(c["id"] ?? "").slice(0, 4).toUpperCase() || "DB"}`,
      subject: String(c["subject"] ?? ""),
      subjectBn: String(c["subject"] ?? ""),
      targetType,
      targetName: rawTarget,
      severity: (sev === 1 ? 1 : sev === 3 ? 3 : 2) as 1 | 2 | 3,
      status:
        status === "resolved" ? "resolved" : status === "in_review" ? "in_review" : "open",
      slaClock: c["sla_due_at"] ? fmtDate(c["sla_due_at"]) : "",
      slaHours: sev === 1 ? 24 : sev === 3 ? 168 : 72,
      submittedBy: "Database",
      submittedAt: fmtDate(c["created_at"]),
      description: String(c["description"] ?? ""),
      descriptionBn: String(c["description"] ?? ""),
    };
  });
}

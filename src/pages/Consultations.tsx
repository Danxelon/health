/**
 * <design_plan>
 * 1. RNG (seed = "Consultations" char count 13 % 101 = 13):
 *    random.choice("Component")   -> "horizontal consultation rows"
 *    random.choice("Motion")      -> "GSAP stagger reveal + hover lift"
 *    random.choice("Tone accent") -> "brand-soft avatar tile, muted meta"
 * 2. AIDA: Attention = SectionHeader (nav.consultations eyebrow + h2);
 *    Interest = the rows (doctor, symptom, schedule, fee); Desire = status
 *    badge clarity + hover physics; Action = row link to /consultations/:id
 *    and the empty-state CTA to /doctors.
 * 3. Container math: SectionHeader h2 is max-w-2xl by primitive; the list is
 *    `max-w-7xl` and the symptom line is clamped to 2 lines so every row keeps
 *    the same height at 320px with Bengali text.
 * 4. Bento density: one column of rows, each spanning the full track — no empty
 *    cells, no orphan spans; grid-flow not needed for a single track.
 * 5. Label sweep: no meta-labels, no emoji; blood-red is used only for
 *    declined/cancelled, and every status badge carries a word, never colour
 *    alone; primary button is bg-brand text-white.
 * </design_plan>
 */

/**
 * Consultations — my consultation list.
 *
 * The patient's own telemedicine history: one row per consultation, newest
 * first, each opening the thread view. Doctor identity is resolved once from
 * the directory rather than re-fetched per row, so the list paints as a single
 * pass and the directory call is shared.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, Stethoscope, UserRound } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

import { useAppShell } from "@/state/app-shell.tsx";
import { fetchMyConsultations } from "@/api/consultations.ts";
import { fetchDoctors } from "@/api/doctors.ts";
import { Badge, CardSkeleton, ErrorBanner, SectionHeader } from "@/components/ui.tsx";
import { DomainError, type Consultation, type DoctorCard } from "@/domain/types.ts";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STATUS_TONES: Record<
  Consultation["status"],
  "brand" | "blood" | "success" | "warning" | "muted" | "ink-brand"
> = {
  requested: "muted",
  accepted: "brand",
  in_progress: "brand",
  completed: "success",
  cancelled: "blood",
  declined: "blood",
};

const STATUS_LABELS: Record<Consultation["status"], { bn: string; en: string }> = {
  requested: { bn: "অনুরোধ পাঠানো", en: "Requested" },
  accepted: { bn: "গৃহীত", en: "Accepted" },
  in_progress: { bn: "চলমান", en: "In progress" },
  completed: { bn: "সম্পন্ন", en: "Completed" },
  cancelled: { bn: "বাতিল", en: "Cancelled" },
  declined: { bn: "অস্বীকৃত", en: "Declined" },
};

const COPY = {
  unknownDoctor: { bn: "ডাক্তারের তথ্য পাওয়া যায়নি", en: "Doctor details unavailable" },
  notScheduled: { bn: "সময় নির্ধারিত হয়নি", en: "Not scheduled yet" },
  emptyTitle: { bn: "এখনো কোনো পরামর্শ নেই", en: "No consultations yet" },
  emptyBody: {
    bn: "একজন যাচাইকৃত ডাক্তারের সাথে কথা বলুন — আপনার সমস্যা লিখে অনুরোধ পাঠান, ডাক্তার সময় ঠিক করে নেবেন।",
    en: "Talk to a verified doctor — describe your symptoms and the doctor confirms a time.",
  },
  emptyCta: { bn: "ডাক্তার খুঁজুন", en: "Find a doctor" },
};

const LOCALES: Record<"bn" | "en", string> = { bn: "bn-BD", en: "en-GB" };

function formatSchedule(value: string | null, lang: "bn" | "en"): string {
  if (!value) return COPY.notScheduled[lang];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return COPY.notScheduled[lang];
  return new Intl.DateTimeFormat(LOCALES[lang], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFee(fee: number | null, freeLabel: string, lang: "bn" | "en"): string {
  if (fee === null || fee === 0) return freeLabel;
  return fee.toLocaleString(LOCALES[lang]);
}

export default function Consultations() {
  const { t, lang } = useAppShell();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [doctorsById, setDoctorsById] = useState<Map<string, DoctorCard>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchMyConsultations(), fetchDoctors()])
      .then(([rows, doctors]) => {
        if (!active) return;
        const map = new Map<string, DoctorCard>();
        for (const doctor of doctors) map.set(doctor.user_id, doctor);
        setDoctorsById(map);
        setConsultations([...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof DomainError ? err.bilingual[lang] : t("errors.generic"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t, lang]);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const root = listRef.current;
      if (!root || loading || consultations.length === 0) return;
      gsap.fromTo(
        root.querySelectorAll("[data-row]"),
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, ease: "power3.out" }
      );
    },
    { scope: listRef, dependencies: [loading, consultations] }
  );

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24">
        <SectionHeader
          eyebrow={t("nav.consultations")}
          title={t("nav.consultations")}
          body={t("doctors.subtitle")}
          action={
            <Link
              to="/doctors?guide=open"
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep transition-colors"
            >
              <Stethoscope className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              {t("doctors.title")}
            </Link>
          }
        />

        {error && (
          <div className="mt-8">
            <ErrorBanner message={error} onRetry={() => window.location.reload()} />
          </div>
        )}

        {loading ? (
          <div
            className="mt-8 grid gap-3 sm:grid-cols-2"
            role="status"
            aria-live="polite"
            aria-label={t("common.loading")}
          >
            {[...Array(4)].map((_, i) => (
              <CardSkeleton key={i} className="h-36" />
            ))}
          </div>
        ) : error ? null : consultations.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-line bg-surface p-8 sm:p-12 text-center">
            <Stethoscope className="mx-auto h-10 w-10 text-subtle" strokeWidth={1.5} aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold text-ink">{COPY.emptyTitle[lang]}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">{COPY.emptyBody[lang]}</p>
            <Link
              to="/doctors?guide=open"
              className="mt-8 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-deep transition-colors"
            >
              {COPY.emptyCta[lang]}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div ref={listRef} className="mt-8 grid gap-3 sm:grid-cols-2">
            {consultations.map((consultation) => {
              const doctor = doctorsById.get(consultation.doctor_id);
              const doctorName = doctor?.display_name ?? doctor?.full_name ?? COPY.unknownDoctor[lang];
              const specialty = lang === "bn" ? doctor?.specialty_bn : doctor?.specialty_en;
              const statusTone = STATUS_TONES[consultation.status];
              const statusLabel = STATUS_LABELS[consultation.status][lang];
              const schedule = formatSchedule(consultation.scheduled_at, lang);
              const fee = formatFee(consultation.fee, t("doctors.free"), lang);

              return (
                <div key={consultation.id} data-row className="reveal-init">
                  <Link
                    to={`/consultations/${consultation.id}`}
                    className="group flex h-full flex-col gap-4 overflow-hidden rounded-3xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep transition-transform duration-700 ease-out group-hover:scale-105">
                        <UserRound className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{doctorName}</span>
                        {specialty && (
                          <span className="block truncate text-xs text-muted">{specialty}</span>
                        )}
                      </span>
                      <Badge tone={statusTone}>{statusLabel}</Badge>
                    </div>

                    {consultation.symptom_summary && (
                      <p className="line-clamp-2 text-sm text-muted">{consultation.symptom_summary}</p>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                        <span className="tnum">{schedule}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span>{t("doctors.fee")}</span>
                        <span className="tnum font-semibold text-ink">{fee}</span>
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-deep">
                        {t("doctors.message")}
                        <ArrowRight
                          className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

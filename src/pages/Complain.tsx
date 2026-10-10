/**
 * <design_plan>
 * 1. RNG (seed = Complain char count % 101 = 30): split form + summary, severity cards.
 * 2. AIDA: Attention h1; Interest form; Desire severity radio cards; Action submit.
 * 3. Container math: h1 max-w-6xl clamp -> 2-3 lines.
 * 4. Bento density: form column + confirmation panel interlock.
 * 5. Label sweep: complain.* keys, no meta-labels, no emoji, inline errors.
 * </design_plan>
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { useAppShell } from "@/state/app-shell.tsx";
import { fileComplaint, COMPLAINT_SLA_HOURS } from "@/api/complaints.ts";
import type { Complaint, ComplaintInput } from "@/api/complaints.ts";
import { DomainError } from "@/domain/types.ts";

const COPY = {
  severity1: { bn: "তাৎক্ষণিক — ২৪ ঘণ্টায়", en: "Urgent — within 24 hours" },
  severity2: { bn: "গুরুত্বপূর্ণ — ৩ দিনে", en: "High — within 3 days" },
  severity3: { bn: "সাধারণ — এক সপ্তাহে", en: "Normal — within a week" },
  targetPlatform: { bn: "প্ল্যাটফর্ম", en: "The platform" },
  targetDoctor: { bn: "কোনো ডাক্তার", en: "A doctor" },
  targetBank: { bn: "ব্লাড ব্যাংক", en: "A blood bank" },
  targetUser: { bn: "কোনো ব্যবহারকারী", en: "A user" },
  descriptionPh: { bn: "কী ঘটেছে, কখন, কোথায়…", en: "What happened, when, where…" },
  sending: { bn: "জমা দেওয়া হচ্ছে…", en: "Submitting…" },
  successTitle: { bn: "অভিযোগ জমা হয়েছে", en: "Complaint filed" },
  successBody: {
    bn: "আমরা পর্যালোচনা করেছি এবং সময়সীমার মধ্যে উত্তর দেব।",
    en: "We have logged it and will respond within the deadline.",
  },
  another: { bn: "আরেকটি অভিযোগ", en: "File another" },
  errors: {
    subjectRequired: { bn: "বিষয় লিখুন", en: "Subject is required" },
    descriptionRequired: { bn: "বিস্তারিত লিখুন (কমপক্ষে ২০ অক্ষর)", en: "Details required (at least 20 characters)" },
  },
};

const TARGETS: Array<{ value: ComplaintInput["target_type"]; label: { bn: string; en: string } }> = [
  { value: "platform", label: COPY.targetPlatform },
  { value: "doctor", label: COPY.targetDoctor },
  { value: "blood_bank", label: COPY.targetBank },
  { value: "user", label: COPY.targetUser },
];

export default function Complain() {
  const { t, lang } = useAppShell();
  const [targetType, setTargetType] = useState<ComplaintInput["target_type"]>("platform");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<1 | 2 | 3>(2);
  const [errors, setErrors] = useState<{ subject?: string; description?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [done, setDone] = useState<Complaint | null>(null);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (subject.trim().length < 3) next.subject = COPY.errors.subjectRequired[lang];
    if (description.trim().length < 20)
      next.description = COPY.errors.descriptionRequired[lang];
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const complaint = await fileComplaint({
        target_type: targetType,
        target_id: null,
        subject: subject.trim(),
        description: description.trim(),
        severity,
      });
      setDone(complaint);
    } catch (err) {
      setApiError(
        err instanceof DomainError ? err.bilingual[lang] : t("errors.generic")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const slaDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-16 sm:pt-24 pb-24">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep hover:text-brand transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("common.back")}
        </Link>

        <h1 className="display mt-4 max-w-6xl text-ink text-[clamp(2.25rem,5.5vw,4rem)]">
          {t("complain.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-muted">{t("complain.subtitle")}</p>

        {done ? (
          <div className="mt-10 rounded-3xl border border-success/40 bg-success-soft p-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-success" strokeWidth={1.8} aria-hidden="true" />
              <h2 className="text-xl font-semibold text-ink">{COPY.successTitle[lang]}</h2>
            </div>
            <p className="mt-2 text-sm text-muted">{COPY.successBody[lang]}</p>
            <dl className="mt-6 space-y-2">
              <div className="flex items-center gap-3">
                <dt className="text-sm text-muted">{t("complain.ticket")}</dt>
                <dd className="font-bold text-ink tnum">{done.ticket_no}</dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="text-sm text-muted">{t("complain.slaDue")}</dt>
                <dd className="text-sm text-ink tnum">{slaDate(done.sla_due_at)}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/complaints/mine"
                className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                {t("complain.mine")}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDone(null);
                  setSubject("");
                  setDescription("");
                  setSeverity(2);
                  setTargetType("platform");
                }}
                className="inline-flex h-11 items-center rounded-full border border-line bg-surface px-6 text-sm font-semibold text-ink hover:bg-elevated transition-colors cursor-pointer"
              >
                {COPY.another[lang]}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-10 max-w-2xl">
            {/* Target */}
            <fieldset>
              <legend className="text-sm font-semibold text-ink">
                {t("complain.target")}
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {TARGETS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTargetType(opt.value)}
                    aria-pressed={targetType === opt.value}
                    className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold cursor-pointer transition-colors ${
                      targetType === opt.value
                        ? "border-brand bg-brand-soft text-brand-deep"
                        : "border-line bg-surface text-ink hover:bg-elevated"
                    }`}
                  >
                    {opt.label[lang]}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Subject */}
            <div className="mt-6">
              <label
                htmlFor="complaint-subject"
                className="text-sm font-semibold text-ink"
              >
                {t("complain.subject")}
              </label>
              <input
                id="complaint-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                aria-invalid={Boolean(errors.subject)}
                aria-describedby={errors.subject ? "complaint-subject-error" : undefined}
                className="mt-2 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-subtle focus:border-brand focus:outline-none"
              />
              {errors.subject && (
                <p id="complaint-subject-error" role="alert" className="mt-1.5 text-xs text-blood-deep">
                  {errors.subject}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="mt-5">
              <label
                htmlFor="complaint-description"
                className="text-sm font-semibold text-ink"
              >
                {t("complain.description")}
              </label>
              <textarea
                id="complaint-description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? "complaint-description-error" : undefined}
                placeholder={COPY.descriptionPh[lang]}
                className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-subtle focus:border-brand focus:outline-none"
              />
              {errors.description && (
                <p id="complaint-description-error" role="alert" className="mt-1.5 text-xs text-blood-deep">
                  {errors.description}
                </p>
              )}
            </div>

            {/* Severity */}
            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-ink">
                {t("complain.severity")}
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 grid-flow-dense">
                {([1, 2, 3] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    aria-pressed={severity === s}
                    className={`rounded-2xl border p-4 text-left cursor-pointer transition-colors ${
                      severity === s
                        ? "border-brand bg-brand-soft"
                        : "border-line bg-surface hover:bg-elevated"
                    }`}
                  >
                    <span className="text-sm font-semibold text-ink">
                      {s === 1 ? COPY.severity1[lang] : s === 2 ? COPY.severity2[lang] : COPY.severity3[lang]}
                    </span>
                    <span className="mt-1 block text-xs text-muted tnum">
                      {COMPLAINT_SLA_HOURS[s]} {lang === "bn" ? "ঘণ্টা" : "hours"}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            {apiError && (
              <p className="mt-5 rounded-2xl border border-blood-soft bg-blood-soft/60 px-4 py-3 text-sm text-blood-deep" role="alert">
                {apiError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-brand px-8 text-sm font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {submitting ? COPY.sending[lang] : t("complain.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
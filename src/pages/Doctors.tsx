/**
 * <design_plan>
 * 1. RNG (seed = Doctors char count % 101 = 45): hero split-left, bento cards, stagger reveal.
 * 2. AIDA: Attention h1; Interest filters; Desire doctor cards; Action Book buttons.
 * 3. Container math: h1 max-w-6xl clamp -> 2-3 lines.
 * 4. Bento density: cards grid grid-flow-dense, zero voids.
 * 5. Label sweep: doctors.* keys, no meta-labels, no emoji.
 * </design_plan>
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight, CalendarCheck } from "lucide-react";
import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import { Badge, DistanceChip, CardSkeleton, ErrorBanner } from "@/components/ui.tsx";
import { fetchDoctors, type DoctorFilters } from "@/api/doctors.ts";
import { requestConsultation } from "@/api/consultations.ts";
import type { DoctorCard } from "@/domain/types.ts";
import { DEMO_SPECIALTIES } from "@/lib/demo-data.ts";
import { distanceBand } from "@/domain/matching.ts";
import { initialsOf, toBengaliDigits } from "@/domain/profile.ts";
import { DomainError } from "@/domain/types.ts";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const COPY = {
  filterTitle: { bn: "ফিল্টার", en: "Filter" },
  specialty: { bn: "বিশেষত্ব", en: "Specialty" },
  availableToday: { bn: "আজ উপলব্ধ", en: "Available today" },
  freeOnly: { bn: "শুধু ফ্রি", en: "Free only" },
  reset: { bn: "রিসেট", en: "Reset" },
  book: { bn: "সাক্ষাৎ নিন", en: "Book a visit" },
  message: { bn: "বার্তা", en: "Message" },
  symptomPh: { bn: "সংক্ষেপে সমস্যা লিখুন…", en: "Briefly describe your issue…" },
  symptomLabel: { bn: "আপনার সমস্যা", en: "Your concern" },
  sending: { bn: "পাঠানো হচ্ছে…", en: "Sending…" },
};

export default function Doctors() {
  const { t, lang } = useAppShell();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login?next=/doctors", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DoctorFilters>({});
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [symptomByDoctor, setSymptomByDoctor] = useState<Record<string, string>>({});
  const [composerFor, setComposerFor] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDoctors(filters)
      .then(setDoctors)
      .catch((err) =>
        setError(err instanceof DomainError ? err.bilingual[lang] : t("errors.generic"))
      )
      .finally(() => setLoading(false));
  }, [filters, lang, t]);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!listRef.current || loading) return;
      gsap.from(listRef.current.children, {
        opacity: 0,
        y: 28,
        duration: 0.6,
        stagger: 0.07,
        ease: "power3.out",
        clearProps: "all",
      });
    },
    { dependencies: [loading, doctors.length], scope: listRef }
  );

  const set = (patch: Partial<DoctorFilters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  const handleBook = async (doctor: DoctorCard) => {
    const summary = symptomByDoctor[doctor.user_id]?.trim() ?? "";
    if (!summary) {
      setComposerFor(doctor.user_id);
      return;
    }
    setBookingId(doctor.user_id);
    try {
      const c = await requestConsultation({
        doctor_id: doctor.user_id,
        symptom_summary: summary,
        scheduled_at: null,
      });
      navigate(`/consultations/${c.id}`);
    } catch (err) {
      setError(err instanceof DomainError ? err.bilingual[lang] : t("errors.generic"));
      setBookingId(null);
    }
  };

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-16 sm:pt-24 pb-24">
        <h1 className="display max-w-6xl text-ink text-[clamp(2.25rem,5.5vw,4rem)]">
          {t("doctors.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-muted">{t("doctors.subtitle")}</p>

        {/* Filters */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-muted">{COPY.filterTitle[lang]}</span>
          <select
            aria-label={COPY.specialty[lang]}
            value={filters.specialtySlug ?? ""}
            onChange={(e) => set({ specialtySlug: e.target.value || null })}
            className="h-11 rounded-full border border-line bg-surface px-4 text-sm text-ink"
          >
            <option value="">{t("doctors.anySpecialty")}</option>
            {DEMO_SPECIALTIES.map((s) => (
              <option key={s.slug} value={s.slug}>
                {lang === "bn" ? s.bn : s.en}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => set({ availableTodayOnly: !filters.availableTodayOnly })}
            aria-pressed={Boolean(filters.availableTodayOnly)}
            className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold cursor-pointer transition-colors ${
              filters.availableTodayOnly
                ? "border-brand bg-brand-soft text-brand-deep"
                : "border-line bg-surface text-ink"
            }`}
          >
            {COPY.availableToday[lang]}
          </button>
          <button
            type="button"
            onClick={() => set({ freeOnly: !filters.freeOnly })}
            aria-pressed={Boolean(filters.freeOnly)}
            className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold cursor-pointer transition-colors ${
              filters.freeOnly
                ? "border-brand bg-brand-soft text-brand-deep"
                : "border-line bg-surface text-ink"
            }`}
          >
            {COPY.freeOnly[lang]}
          </button>
          <button
            type="button"
            onClick={() => setFilters({})}
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-muted hover:text-ink cursor-pointer"
          >
            {COPY.reset[lang]}
          </button>
        </div>

        {loading && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 grid-flow-dense" role="status" aria-live="polite">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="mt-8">
            <ErrorBanner
              message={error}
              onRetry={() => setFilters((f) => ({ ...f }))}
            />
          </div>
        )}

        {!loading && !error && doctors.length === 0 && (
          <p className="mt-12 rounded-3xl border border-line bg-surface p-10 text-center text-sm text-muted">
            {t("doctors.noResults")}
          </p>
        )}

        {!loading && !error && doctors.length > 0 && (
          <div
            ref={listRef}
            aria-live="polite"
            className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 grid-flow-dense"
          >
            {doctors.map((d) => (
              <article
                key={d.user_id}
                className="group flex flex-col rounded-3xl border border-line bg-surface p-5 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep font-bold">
                    {initialsOf(d.display_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold text-ink">{d.display_name}</h2>
                    <p className="truncate text-xs text-muted">
                      {d.degrees ?? (lang === "bn" ? d.specialty_bn : d.specialty_en)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="success">
                    <ShieldCheck className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
                    {t("doctors.verified")}
                  </Badge>
                  {d.distance_km !== null && (
                    <DistanceChip km={d.distance_km} band={distanceBand(d.distance_km * 1000)} />
                  )}
                  {d.experience_years !== null && (
                    <span className="text-xs text-muted tnum">
                      {toBengaliDigits(d.experience_years)} {t("doctors.years")}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm font-semibold text-ink tnum">
                  {d.consult_fee === null || d.consult_fee === 0
                    ? t("doctors.free")
                    : `${toBengaliDigits(d.consult_fee)}`}
                </p>

                {composerFor === d.user_id && (
                  <div className="mt-3">
                    <label
                      htmlFor={`sym-${d.user_id}`}
                      className="text-xs font-semibold text-muted"
                    >
                      {COPY.symptomLabel[lang]}
                    </label>
                    <textarea
                      id={`sym-${d.user_id}`}
                      rows={2}
                      value={symptomByDoctor[d.user_id] ?? ""}
                      onChange={(e) =>
                        setSymptomByDoctor((m) => ({ ...m, [d.user_id]: e.target.value }))
                      }
                      placeholder={COPY.symptomPh[lang]}
                      className="mt-1 w-full rounded-2xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-subtle"
                    />
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={bookingId === d.user_id}
                    onClick={() => handleBook(d)}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    <CalendarCheck className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    {bookingId === d.user_id ? COPY.sending[lang] : COPY.book[lang]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerFor(d.user_id)}
                    className="inline-flex h-11 items-center justify-center gap-1 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-elevated transition-colors cursor-pointer"
                  >
                    {COPY.message[lang]}
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
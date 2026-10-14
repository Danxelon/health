/**
 * <design_plan>
 * 1. RNG (seed = Doctors char count % 101 = 45): hero split-left, bento cards, stagger reveal.
 * 2. AIDA: Attention h1; Interest filters; Desire doctor cards; Action Book buttons.
 * 3. Guided Specialty Filter: First shows what each specialty does in plain Bengali/English,
 *    allowing common people to easily pick based on symptoms.
 * 4. Active Explainer Banner: Shows selected specialty, plain-language description, and change filter button.
 * 5. Full query param support: ?specialty=4 or ?specialty=cardiology auto-selects specialty 4.
 * </design_plan>
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  CalendarCheck,
  MessageCircle,
  Loader2,
  Sparkles,
  Stethoscope,
  Baby,
  User,
  HeartPulse,
  Bone,
  Ear,
  Eye,
  Brain,
  Droplet,
  Activity,
  Phone,
} from "lucide-react";
import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import { Badge, DistanceChip, CardSkeleton, ErrorBanner } from "@/components/ui.tsx";
import { fetchDoctors, type DoctorFilters } from "@/api/doctors.ts";
import { requestConsultation } from "@/api/consultations.ts";
import type { DoctorCard } from "@/domain/types.ts";
import { DEMO_SPECIALTIES } from "@/lib/demo-data.ts";
import { DoctorSpecialtyGuide } from "@/components/DoctorSpecialtyGuide.tsx";
import { distanceBand } from "@/domain/matching.ts";
import { initialsOf, toBengaliDigits } from "@/domain/profile.ts";
import { ageInYears } from "@/domain/eligibility.ts";
import { DomainError } from "@/domain/types.ts";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const SPECIALTY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope,
  Baby,
  User,
  HeartPulse,
  Sparkles,
  Bone,
  Ear,
  Eye,
  Brain,
  Droplet,
  Activity,
};

const COPY = {
  filterTitle: { bn: "ফিল্টার", en: "Filter" },
  specialty: { bn: "বিশেষত্ব", en: "Specialty" },
  availableToday: { bn: "আজ উপলব্ধ", en: "Available today" },
  freeOnly: { bn: "শুধু ফ্রি", en: "Free only" },
  reset: { bn: "রিসেট", en: "Reset" },
  book: { bn: "সাক্ষাৎ নিন", en: "Book a visit" },
  message: { bn: "বার্তা", en: "Message" },
  chat: { bn: "বার্তা পাঠান (Chat)", en: "Message (Chat)" },
  chatLoading: { bn: "চ্যাট খোলা হচ্ছে…", en: "Opening chat…" },
  call: { bn: "কল করুন (Call)", en: "Call" },
  whatsapp: { bn: "হোয়াটসঅ্যাপে কল করুন", en: "WhatsApp Call" },
  bmdcLabel: { bn: "বিএমডিসি", en: "BMDC" },
  expLabel: { bn: "অভিজ্ঞতা", en: "Exp" },
  ageLabel: { bn: "বয়স", en: "Age" },
  symptomPh: { bn: "সংক্ষেপে সমস্যা লিখুন…", en: "Briefly describe your issue…" },
  symptomLabel: { bn: "আপনার সমস্যা", en: "Your concern" },
  sending: { bn: "পাঠানো হচ্ছে…", en: "Sending…" },
  openGuide: { bn: "গাইড ফিল্টার খুলুন (Specialty Guide)", en: "Specialty Guide" },
  changeFilter: { bn: "ফিল্টার পরিবর্তন করুন (Change Filter)", en: "Change Filter" },
  viewAll: { bn: "সকল ডাক্তার দেখুন (View all doctors)", en: "View all doctors" },
};

export default function Doctors() {
  const { t, lang } = useAppShell();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login?next=/doctors", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  // Read URL query parameter for specialty (e.g. ?specialty=4 or ?specialty=cardiology)
  const specialtyParam = searchParams.get("specialty") || searchParams.get("specialty_id");
  const initialSpecialty = useMemo(() => {
    if (!specialtyParam) return null;
    return (
      DEMO_SPECIALTIES.find(
        (s) =>
          String(s.id) === specialtyParam ||
          s.slug.toLowerCase() === specialtyParam.toLowerCase()
      ) ?? null
    );
  }, [specialtyParam]);

  // State: showGuide is true by default if no filter is selected
  const [showGuide, setShowGuide] = useState<boolean>(() => !initialSpecialty);
  const [filters, setFilters] = useState<DoctorFilters>(() =>
    initialSpecialty
      ? { specialty_id: initialSpecialty.id, specialtySlug: initialSpecialty.slug }
      : {}
  );

  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [symptomByDoctor, setSymptomByDoctor] = useState<Record<string, string>>({});
  const [composerFor, setComposerFor] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync state if URL query params change externally
  useEffect(() => {
    const param = searchParams.get("specialty") || searchParams.get("specialty_id");
    if (param) {
      const match = DEMO_SPECIALTIES.find(
        (s) =>
          String(s.id) === param || s.slug.toLowerCase() === param.toLowerCase()
      );
      if (match) {
        setFilters((f) => {
          if (f.specialty_id === match.id && f.specialtySlug === match.slug) return f;
          return { ...f, specialty_id: match.id, specialtySlug: match.slug };
        });
        setShowGuide(false);
      }
    }
  }, [searchParams]);

  // Fetch doctors whenever filters change
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

  // GSAP animation for smooth reveal of doctor cards
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!listRef.current || loading || showGuide) return;
      gsap.from(listRef.current.children, {
        opacity: 0,
        y: 28,
        duration: 0.6,
        stagger: 0.07,
        ease: "power3.out",
        clearProps: "all",
      });
    },
    { dependencies: [loading, doctors.length, showGuide], scope: listRef }
  );

  const set = (patch: Partial<DoctorFilters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  // Pick specialty from Guided Filter
  const handleSelectSpecialty = (
    specialtyId: number | null,
    specialtySlug?: string | null
  ) => {
    if (specialtyId === null) {
      handleViewAllDoctors();
      return;
    }
    setFilters((prev) => ({
      ...prev,
      specialty_id: specialtyId,
      specialtySlug: specialtySlug ?? null,
    }));
    setShowGuide(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("specialty", String(specialtyId));
      return next;
    });
  };

  // View all doctors directly
  const handleViewAllDoctors = () => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next.specialty_id;
      delete next.specialtySlug;
      return next;
    });
    setShowGuide(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("specialty");
      next.delete("specialty_id");
      return next;
    });
  };

  // Currently selected specialty metadata for the explainer banner
  const selectedSpecialty = useMemo(() => {
    if (filters.specialty_id) {
      return DEMO_SPECIALTIES.find((s) => s.id === filters.specialty_id) ?? null;
    }
    if (filters.specialtySlug) {
      return DEMO_SPECIALTIES.find((s) => s.slug === filters.specialtySlug) ?? null;
    }
    return null;
  }, [filters.specialty_id, filters.specialtySlug]);

  const handleMessageDoctor = async (doctor: DoctorCard) => {
    setMessagingId(doctor.user_id);
    setError(null);
    try {
      const c = await requestConsultation({
        doctor_id: doctor.user_id,
        symptom_summary: "প্রাথমিক অনলাইন স্বাস্থ্য পরামর্শ ও আলোচনা",
        scheduled_at: null,
      });
      navigate(`/consultations/${c.id}`);
    } catch (err) {
      setError(err instanceof DomainError ? err.bilingual[lang] : t("errors.generic"));
      setMessagingId(null);
    }
  };

  const handleBook = async (doctor: DoctorCard) => {
    const summary = symptomByDoctor[doctor.user_id]?.trim() ?? "";
    if (!summary && composerFor !== doctor.user_id) {
      setComposerFor(doctor.user_id);
      return;
    }
    const finalSummary =
      summary || (lang === "bn" ? "সাক্ষাতের জন্য পরামর্শ অনুরোধ" : "Appointment visit request");
    setBookingId(doctor.user_id);
    try {
      const c = await requestConsultation({
        doctor_id: doctor.user_id,
        symptom_summary: finalSummary,
        scheduled_at: null,
      });
      navigate(`/consultations/${c.id}`);
    } catch (err) {
      setError(err instanceof DomainError ? err.bilingual[lang] : t("errors.generic"));
      setBookingId(null);
    }
  };

  const BannerIcon =
    selectedSpecialty?.icon_name && SPECIALTY_ICONS[selectedSpecialty.icon_name]
      ? SPECIALTY_ICONS[selectedSpecialty.icon_name]!
      : Stethoscope;

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-16 sm:pt-24 pb-24">
        {/* Header Hero */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="display max-w-6xl text-ink text-[clamp(2.25rem,5.5vw,4rem)]">
              {t("doctors.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-muted">{t("doctors.subtitle")}</p>
          </div>

          {!showGuide && (
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-brand/30 bg-brand-soft/70 px-5 text-xs sm:text-sm font-bold text-brand-deep hover:bg-brand-soft hover:border-brand/60 transition-all cursor-pointer shadow-2xs self-start md:self-end shrink-0"
            >
              <Sparkles className="h-4 w-4 text-brand" />
              <span>{COPY.openGuide[lang]}</span>
            </button>
          )}
        </div>

        {/* Guided Specialty & Symptom Filter */}
        {showGuide ? (
          <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <DoctorSpecialtyGuide
              onSelectSpecialty={handleSelectSpecialty}
              selectedSpecialtyId={filters.specialty_id}
              onDismiss={doctors.length > 0 ? () => setShowGuide(false) : undefined}
            />
          </div>
        ) : (
          <>
            {/* Active Explainer Banner when a specialty is picked */}
            {selectedSpecialty && (
              <div className="mt-8 rounded-3xl border border-brand/25 bg-gradient-to-br from-brand-soft/50 via-surface to-elevated p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-xs">
                    <BannerIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-brand-deep bg-brand-soft px-2.5 py-0.5 rounded-full border border-brand/20">
                        {lang === "bn" ? "বাছাইকৃত বিশেষত্ব" : "Active Specialty Filter"}
                      </span>
                      <span className="text-xs font-semibold text-muted">
                        {lang === "bn"
                          ? `(${toBengaliDigits(doctors.length)} জন ডাক্তার প্রস্তুত)`
                          : `(${doctors.length} doctors available)`}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-ink">
                      {lang === "bn"
                        ? `${selectedSpecialty.bn} বিশেষজ্ঞ — ${selectedSpecialty.en}`
                        : `${selectedSpecialty.en} Specialist (${selectedSpecialty.bn})`}
                    </h2>
                    <p className="mt-1 text-sm text-ink/90 font-medium leading-relaxed max-w-2xl">
                      {lang === "bn"
                        ? (selectedSpecialty.symptoms_bn || selectedSpecialty.description_bn)
                        : (selectedSpecialty.symptoms_en || selectedSpecialty.description_en)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => setShowGuide(true)}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-xs sm:text-sm font-bold text-white hover:bg-brand-deep transition-all cursor-pointer shadow-xs active:scale-98"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{COPY.changeFilter[lang]}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleViewAllDoctors}
                    className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-xs sm:text-sm font-semibold text-muted hover:text-ink hover:bg-elevated transition-colors cursor-pointer"
                  >
                    <span>{lang === "bn" ? "সকল ডাক্তার দেখুন" : "View All"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Filters Toolbar */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-muted">{COPY.filterTitle[lang]}</span>
              
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft/70 px-4 text-sm font-bold text-brand-deep hover:bg-brand-soft transition-all cursor-pointer shadow-2xs"
              >
                <Sparkles className="h-4 w-4 text-brand" />
                <span>{COPY.openGuide[lang]}</span>
              </button>

              <select
                aria-label={COPY.specialty[lang]}
                value={
                  filters.specialty_id
                    ? String(filters.specialty_id)
                    : (filters.specialtySlug ?? "")
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    handleViewAllDoctors();
                  } else {
                    const match = DEMO_SPECIALTIES.find(
                      (s) => String(s.id) === val || s.slug === val
                    );
                    if (match) {
                      handleSelectSpecialty(match.id, match.slug);
                    } else {
                      set({ specialtySlug: val, specialty_id: null });
                    }
                  }
                }}
                className="h-11 rounded-full border border-line bg-surface px-4 text-sm text-ink"
              >
                <option value="">{t("doctors.anySpecialty")}</option>
                {DEMO_SPECIALTIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {lang === "bn" ? `${s.bn} (${s.en})` : `${s.en} (${s.bn})`}
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

              <div className="inline-flex h-11 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-4 text-xs font-bold text-emerald-800 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {lang === "bn" ? "সকল ডাক্তারের পরামর্শ ১০০% বিনামূল্যে" : "All Consultations 100% Free"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFilters({});
                  setSearchParams({});
                }}
                className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-muted hover:text-ink cursor-pointer"
              >
                {COPY.reset[lang]}
              </button>
            </div>

            {/* Doctors Loading Skeleton */}
            {loading && (
              <div
                className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 grid-flow-dense"
                role="status"
                aria-live="polite"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Error Message */}
            {error && !loading && (
              <div className="mt-8">
                <ErrorBanner
                  message={error}
                  onRetry={() => setFilters((f) => ({ ...f }))}
                />
              </div>
            )}

            {/* Empty Doctors Result */}
            {!loading && !error && doctors.length === 0 && (
              <div className="mt-12 rounded-3xl border border-line bg-surface p-10 text-center">
                <p className="text-base font-bold text-ink">
                  {t("doctors.noResults")}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {lang === "bn"
                    ? "এই বিশেষত্বে কোনো ডাক্তার পাওয়া যায়নি। ফিল্টার রিসেট করে অন্য বিভাগে দেখুন।"
                    : "No doctors found matching this filter. Try resetting filters."}
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGuide(true)}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-xs font-bold text-white hover:bg-brand-deep cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{COPY.openGuide[lang]}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleViewAllDoctors}
                    className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-xs font-semibold text-ink hover:bg-elevated cursor-pointer"
                  >
                    <span>{COPY.viewAll[lang]}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Doctor Cards Grid */}
            {!loading && !error && doctors.length > 0 && (
              <div
                ref={listRef}
                aria-live="polite"
                className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 grid-flow-dense"
              >
                {doctors.map((d) => {
                  const primaryName =
                    lang === "bn"
                      ? (d.full_name_bn || d.display_name)
                      : (d.full_name || d.display_name);
                  const secondaryName =
                    lang === "bn"
                      ? (d.full_name || (d.display_name !== primaryName ? d.display_name : null))
                      : (d.full_name_bn || (d.display_name !== primaryName ? d.display_name : null));
                  const showSecondary = Boolean(
                    secondaryName && secondaryName.trim() && secondaryName !== primaryName
                  );
                  const doctorAge =
                    typeof d.age === "number" && d.age > 0
                      ? d.age
                      : ageInYears(d.date_of_birth ?? null);

                  return (
                    <article
                      key={d.user_id}
                      className="group flex flex-col rounded-3xl border border-line bg-surface p-5 transition-transform duration-300 hover:-translate-y-1 shadow-2xs hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        {d.avatar_url ? (
                          <img
                            src={d.avatar_url}
                            alt={primaryName}
                            className="h-12 w-12 shrink-0 rounded-full object-cover border border-line/60"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep font-bold text-sm">
                            {initialsOf(d.full_name || d.display_name || primaryName)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate font-bold text-ink text-base tracking-tight leading-snug">
                            {primaryName}
                          </h2>
                          {showSecondary && (
                            <p className="truncate text-xs font-medium text-muted mt-0.5">
                              {secondaryName}
                            </p>
                          )}
                          <p className="truncate text-xs text-muted/80 mt-0.5">
                            {d.degrees ?? (lang === "bn" ? d.specialty_bn : d.specialty_en)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Badge tone="success">
                          <ShieldCheck className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
                          {t("doctors.verified")}
                        </Badge>
                        {d.bmdc_reg_no && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-elevated px-2 py-0.5 text-xs font-medium text-ink/85 border border-line/60"
                            title={`BMDC: ${d.bmdc_reg_no}`}
                          >
                            <span className="text-[10px] font-bold text-muted uppercase">
                              {COPY.bmdcLabel[lang]}
                            </span>
                            <span className="tnum font-semibold">
                              {d.bmdc_reg_no.startsWith("BMDC-") ? d.bmdc_reg_no.slice(5) : d.bmdc_reg_no}
                            </span>
                          </span>
                        )}
                        {d.experience_years !== null && d.experience_years !== undefined && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-elevated px-2 py-0.5 text-xs font-medium text-ink/85 border border-line/60">
                            <span className="text-[10px] font-bold text-muted uppercase">
                              {COPY.expLabel[lang]}
                            </span>
                            <span className="tnum font-semibold">
                              {lang === "bn"
                                ? `${toBengaliDigits(d.experience_years)} ${t("doctors.years")}`
                                : `${d.experience_years} ${t("doctors.years")}`}
                            </span>
                          </span>
                        )}
                        {doctorAge !== null && doctorAge !== undefined && doctorAge > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-elevated px-2 py-0.5 text-xs font-medium text-ink/85 border border-line/60">
                            <span className="text-[10px] font-bold text-muted uppercase">
                              {COPY.ageLabel[lang]}
                            </span>
                            <span className="tnum font-semibold">
                              {lang === "bn"
                                ? `${toBengaliDigits(doctorAge)} বছর`
                                : `${doctorAge} yrs`}
                            </span>
                          </span>
                        )}
                        {d.distance_km !== null && (
                          <DistanceChip km={d.distance_km} band={distanceBand(d.distance_km * 1000)} />
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-bold shadow-2xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {lang === "bn" ? "বিনামূল্যে (সরকারি সেবা)" : "Free (Govt. Service)"}
                        </span>
                        <span className="text-[11px] font-semibold text-muted">
                          {lang === "bn" ? "ফি: ৳০" : "Fee: ৳0"}
                        </span>
                      </div>

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
                            className="mt-1 w-full rounded-2xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-brand focus:outline-none"
                          />
                        </div>
                      )}

                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          disabled={messagingId === d.user_id || bookingId === d.user_id}
                          onClick={() => handleMessageDoctor(d)}
                          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep transition-all cursor-pointer disabled:opacity-60 shadow-xs"
                        >
                          {messagingId === d.user_id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              <span>{COPY.chatLoading[lang]}</span>
                            </>
                          ) : (
                            <>
                              <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                              <span>{COPY.chat[lang]}</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={bookingId === d.user_id || messagingId === d.user_id}
                          onClick={() => handleBook(d)}
                          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-elevated transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {bookingId === d.user_id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              <span>{COPY.sending[lang]}</span>
                            </>
                          ) : (
                            <>
                              <CalendarCheck className="h-4 w-4 text-brand-deep" strokeWidth={1.8} aria-hidden="true" />
                              <span>{COPY.book[lang]}</span>
                            </>
                          )}
                        </button>
                        {d.phone && (
                          <>
                            <a
                              href={`tel:${d.phone}`}
                              aria-label={COPY.call[lang]}
                              title={COPY.call[lang]}
                              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                            >
                              <Phone className="h-4 w-4" strokeWidth={1.8} />
                            </a>
                            <a
                              href={`https://wa.me/${d.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                                lang === "bn"
                                  ? `আসসালামু আলাইকুম, আমি একজন রোগী। আপনার সাথে পরামর্শ করতে চাই।`
                                  : `Hello, I am a patient. I would like a consultation with you.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={COPY.whatsapp[lang]}
                              title={COPY.whatsapp[lang]}
                              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors"
                            >
                              <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
                            </a>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
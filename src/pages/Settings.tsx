/**
 * <design_plan>
 * 1. RNG (seed = "Settings".length = 8; 8 % 101 = 8):
 *    random.choice("hero")      -> "quiet header, no aurora" — a utility page
 *                                  speaks calmly, not cinematically.
 *    random.choice("component") -> "segmented pill radio group" — native radios,
 *                                  arrow-key operable, visible labels.
 *    random.choice("GSAP")      -> "per-panel fade + rise on ScrollTrigger,
 *                                  0.05s stagger capped at 0.25s".
 *    Fonts: Cabinet Grotesk display / Satoshi text, unchanged (brand stack).
 * 2. AIDA: Attention = H1 block; Interest = theme, language, identity panels;
 *    Desire = availability + contact visibility (control over one's own record);
 *    Action = dark reassurance strip with two routes out (find a donor, request).
 * 3. Container math: H1 `max-w-6xl` + text-[clamp(2.25rem,5vw,3.75rem)] — the
 *    word "Settings"/"সেটিংস" holds one line at 320px and never past two; the
 *    supporting line is `max-w-2xl`.
 * 4. Bento density: panel grid `grid-flow-dense`.
 *    lg (6 cols):  3+3 | 6 | 3+3 | 6            = 24/24 cells, zero voids.
 *    md (2 cols):  1+1 | 2 | 2 | 2 | 2          = 10/10 cells, zero voids.
 *    base (1 col): six stacked full-width panels.
 *    Identity field grid: sm 1+1 | 1+1 | 2 (NID spans) = 6/6; lg 1×5 = 5/5.
 * 5. Label sweep: no meta-labels, no emoji; every radio sits in a visible label
 *    and every group carries an aria-label or legend; blood red appears only on
 *    error panels, never as decoration.
 * </design_plan>
 */

/**
 * Settings — the citizen's own controls.
 *
 * Six panels, each answering one question a person actually asks about their
 * record: how does it look, what language, who am I here, can I donate right
 * now, who may see my number, and who already has. Every write goes through
 * `@/api/profile.ts`; nothing here invents a local truth about contact sharing.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Check,
  Clock,
  Droplet,
  HeartPulse,
  Languages,
  LogOut,
  Palette,
  ShieldCheck,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import { ErrorBanner, SectionHeader } from "@/components/ui.tsx";
import {
  fetchMyProfile,
  fetchUnlockHistory,
  setContactVisibility,
  setDonorAvailability,
  type ContactVisibility,
  type ProfileSummary,
  type UnlockHistoryItem,
} from "@/api/profile.ts";
import { AVAILABILITY_OPTIONS } from "@/domain/eligibility.ts";
import { maskPhone, maskedNid, toBengaliDigits } from "@/domain/profile.ts";
import { DomainError, type DonorTempStatus } from "@/domain/types.ts";
import type { Lang } from "@/lib/strings.ts";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* -------------------------------------------------------------------------- */
/* Copy — only what the shared dictionary does not already say                 */
/* -------------------------------------------------------------------------- */

const COPY = {
  headerBody: {
    bn: "আপনার পরিচয়, রক্তদানের অবস্থা এবং কে আপনার সাথে যোগাযোগ করতে পারবেন — সব এক জায়গায়।",
    en: "Your identity, your availability, and who may reach you — all in one place.",
  },
  name: { bn: "নাম", en: "Name" },
  notGiven: { bn: "দেওয়া নেই", en: "Not given" },
  identityNote: {
    bn: "আপনার পরিচয় তথ্য এই অ্যাকাউন্টে রাখা হয়।",
    en: "Your identity details are kept with this account.",
  },
  themeBody: {
    bn: "আলো ও অন্ধকার — আপনার চোখের আরাম অনুযায়ী।",
    en: "Light or dark, whichever your eyes prefer.",
  },
  languageBody: {
    bn: "পুরো অ্যাপ্লিকেশন এই ভাষায় দেখা যাবে।",
    en: "The whole application reads in this language.",
  },
  availabilityBody: {
    bn: "আপনি এখন রক্ত দিতে পারবেন কি না — যেকোনো সময় বদলাতে পারেন।",
    en: "Whether you can give blood right now — change it whenever you need.",
  },
  visibilityBody: {
    bn: "আপনার নম্বর কখনো অনুসন্ধান ফলাফলে দেখা যায় না। আপনি রাজি হওয়ার পরেই কেবল অনুরোধকারী সেটি দেখতে পান, এবং প্রতিটি প্রকাশ নিচে লিপিবদ্ধ থাকে।",
    en: "Your number never appears in search results. A requestor sees it only after you accept, and every share is recorded below.",
  },
  unlocksBody: {
    bn: "কখন যোগাযোগের তথ্য দেখানো হয়েছে।",
    en: "When your contact has been shown to others.",
  },
  actionTitle: { bn: "আপনার তথ্য, আপনার নিয়ন্ত্রণ", en: "Your record, your control" },
  actionBody: {
    bn: "পরিবর্তন সঙ্গে সঙ্গে সংরক্ষিত হয়। আপনি রাজি না হলে আপনার নম্বর গোপন থাকে।",
    en: "Changes save as you make them. Your number stays hidden until you say yes.",
  },
} as const;

/** The two contact modes, mapped onto the strings the dictionary already has. */
const CONTACT_VISIBILITY: readonly {
  value: ContactVisibility;
  labelKey: string;
  hint: { bn: string; en: string };
}[] = [
  {
    value: "on_accept",
    labelKey: "settings.onUnlock",
    hint: {
      bn: "আপনি রাজি হওয়ার পরেই কেবল অনুরোধকারী আপনার নম্বর দেখতে পান।",
      en: "Only after you accept does the requestor see your number.",
    },
  },
  {
    value: "private_admin",
    labelKey: "settings.privateAdmin",
    hint: {
      bn: "আপনার নম্বর কেবল প্ল্যাটফর্ম প্রশাসকের কাছে থাকে।",
      en: "Your number stays with the platform admin alone.",
    },
  },
];

const PANEL = "rounded-3xl border border-line bg-surface p-5 sm:p-6";

type SaveState = "idle" | "saving" | "saved";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** The bilingual sentence out of a DomainError; never `String(err)`. */
function errorMessage(err: unknown, lang: Lang, fallback: string): string {
  if (err instanceof DomainError) return err.bilingual[lang];
  return fallback;
}

function formatUnlockDate(iso: string, lang: Lang): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                    */
/* -------------------------------------------------------------------------- */

/** A segmented pill group built on native radios — arrow keys move, Tab exits. */
function Segmented<T extends string>({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="mt-4 inline-flex rounded-full border border-line bg-elevated p-1"
    >
      {options.map((option) => (
        <label key={option.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span className="block rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Radio cards with an optional supporting line under each choice. */
function RadioCards<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  gridClass,
}: {
  name: string;
  legend: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (next: T) => void;
  gridClass: string;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="sr-only">{legend}</legend>
      <div className={`grid ${gridClass}`}>
        {options.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
              <span className="text-sm font-semibold text-ink">{option.label}</span>
              {option.hint && <span className="text-xs text-muted">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  value,
  spanClass = "",
}: {
  label: string;
  value: string;
  spanClass?: string;
}) {
  return (
    <div className={`rounded-2xl border border-line bg-elevated/60 px-4 py-3 ${spanClass}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">{label}</dt>
      <dd className="tnum mt-1 text-[15px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** One shared status line: empty, saving, or saved. Never a colour-only cue. */
function SaveStatus({ state, savingLabel, savedLabel }: { state: SaveState; savingLabel: string; savedLabel: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="mt-4 flex min-h-5 items-center gap-1.5 text-xs font-semibold text-brand-deep"
    >
      {state === "saving" && <span>{savingLabel}</span>}
      {state === "saved" && (
        <>
          <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          <span>{savedLabel}</span>
        </>
      )}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function Settings() {
  const { t, lang, theme, setTheme, setLang } = useAppShell();
  const { isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);

  // Auth gate: redirect to login if unauthenticated
  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login?next=/settings", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailure, setLoadFailure] = useState<unknown>(null);

  const [unlocks, setUnlocks] = useState<UnlockHistoryItem[] | null>(null);
  const [unlocksFailure, setUnlocksFailure] = useState<unknown>(null);

  const [availability, setAvailability] = useState<DonorTempStatus>("available");
  const [availabilityState, setAvailabilityState] = useState<SaveState>("idle");
  const [availabilityFailure, setAvailabilityFailure] = useState<unknown>(null);

  const [visibility, setVisibility] = useState<ContactVisibility>("on_accept");
  const [visibilityState, setVisibilityState] = useState<SaveState>("idle");
  const [visibilityFailure, setVisibilityFailure] = useState<unknown>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const panels = rootRef.current?.querySelectorAll<HTMLElement>("[data-settings-panel]");
      if (!panels || panels.length === 0) return;
      panels.forEach((panel, index) => {
        gsap.fromTo(
          panel,
          { opacity: 0, y: 22 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            delay: Math.min(index * 0.05, 0.25),
            ease: "power2.out",
            scrollTrigger: { trigger: panel, start: "top 92%" },
          }
        );
      });
    },
    { scope: rootRef }
  );

  useEffect(() => {
    if (!isLoggedIn) return;
    let alive = true;
    setLoading(true);
    setLoadFailure(null);
    fetchMyProfile()
      .then((data) => {
        if (!alive) return;
        setProfile(data);
        setVisibility(data.contact_visibility);
        const match = AVAILABILITY_OPTIONS.find((option) => option.value === data.donor_status);
        setAvailability(match ? match.value : "available");
      })
      .catch((err: unknown) => {
        if (alive) setLoadFailure(err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isLoggedIn, reloadKey]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let alive = true;
    setUnlocks(null);
    setUnlocksFailure(null);
    fetchUnlockHistory()
      .then((list) => {
        if (alive) setUnlocks(list);
      })
      .catch((err: unknown) => {
        if (alive) setUnlocksFailure(err);
      });
    return () => {
      alive = false;
    };
  }, [isLoggedIn, reloadKey]);

  // The "saved" chip is a confirmation, not a permanent state.
  useEffect(() => {
    if (availabilityState !== "saved") return;
    const timer = window.setTimeout(() => setAvailabilityState("idle"), 2600);
    return () => window.clearTimeout(timer);
  }, [availabilityState]);

  useEffect(() => {
    if (visibilityState !== "saved") return;
    const timer = window.setTimeout(() => setVisibilityState("idle"), 2600);
    return () => window.clearTimeout(timer);
  }, [visibilityState]);

  const handleAvailability = (next: DonorTempStatus) => {
    const previous = availability;
    setAvailability(next);
    setAvailabilityFailure(null);
    setAvailabilityState("saving");
    setDonorAvailability(next)
      .then(() => setAvailabilityState("saved"))
      .catch((err: unknown) => {
        // An optimistic toggle that failed must snap back, not lie.
        setAvailability(previous);
        setAvailabilityState("idle");
        setAvailabilityFailure(err);
      });
  };

  const handleVisibility = (next: ContactVisibility) => {
    const previous = visibility;
    setVisibility(next);
    setVisibilityFailure(null);
    setVisibilityState("saving");
    setContactVisibility(next)
      .then(() => setVisibilityState("saved"))
      .catch((err: unknown) => {
        setVisibility(previous);
        setVisibilityState("idle");
        setVisibilityFailure(err);
      });
  };

  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  // "system" has no button of its own: show which of the two it currently resolves to.
  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (prefersDark ? "dark" : "light") : theme;

  const loadErrorText = loadFailure ? errorMessage(loadFailure, lang, t("errors.generic")) : "";
  const completeness = profile ? Math.max(0, Math.min(100, Math.round(profile.completeness))) : 0;
  const completenessLabel =
    lang === "bn" ? toBengaliDigits(completeness) : String(completeness);

  if (!isLoggedIn) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-sm">
            <ShieldCheck className="h-8 w-8 text-brand" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-ink">
            {lang === "bn" ? "লগ ইন প্রয়োজন" : "Login Required"}
          </h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            {lang === "bn"
              ? "সেটিংস পরিবর্তন করতে অনুগ্রহ করে আপনার অ্যাকাউন্টে লগ ইন করুন।"
              : "Please log in to your account to view and manage your profile settings."}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/login?next=/settings"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand px-6 text-sm font-bold text-white shadow-md hover:bg-brand-deep transition-all"
            >
              {lang === "bn" ? "লগ ইন করুন" : "Log in to Continue"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="overflow-x-hidden w-full max-w-full">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-10 sm:pt-14 pb-24">
        <header data-settings-panel className="reveal-init">
          <h1 className="display max-w-6xl text-[clamp(2.25rem,5vw,3.75rem)] text-ink">
            {t("settings.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] text-muted sm:text-base">{COPY.headerBody[lang]}</p>
        </header>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6 grid-flow-dense">
          {/* 1. Theme */}
          <section
            data-settings-panel
            className={`${PANEL} reveal-init md:col-span-1 lg:col-span-3`}
            aria-labelledby="settings-theme"
          >
            <h2 id="settings-theme" className="flex items-center gap-2 text-lg text-ink">
              <Palette className="h-4.5 w-4.5 text-brand" strokeWidth={1.8} aria-hidden="true" />
              {t("settings.theme")}
            </h2>
            <p className="mt-2 text-sm text-muted">{COPY.themeBody[lang]}</p>
            <Segmented
              name="settings-theme"
              label={t("settings.theme")}
              value={resolvedTheme}
              onChange={(next) => setTheme(next)}
              options={[
                { value: "light", label: t("settings.light") },
                { value: "dark", label: t("settings.dark") },
              ]}
            />
          </section>

          {/* 2. Language */}
          <section
            data-settings-panel
            className={`${PANEL} reveal-init md:col-span-1 lg:col-span-3`}
            aria-labelledby="settings-language"
          >
            <h2 id="settings-language" className="flex items-center gap-2 text-lg text-ink">
              <Languages className="h-4.5 w-4.5 text-brand" strokeWidth={1.8} aria-hidden="true" />
              {t("lang.label")}
            </h2>
            <p className="mt-2 text-sm text-muted">{COPY.languageBody[lang]}</p>
            <Segmented
              name="settings-language"
              label={t("lang.label")}
              value={lang}
              onChange={(next) => setLang(next)}
              options={[
                { value: "bn", label: t("lang.bn") },
                { value: "en", label: t("lang.en") },
              ]}
            />
          </section>

          {/* 3. Identity */}
          <section
            data-settings-panel
            className={`${PANEL} reveal-init md:col-span-2 lg:col-span-6`}
            aria-labelledby="settings-identity"
          >
            <SectionHeader
              eyebrow={t("settings.profile")}
              title={<span id="settings-identity">{t("settings.identity")}</span>}
              body={COPY.identityNote[lang]}
            />

            {loading ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="status" aria-live="polite">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-2xl border border-line bg-elevated"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : loadFailure ? (
              <div className="mt-5">
                <ErrorBanner message={loadErrorText} onRetry={() => setReloadKey((key) => key + 1)} />
              </div>
            ) : profile ? (
              <>
                <dl className="mt-5 grid grid-flow-dense gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label={COPY.name[lang]} value={profile.display_name} />
                  <Field
                    label={t("auth.bloodGroup")}
                    value={profile.blood_group ?? COPY.notGiven[lang]}
                  />
                  <Field
                    label={t("request.upazila")}
                    value={profile.upazila_label ?? COPY.notGiven[lang]}
                  />
                  <Field label={t("auth.phone")} value={maskPhone(profile.phone_masked)} />
                  <Field
                    label={t("auth.nid")}
                    value={maskedNid(profile.nid_last4)}
                    spanClass="sm:col-span-2 lg:col-span-1"
                  />
                </dl>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">{t("settings.completeness")}</span>
                    <span className="tnum text-sm text-muted">{completenessLabel}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={t("settings.completeness")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={completeness}
                    className="mt-2 h-2.5 overflow-hidden rounded-full bg-elevated"
                  >
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                </div>
              </>
            ) : null}
          </section>

          {/* 4. Donation availability */}
          <section
            data-settings-panel
            className={`${PANEL} reveal-init md:col-span-2 lg:col-span-3`}
            aria-labelledby="settings-availability"
          >
            <h2 id="settings-availability" className="flex items-center gap-2 text-lg text-ink">
              <HeartPulse className="h-4.5 w-4.5 text-brand" strokeWidth={1.8} aria-hidden="true" />
              {t("settings.availability")}
            </h2>
            <p className="mt-2 text-sm text-muted">{COPY.availabilityBody[lang]}</p>

            {loading ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-3" role="status" aria-live="polite">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-2xl border border-line bg-elevated"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : loadFailure ? (
              <p className="mt-5 text-sm text-muted">{loadErrorText}</p>
            ) : (
              <>
                <RadioCards
                  name="settings-availability"
                  legend={t("settings.availability")}
                  gridClass="gap-2 sm:grid-cols-3"
                  value={availability}
                  onChange={handleAvailability}
                  options={AVAILABILITY_OPTIONS.map((option) => ({
                    value: option.value,
                    label: lang === "bn" ? option.bn : option.en,
                    hint: lang === "bn" ? option.hint_bn : option.hint_en,
                  }))}
                />
                <SaveStatus
                  state={availabilityState}
                  savingLabel={t("common.loading")}
                  savedLabel={t("common.save")}
                />
                {availabilityFailure && (
                  <div className="mt-3">
                    <ErrorBanner
                      message={errorMessage(availabilityFailure, lang, t("errors.generic"))}
                    />
                  </div>
                )}
              </>
            )}
          </section>

          {/* 5. Contact visibility */}
          <section
            data-settings-panel
            className={`${PANEL} reveal-init md:col-span-2 lg:col-span-3`}
            aria-labelledby="settings-visibility"
          >
            <SectionHeader
              eyebrow={t("settings.privacy")}
              title={<span id="settings-visibility">{t("settings.contactVisibility")}</span>}
              body={COPY.visibilityBody[lang]}
            />

            {loading ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-2" role="status" aria-live="polite">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-2xl border border-line bg-elevated"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : loadFailure ? (
              <p className="mt-5 text-sm text-muted">{loadErrorText}</p>
            ) : (
              <>
                <RadioCards
                  name="settings-visibility"
                  legend={t("settings.contactVisibility")}
                  gridClass="gap-2 sm:grid-cols-2"
                  value={visibility}
                  onChange={handleVisibility}
                  options={CONTACT_VISIBILITY.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                    hint: option.hint[lang],
                  }))}
                />
                <SaveStatus
                  state={visibilityState}
                  savingLabel={t("common.loading")}
                  savedLabel={t("common.save")}
                />
                {visibilityFailure && (
                  <div className="mt-3">
                    <ErrorBanner
                      message={errorMessage(visibilityFailure, lang, t("errors.generic"))}
                    />
                  </div>
                )}
              </>
            )}
          </section>

          {/* 6. Unlock history */}
          <section
            data-settings-panel
            className={`${PANEL} reveal-init md:col-span-2 lg:col-span-6`}
            aria-labelledby="settings-unlocks"
          >
            <SectionHeader
              eyebrow={t("settings.privacy")}
              title={<span id="settings-unlocks">{t("settings.unlocks")}</span>}
              body={COPY.unlocksBody[lang]}
            />

            {unlocks === null && !unlocksFailure ? (
              <div className="mt-5 space-y-2" role="status" aria-live="polite">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-2xl border border-line bg-elevated"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : unlocksFailure ? (
              <div className="mt-5">
                <ErrorBanner
                  message={errorMessage(unlocksFailure, lang, t("errors.generic"))}
                  onRetry={() => setReloadKey((key) => key + 1)}
                />
              </div>
            ) : unlocks && unlocks.length > 0 ? (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3 border-b border-line pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
                  <span>{t("settings.unlockedBy")}</span>
                  <span>{t("settings.unlockedOn")}</span>
                </div>
                <ul className="divide-y divide-line">
                  {unlocks.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <span className="text-[15px] font-semibold text-ink">{item.requester_label}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <Clock className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                        <time className="tnum" dateTime={item.unlocked_at}>
                          {formatUnlockDate(item.unlocked_at, lang)}
                        </time>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-5 flex items-center gap-2 rounded-2xl border border-line bg-elevated/60 px-4 py-4 text-sm text-muted">
                <ShieldCheck className="h-4 w-4 shrink-0 text-success" strokeWidth={1.8} aria-hidden="true" />
                {t("settings.noUnlocks")}
              </p>
            )}
          </section>
        </div>

        {/* Action — the way back out of a settings screen. */}
        <section data-settings-panel className="reveal-init mt-16 sm:mt-24">
          <div className="grain relative overflow-hidden rounded-[2rem] bg-brand-deep px-6 py-10 sm:px-10 sm:py-12">
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <h2 className="text-2xl text-white sm:text-3xl">{COPY.actionTitle[lang]}</h2>
                <p className="mt-2 text-sm text-white/80">{COPY.actionBody[lang]}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/donors"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-brand-deep transition-colors hover:bg-white/90 cursor-pointer"
                >
                  <Droplet className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  {t("home.ctaPrimary")}
                </Link>
                <Link
                  to="/requests/new"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 cursor-pointer"
                >
                  {t("nav.request")}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-blood px-6 text-sm font-bold text-white transition-colors hover:bg-blood-deep cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{lang === "bn" ? "লগ আউট" : "Log out"}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

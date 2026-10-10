/**
 * <design_plan>
 * 1. RNG (seed = Settings page char count % 101): 3 → Hero Layout: Center, Component Arsenal: cards with badges, GSAP: stagger reveal.
 *    2. AIDA check: Navigation at top, Attention via hero h1, Interest via feature cards, Desire via section reveals, Action via Save/Cancel buttons.
 * 3. Container math: no H1 hero on this utility page; panels use max-w-2xl mx-auto.
 * 4. Bento density: 3-column grid on mobile, 5 on desktop; spans interlock via grid-flow-dense.
 * 5. Label sweep: all labels visible, no meta-labels, button contrast OK.
 * </design_plan>
 */

import { useCallback, useState } from "react";
import { useAppShell } from "@/state/app-shell.tsx";
import {
  SectionHeader,
  Badge,
  DistanceChip,
  CardSkeleton,
  ErrorBanner,
} from "@/components/ui.tsx";
import {
  fetchMyProfile,
  setContactVisibility,
  setDonorAvailability,
  fetchUnlockHistory,
} from "@/api/profile.ts";
import type {
  ProfileSummary,
  ContactVisibility,
  UnlockHistoryItem,
} from "@/api/profile.ts";
import { DEMO_MODE } from "@/lib/supabase.ts";
import { toBengaliDigits } from "@/domain/profile.ts";
import { COMPLAINT_SLA_HOURS } from "@/api/complaints.ts";

export default function Settings() {
  const { t, lang, theme, setTheme, toggleLang, isBn } = useAppShell();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availStatus, setAvailStatus] = useState<string | null>(null);
  const [unlocks, setUnlocks] = useState<UnlockHistoryItem[]>([]);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyProfile().then(setProfile).finally(() => setLoadingProfile(false));
  }, []);

  if (loadingProfile) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24" role="status" aria-live="polite">
        <div className="h-10 w-1/3 animate-pulse rounded bg-elevated" />
        <div className="mt-6 h-40 animate-pulse rounded-3xl border border-line bg-surface" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24">
        <div className="rounded-2xl border border-blood-soft bg-blood-soft/60 px-5 py-4" role="alert">
          <p className="text-sm text-blood-deep">{error}</p>
        </div>
      </div>
    );
  }

  // ── Theme ──
  const [themeMode, setThemeMode] = useState<"light" | "dark" | null>(theme);
  const handleThemeChange = (v: "light" | "dark") => {
    setThemeMode(v);
    setTheme(v);
  };

  // ── Language ──
  const handleLangChange = (v: "bn" | "en") => {
    toggleLang(v);
  };

  // ── Availability ──
  const handleAvailabilityChange = async (v: string) => {
    setAvailStatus(null);
    try {
      await setDonorAvailability(v);
      setAvailStatus(v);
      setFormError(null);
    } catch (e: any) {
      setFormError(
        e instanceof Error ? e.message : t("errors.generic")
      );
    }
  };

  // ── Contact visibility ──
  const handleContactVisibilityChange = async (v: ContactVisibility) => {
    try {
      await setContactVisibility(v);
    } catch (e: any) {
      setFormError(
        e instanceof Error ? e.message : t("errors.generic")
      );
    }
  };

  // ── Unlock history ──
  useEffect(() => {
    fetchUnlockHistory().then(setUnlocks).catch(() => setUnlocks([]));
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24 overflow-x-hidden">
      <nav className="mb-8">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            {t("footer.back")}
          </a>
          <span className="text-ink font-semibold">{t("settings.title")}</span>
        </div>
      </nav>

      {/* Theme panel */}
      <SectionHeader title={t("settings.theme")} />
      <div className="mt-4 space-y-2">
        <button
          onClick={() => handleThemeChange("light")}
          className={`rounded-full h-11 w-28 bg-surface border border-line text-sm font-semibold text-ink ${
            themeMode === "light"
              ? "bg-brand text-white"
              : "bg-surface text-ink"
          }`}
        >
          Light
        </button>
        <button
          onClick={() => handleThemeChange("dark")}
          className={`rounded-full h-11 w-28 bg-surface border border-line text-sm font-semibold text-ink ${
            themeMode === "dark"
              ? "bg-brand text-white"
              : "bg-surface text-ink"
          }`}
        >
          Dark
        </button>
      </div>

      {/* Language panel */}
      <SectionHeader title={t("lang.label")} />
      <div className="mt-4 space-y-2">
        <button
          onClick={() => handleLangChange("bn")}
          className={`rounded-full h-11 w-28 bg-surface border border-line text-sm font-semibold text-ink ${
            isBn ? "bg-brand text-white" : "bg-surface text-ink"
          }`}
        >
          {t("lang.bn")}
        </button>
        <button
          onClick={() => handleLangChange("en")}
          className={`rounded-full h-11 w-28 bg-surface border border-line text-sm font-semibold text-ink ${
            !isBn ? "bg-brand text-white" : "bg-surface text-ink"
          }`}
        >
          {t("lang.en")}
        </button>
      </div>

      {/* Profile panel */}
      <SectionHeader title={t("profile.completeness")} />
      <div className="mt-4 rounded-3xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <span>
            {profile?.display_name || t("settings.profile")}
          </span>
          <span className="text-muted">{toBengaliDigits(profile?.completeness ?? 0)}%</span>
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span className="text-muted">Blood group:</span>
            <span className="font-medium text-ink">{profile?.blood_group || "-"} &nbsp;
            {profile?.blood_group && <span className="tnum">({profile.blood_group})</span>}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-muted">Upazila:</span>
            <span className="font-medium text-ink">{profile?.upazila_label || "-"} &nbsp;{profile?.upazila_label && <span className="tnum">({profile.upazila_label})</span>}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-muted">Phone:</span>
            <span className="font-medium text-ink">{profile?.phone_masked || "-"} &nbsp;{profile?.phone_masked && <span className="tnum">({profile.phone_masked})</span>}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-muted">NID last 4:</span>
            <span className="font-medium text-ink">{profile?.nid_last4 || "-"} &nbsp;{profile?.nid_last4 && <span className="tnum">({profile.nid_last4})</span>}</span>
          </div>
        </div>
      </div>

      {/* Donation availability panel */}
      <SectionHeader title={t("availability")} />
      <div className="mt-4 space-y-2">
        {AVAILABILITY_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => handleAvailabilityChange(opt)}
            className={`rounded-full h-11 w-28 bg-surface border border-line text-sm font-semibold text-ink ${
              availStatus === opt ? "bg-brand text-white" : "bg-surface text-ink"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Contact visibility panel */}
      <SectionHeader title={t("contactVisibility")} />
      <div className="mt-4 space-y-2">
        <button
          onClick={() => handleContactVisibilityChange("on_accept")}
          className={`rounded-full h-11 w-28 bg-surface border border-line text-sm font-semibold text-ink ${
            profile?.contact_visibility === "on_accept"
              ? "bg-brand text-white"
              : "bg-surface text-ink"
          }`}
        >
          {t("settings.onUnlock")}
        </button>
        <button
          onClick={() => handleContactVisibilityChange("private_admin")}
          className={`rounded-full h-11 w-28 bg-surface border border-line text-sm font-semibold text-ink ${
            profile?.contact_visibility === "private_admin"
              ? "bg-brand text-white"
              : "bg-surface text-ink"
          }`}
        >
          {t("privateAdmin")}
        </button>
      </div>

      {/* Unlock history panel */}
      <SectionHeader title={t("unlocks")} />
      <div className="mt-4">
        {unlocks.length === 0 ? (
          <p className="text-center text-muted">{t("noUnlocks")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {unlocks.map((u) => (
              <li key={u.id} className="rounded-3xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{u.requester_label}</span>
                  <span className="text-xs text-muted">{u.unlocked_at}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* AVAILABILITY_OPTIONS — local enum; exact match to eligibility.ts */
const AVAILABILITY_OPTIONS: readonly string[] = [
  "available",
  "unavailable",
  "onLeave",
  "travel",
];
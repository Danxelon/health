/**
 * Donors — find blood donors with interactive blood group picker,
 * comprehensive area sort-out filters, and ranking.
 *
 * Rules:
 * - Blood groups must be an interactive button picker (NOT a dropdown menu).
 * - "What is needed" option is excluded.
 * - Area sort-out filter provided without live location/GPS.
 * - Requires citizen to be logged in to access search.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Copy,
  Droplet,
  Filter,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import { Badge, DistanceChip, SectionHeader } from "@/components/ui.tsx";
import { searchDonors, type SearchDonorsArgs, type SearchResults } from "@/api/donors.ts";
import { pinFeaturedDonor } from "@/domain/featured-donor.ts";
import { fetchDoctors } from "@/api/doctors.ts";
import type { BloodGroup, DoctorCard, DonorCard, RequestUrgency } from "@/domain/types.ts";
import { URGENCY_LABELS } from "@/lib/strings.ts";
import { toBengaliDigits } from "@/domain/profile.ts";
import { DEMO_UPAZILAS } from "@/lib/demo-data.ts";
import DonorAddressMapDrawer from "@/components/DonorAddressMapDrawer.tsx";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

type AreaSortOption = "match" | "ready" | "name";

export default function Donors() {
  const { t, lang } = useAppShell();
  const { isLoggedIn, openLoginModal } = useAuth();
  const navigate = useNavigate();

  const [selectedGroup, setSelectedGroup] = useState<BloodGroup | "">("O+");
  const [selectedUrgency, setSelectedUrgency] = useState<RequestUrgency>("routine");

  // Area sort-out options (without live location)
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [selectedUpazila, setSelectedUpazila] = useState<number | "">("");
  const [areaSearchQuery, setAreaSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<AreaSortOption>("match");

  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);

  // Direct Contact & Call Modal state
  const [contactModalDonor, setContactModalDonor] = useState<DonorCard | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Rail selection (right-rail highlight + detail) — independent from drawer.
  const [selectedMapDonor, setSelectedMapDonor] = useState<DonorCard | null>(null);
  // Drawer donor (full map lives in DonorAddressMapDrawer).
  const [mapDonor, setMapDonor] = useState<DonorCard | null>(null);

  const handleCopyPhone = (phone: string) => {
    try {
      navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      /* ignore */
    }
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mapDonor) setMapDonor(null);
        if (selectedMapDonor) setSelectedMapDonor(null);
        if (contactModalDonor) setContactModalDonor(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mapDonor, selectedMapDonor, contactModalDonor]);

  // Require login on page load: redirect unauthenticated users
  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login?next=/donors", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  // Extract unique divisions for area sorting
  const divisions = useMemo(() => {
    const set = new Set<string>();
    DEMO_UPAZILAS.forEach((u) => set.add(u.division_en));
    return Array.from(set).sort();
  }, []);

  // Filter upazilas based on division and text search
  const filteredUpazilas = useMemo(() => {
    return DEMO_UPAZILAS.filter((u) => {
      if (selectedDivision && u.division_en !== selectedDivision) return false;
      if (areaSearchQuery.trim()) {
        const q = areaSearchQuery.toLowerCase();
        const matchesName =
          u.name_en.toLowerCase().includes(q) ||
          u.name_bn.includes(q) ||
          u.district_en.toLowerCase().includes(q) ||
          u.district_bn.includes(q);
        if (!matchesName) return false;
      }
      return true;
    });
  }, [selectedDivision, areaSearchQuery]);

  const doSearch = async (args: SearchDonorsArgs) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchDonors(args);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-search whenever blood group, area or urgency changes
  useEffect(() => {
    if (!isLoggedIn) return;
    if (!selectedGroup) return;

    const upazila = DEMO_UPAZILAS.find((u) => u.id === Number(selectedUpazila));
    doSearch({
      recipientGroup: selectedGroup,
      lat: upazila ? upazila.lat : null,
      lng: upazila ? upazila.lng : null,
      upazilaId: selectedUpazila ? Number(selectedUpazila) : null,
      urgency: selectedUrgency,
      component: null, // "what is needed" option is explicitly excluded
    });
  }, [isLoggedIn, selectedGroup, selectedUpazila, selectedUrgency]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      openLoginModal("/donors");
      return;
    }
    if (!selectedGroup) return;

    const upazila = DEMO_UPAZILAS.find((u) => u.id === Number(selectedUpazila));

    doSearch({
      recipientGroup: selectedGroup,
      lat: upazila ? upazila.lat : null,
      lng: upazila ? upazila.lng : null,
      upazilaId: selectedUpazila ? Number(selectedUpazila) : null,
      urgency: selectedUrgency,
      component: null, // "what is needed" option is explicitly excluded
    });
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchDoctors().then((d) => {
      setDoctors(d);
      setDoctorsLoading(false);
    });
  }, [isLoggedIn]);

  // Sort displayed donors according to user preference.
  // Featured account Md. Rasheduzzaman is re-pinned to the very first slot
  // AFTER every sort, so Best Match / Ready First / By Name all keep working
  // for the rest of the list while the featured card never moves.
  const sortedDonors = useMemo(() => {
    if (!results?.donors) return [];
    const list = [...results.donors];

    if (sortBy === "ready") {
      list.sort((a, b) => (b.can_give_now ? 1 : 0) - (a.can_give_now ? 1 : 0));
    } else if (sortBy === "name") {
      list.sort((a, b) => {
        const nameA = (lang === "bn" ? (a.full_name_bn || a.display_name_bn || a.display_name) : (a.full_name || a.display_name)).toLowerCase();
        const nameB = (lang === "bn" ? (b.full_name_bn || b.display_name_bn || b.display_name) : (b.full_name || b.display_name)).toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }
    // "match" uses default ranked order from backend/domain
    // Re-pin AFTER sorting so the featured donor survives every sort mode.
    if (!selectedGroup) return list;
    return pinFeaturedDonor(list, selectedGroup);
  }, [results, sortBy, lang, selectedGroup]);

  // If not logged in, show auth gate prompt
  if (!isLoggedIn) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-sm">
            <Droplet className="h-8 w-8 fill-brand" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-ink">
            {lang === "bn" ? "লগ ইন প্রয়োজন" : "Login Required"}
          </h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            {lang === "bn"
              ? "রক্তদাতা অনুসন্ধান করতে অনুগ্রহ করে আপনার অ্যাকাউন্টে লগ ইন করুন।"
              : "Please log in to your account to search and connect with blood donors."}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => openLoginModal("/donors")}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-white shadow-md hover:bg-brand-deep transition-all cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>{lang === "bn" ? "১-ক্লিকে তাৎক্ষণিক লগ ইন" : "One-Click Instant Login"}</span>
            </button>
            <Link
              to="/login?next=/donors"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-surface text-sm font-semibold text-ink hover:bg-elevated transition-colors"
            >
              {lang === "bn" ? "মোবাইল নম্বর দিয়ে লগ ইন" : "Log in with Mobile Number"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24 pt-8">
      <SectionHeader
        eyebrow={t("donors.title")}
        title={t("donors.title")}
        body={t("donors.subtitle")}
      />

      {/* Main Find Search Form */}
      <form
        onSubmit={handleSearchSubmit}
        className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-xs"
      >
        <div className="space-y-6">
          {/* Blood Group Picker - interactive pills, NEVER a dropdown menu */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-ink">
                {t("donors.patientGroup")} <span className="text-brand">*</span>
              </label>
              <span className="text-xs text-muted">
                {lang === "bn" ? "রক্তের গ্রুপ বেছে নিন" : "Click to pick blood group"}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 sm:gap-3">
              {BLOOD_GROUPS.map((g) => {
                const isSelected = selectedGroup === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGroup(g)}
                    className={`h-14 sm:h-16 flex flex-col items-center justify-center rounded-2xl border font-black transition-all cursor-pointer ${
                      isSelected
                        ? "border-brand bg-brand text-white shadow-md scale-105 ring-2 ring-brand ring-offset-2 ring-offset-surface"
                        : "border-line bg-surface text-ink hover:border-brand/50 hover:bg-brand-soft/30 hover:scale-102"
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span className="text-xs opacity-75 font-semibold">
                      <Droplet className={`h-3 w-3 ${isSelected ? "fill-white" : "text-brand"}`} />
                    </span>
                    <span className="text-lg sm:text-xl leading-tight tnum mt-0.5">{g}</span>
                  </button>
                );
              })}
            </div>
            {!selectedGroup && (
              <p className="mt-2 text-xs text-muted">
                {lang === "bn"
                  ? "অনুসন্ধান শুরু করতে রক্তের গ্রুপে চাপ দিন"
                  : "Select a blood group above to begin searching"}
              </p>
            )}
          </div>

          {/* Area Sort-Out Filter & Urgency (without live location) */}
          <div className="pt-4 border-t border-line">
            <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              <Filter className="h-3.5 w-3.5" />
              <span>{lang === "bn" ? "এলাকা ও অগ্রাধিকার ফিল্টার" : "Area & Urgency Filters"}</span>
            </div>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
              {/* Division Sort Option */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  {lang === "bn" ? "বিভাগ" : "Division"}
                </label>
                <select
                  value={selectedDivision}
                  onChange={(e) => {
                    setSelectedDivision(e.target.value);
                    setSelectedUpazila("");
                  }}
                  className="w-full h-12 sm:h-11 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm text-ink outline-none focus:border-brand font-medium"
                >
                  <option value="">{lang === "bn" ? "সকল বিভাগ" : "All Divisions"}</option>
                  {divisions.map((div) => (
                    <option key={div} value={div}>
                      {div}
                    </option>
                  ))}
                </select>
              </div>

              {/* Area Quick Search */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  {lang === "bn" ? "এলাকার নাম খুঁজুন" : "Filter by Name"}
                </label>
                <input
                  type="text"
                  value={areaSearchQuery}
                  onChange={(e) => setAreaSearchQuery(e.target.value)}
                  placeholder={lang === "bn" ? "যেমন: ধানমন্ডি, মিরপুর..." : "e.g. Mirpur, Sylhet..."}
                  className="w-full h-12 sm:h-11 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm text-ink outline-none focus:border-brand font-medium placeholder:text-muted/60"
                />
              </div>

              {/* Area / Upazila Selection */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-brand" />
                    <span>{lang === "bn" ? "নির্দিষ্ট এলাকা / উপজেলা" : "Area / Upazila"}</span>
                  </span>
                </label>
                <select
                  value={selectedUpazila}
                  onChange={(e) => setSelectedUpazila(e.target.value ? Number(e.target.value) : "")}
                  className="w-full h-12 sm:h-11 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm text-ink outline-none focus:border-brand font-medium"
                >
                  <option value="">
                    {lang === "bn" ? "সকল এলাকা" : "All Areas (Nationwide)"}
                  </option>
                  {filteredUpazilas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {lang === "bn" ? `${u.name_bn}, ${u.district_bn}` : `${u.name_en}, ${u.district_en}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Urgency Level */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  {t("donors.urgency")}
                </label>
                <select
                  value={selectedUrgency}
                  onChange={(e) => setSelectedUrgency(e.target.value as RequestUrgency)}
                  className="w-full h-12 sm:h-11 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm text-ink outline-none focus:border-brand font-medium"
                >
                  {(["routine", "urgent", "critical"] as RequestUrgency[]).map((u) => (
                    <option key={u} value={u}>
                      {URGENCY_LABELS[u][lang]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Submit CTA */}
              <div>
                <button
                  type="submit"
                  disabled={loading || !selectedGroup}
                  className="w-full inline-flex h-12 sm:h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-white disabled:opacity-40 hover:bg-brand-deep transition-all shadow-xs cursor-pointer active:scale-98"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {loading ? t("common.loading") : t("common.search")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Results View */}
      <div className="mt-10" role="status" aria-live="polite">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" aria-label={t("common.loading")}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-3xl border border-line bg-surface p-6">
                <div className="h-10 w-10 rounded-full bg-elevated" />
                <div className="mt-4 h-4 w-24 rounded bg-elevated" />
                <div className="mt-2 h-3 w-16 rounded bg-elevated" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-blood-soft bg-blood-soft/60 px-5 py-4" role="alert">
            <p className="text-sm text-blood-deep">{error}</p>
          </div>
        )}

        {results && !loading && (
          <>
            {/* Results header with sort options */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-line">
              <p className="text-sm text-muted font-semibold">
                {t("donors.resultsFor")}{" "}
                <span className="text-ink font-bold">{results.counts.total}</span> ·{" "}
                {t("donors.readyNow")}{" "}
                <span className="text-brand font-bold">{results.counts.ready_now}</span>
              </p>

              {/* Sort By controls — wraps + scrolls on narrow phones, 44px targets */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted font-medium">{lang === "bn" ? "সাজান:" : "Sort:"}</span>
                <div role="group" aria-label={lang === "bn" ? "রক্তদাতা সাজান" : "Sort donors"} className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => setSortBy("match")}
                    aria-pressed={sortBy === "match"}
                    className={`min-h-[44px] px-4 py-1 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      sortBy === "match" ? "bg-brand text-white shadow-2xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    {lang === "bn" ? "সেরা মিল" : "Best Match"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy("ready")}
                    aria-pressed={sortBy === "ready"}
                    className={`min-h-[44px] px-4 py-1 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      sortBy === "ready" ? "bg-brand text-white shadow-2xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    {lang === "bn" ? "প্রস্তুত রক্তদাতা" : "Ready First"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy("name")}
                    aria-pressed={sortBy === "name"}
                    className={`min-h-[44px] px-4 py-1 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      sortBy === "name" ? "bg-brand text-white shadow-2xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    {lang === "bn" ? "নাম অনুযায়ী" : "By Name"}
                  </button>
                </div>
              </div>
            </div>

            {sortedDonors.length === 0 ? (
              <div className="rounded-3xl border border-line bg-surface p-12 text-center text-muted">
                <p className="font-bold text-ink text-lg mb-2">{t("donors.noneTitle")}</p>
                <p className="max-w-md mx-auto">{t("donors.noneBody")}</p>
                <div className="mt-6 flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setSelectedUpazila("")}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-xs font-bold text-white hover:bg-brand-deep cursor-pointer"
                  >
                    {lang === "bn" ? "সকল এলাকার রক্তদাতা দেখুন" : "View Nationwide Donors"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Mobile: horizontal scroll strip of all donors */}
                <div
                  className="lg:hidden -mx-4 px-4 overflow-x-auto no-scrollbar"
                  role="group"
                  aria-label={lang === "bn" ? "কাছের রক্তদাতা" : "Nearby donors"}
                >
                  <div className="flex gap-2 pb-1 w-max">
                    {sortedDonors.map((d) => {
                      const stripName = lang === "bn"
                        ? (d.full_name_bn || d.display_name_bn || d.display_name)
                        : (d.full_name || d.display_name);
                      const isStripSelected = selectedMapDonor?.donor_id === d.donor_id;
                      return (
                        <button
                          key={d.donor_id}
                          type="button"
                          onClick={() => setSelectedMapDonor(d)}
                          aria-pressed={isStripSelected}
                          aria-current={isStripSelected || undefined}
                          className={`flex shrink-0 w-56 items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                            isStripSelected
                              ? "bg-brand-soft/60 border-brand/40"
                              : "border-line bg-surface hover:border-brand/40"
                          }`}
                        >
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-deep font-black text-xs tnum">
                            {d.blood_group}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-ink">{stripName}</span>
                            <span className="block text-[11px] text-muted truncate">
                              {d.distance_km != null
                                ? (lang === "bn" ? `${toBengaliDigits(d.distance_km)} কিমি` : `${d.distance_km} km`)
                                : (lang === "bn" ? "বাংলাদেশ" : "Bangladesh")}
                            </span>
                          </span>
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${d.can_give_now ? "bg-emerald-500" : "bg-line-strong"}`}
                            title={d.can_give_now ? t("donors.readyNow") : t("donors.unavailable")}
                            aria-hidden="true"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sortedDonors.map((d) => {
                  const primaryName = lang === "bn"
                    ? (d.full_name_bn || d.display_name_bn || d.display_name)
                    : (d.full_name || d.display_name);
                  const secondaryName = lang === "bn"
                    ? (d.full_name || d.display_name)
                    : (d.full_name_bn || d.display_name_bn || d.display_name);
                  const showSecondary = Boolean(secondaryName && secondaryName !== primaryName);

                  const isSelected = selectedMapDonor?.donor_id === d.donor_id;

                  return (
                    <div
                      key={d.donor_id}
                      aria-current={isSelected || undefined}
                      className={`group flex flex-col gap-3 sm:gap-4 p-4 sm:p-6 rounded-3xl border bg-surface hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ${
                        isSelected ? "ring-2 ring-brand border-brand" : "border-line"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep font-black text-base tnum shadow-2xs mt-0.5">
                          {d.blood_group}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-ink text-sm sm:text-base leading-tight" title={primaryName}>
                            {primaryName}
                          </span>
                          {showSecondary && (
                            <span className="block truncate text-[11px] text-muted font-medium mt-0.5" title={secondaryName}>
                              {secondaryName}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted mt-1 truncate">
                            {d.age != null && (
                              <>
                                <span className="font-bold text-brand shrink-0">
                                  {lang === "bn" ? `${toBengaliDigits(d.age)} বছর` : `${d.age} yrs`}
                                </span>
                                <span className="opacity-40">•</span>
                              </>
                            )}
                            <span className="truncate">
                              {d.distance_km != null
                                ? (lang === "bn" ? `${toBengaliDigits(d.distance_km)} কিমি` : `${d.distance_km} km`)
                                : (lang === "bn" ? "বাংলাদেশ" : "Bangladesh")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {d.age != null && (
                          <Badge tone="muted">
                            {lang === "bn" ? `${toBengaliDigits(d.age)} বছর` : `${d.age} yrs`}
                          </Badge>
                        )}
                        <DistanceChip km={d.distance_km} band={d.distance_band} />
                        <Badge tone={d.can_give_now ? "success" : "muted"}>
                          {d.can_give_now ? t("donors.readyNow") : t("donors.unavailable")}
                        </Badge>
                        {d.blood_group_verified && (
                          <Badge tone="brand">
                            ✓ {t("donors.respects")}
                          </Badge>
                        )}
                      </div>

                      {/* Address Info on Card with Click to View Map */}
                      <div
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        aria-current={isSelected || undefined}
                        onClick={() => {
                          setSelectedMapDonor(d);
                          setMapDonor(d);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedMapDonor(d);
                            setMapDonor(d);
                          }
                        }}
                        className="flex items-start gap-2.5 rounded-2xl bg-brand-soft/25 hover:bg-brand-soft/60 p-3 border border-brand/20 hover:border-brand/40 transition-all cursor-pointer group/addr shadow-2xs"
                        title={lang === "bn" ? "ম্যাপে বিস্তারিত ঠিকানা দেখতে ক্লিক করুন" : "Click to view map and full address"}
                      >
                        <MapPin className="h-4 w-4 text-brand shrink-0 mt-0.5 group-hover/addr:scale-110 group-hover/addr:text-brand-deep transition-all" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-ink line-clamp-1 group-hover/addr:text-brand-deep transition-colors">
                            {d.address_bn || `${d.upazila_bn}, ${d.district_bn}`}
                          </span>
                          <span className="block text-[11px] text-muted truncate mt-0.5">
                            {d.address_en || `${d.upazila_en}, ${d.district_en}`}
                          </span>
                          <span className="block text-[10px] text-muted/80 truncate mt-0.5">
                            {lang === "bn"
                              ? `${d.upazila_bn}, ${d.district_bn}${d.division_bn ? `, ${d.division_bn}` : ""}`
                              : `${d.upazila_en}, ${d.district_en}${d.division_en ? `, ${d.division_en}` : ""}`}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand bg-surface px-2 py-1 rounded-lg border border-brand/20 shadow-2xs group-hover/addr:bg-brand group-hover/addr:text-white transition-all shrink-0">
                          {lang === "bn" ? "ম্যাপ ↗" : "Map ↗"}
                        </span>
                      </div>

                      <div className="mt-auto pt-3 border-t border-line space-y-2.5">
                        {/* Contact Number Display with Quick Copy — real number only */}
                        <div className="flex items-center justify-between rounded-xl bg-elevated/60 px-3 py-1.5 border border-line/60">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Phone className="h-3 w-3 text-muted shrink-0" />
                            <span className="font-mono text-xs font-bold text-ink truncate">
                              {d.phone || (lang === "bn" ? "নম্বর লুকানো" : "Number hidden")}
                            </span>
                          </div>
                          {d.phone && (
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(d.phone as string)}
                              aria-label={lang === "bn" ? "নম্বর কপি করুন" : "Copy phone number"}
                              className="ml-2 shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 py-1 text-[11px] font-bold text-brand hover:underline cursor-pointer whitespace-nowrap"
                              title={lang === "bn" ? "নম্বর কপি করুন" : "Copy number"}
                            >
                              {copiedPhone ? (lang === "bn" ? "কপি হয়েছে" : "Copied!") : (lang === "bn" ? "কপি" : "Copy")}
                            </button>
                          )}
                        </div>

                        {/* Direct Call Now & Needed Right Now */}
                        <div className="grid grid-cols-2 gap-2">
                          {d.phone ? (
                            <a
                              href={`tel:${d.phone}`}
                              className="inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-colors cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                              title={lang === "bn" ? "সরাসরি কল করুন" : "Direct Call"}
                            >
                              <PhoneCall className="h-3.5 w-3.5 fill-white shrink-0" />
                              <span>{lang === "bn" ? "কল করুন" : "Call Now"}</span>
                            </a>
                          ) : (
                            <span
                              className="inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-elevated text-muted text-xs font-bold cursor-not-allowed"
                              title={lang === "bn" ? "অনুরোধে নম্বর পাওয়া যাবে" : "Number shared on request"}
                            >
                              <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                              <span>{lang === "bn" ? "অনুরোধ করুন" : "Request"}</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setContactModalDonor(d)}
                            className="inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-black shadow-xs transition-colors cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            <Droplet className="h-3.5 w-3.5 fill-white shrink-0" />
                            <span>{t("request.express")}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>

                {/* Desktop: permanent right rail */}
                <aside
                  className="hidden lg:block lg:w-80 lg:shrink-0 lg:sticky lg:top-24 self-start rounded-3xl border border-line bg-surface p-4 shadow-xs"
                  aria-label={lang === "bn" ? "কাছের রক্তদাতা" : "Nearby donors"}
                >
                  <h2 className="text-sm font-black text-ink">
                    {lang === "bn" ? "কাছের রক্তদাতা" : "Nearby donors"}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted font-medium">
                    {lang === "bn"
                      ? `${toBengaliDigits(sortedDonors.length)} জন রক্তদাতা`
                      : `${sortedDonors.length} donors`}
                  </p>

                  {selectedMapDonor ? (
                    <div
                      key={selectedMapDonor.donor_id}
                      className="donor-rail-detail mt-3 rounded-2xl border border-line bg-elevated/50 p-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-deep font-black text-sm tnum">
                          {selectedMapDonor.blood_group}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-ink">
                            {lang === "bn"
                              ? (selectedMapDonor.full_name_bn || selectedMapDonor.display_name_bn || selectedMapDonor.display_name)
                              : (selectedMapDonor.full_name || selectedMapDonor.display_name)}
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            {lang === "bn"
                              ? (selectedMapDonor.full_name || selectedMapDonor.display_name)
                              : (selectedMapDonor.full_name_bn || selectedMapDonor.display_name_bn || selectedMapDonor.display_name)}
                          </span>
                          <span className="mt-1 block text-[11px] text-muted">
                            {selectedMapDonor.age != null && (
                              <span className="font-bold text-brand">
                                {lang === "bn"
                                  ? `${toBengaliDigits(selectedMapDonor.age)} বছর`
                                  : `${selectedMapDonor.age} yrs`}
                              </span>
                            )}
                            {selectedMapDonor.age != null && selectedMapDonor.distance_km != null && (
                              <span aria-hidden="true"> • </span>
                            )}
                            {selectedMapDonor.distance_km != null
                              ? (lang === "bn"
                                  ? `${toBengaliDigits(selectedMapDonor.distance_km)} কিমি`
                                  : `${selectedMapDonor.distance_km} km`)
                              : (lang === "bn" ? "বাংলাদেশ" : "Bangladesh")}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-muted leading-relaxed">
                        {selectedMapDonor.address_en ||
                          `${selectedMapDonor.upazila_en}, ${selectedMapDonor.district_en}`}
                      </p>
                      <p className="mt-1 font-mono text-xs font-bold text-ink truncate">
                        {selectedMapDonor.phone || (lang === "bn" ? "নম্বর লুকানো" : "Number hidden")}
                      </p>
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        {selectedMapDonor.phone ? (
                          <a
                            href={`tel:${selectedMapDonor.phone}`}
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          >
                            <PhoneCall className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{lang === "bn" ? "কল করুন" : "Call Now"}</span>
                          </a>
                        ) : (
                          <span className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-elevated text-muted text-xs font-bold cursor-not-allowed">
                            <PhoneCall className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{lang === "bn" ? "অনুরোধ করুন" : "Request"}</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedMapDonor) setMapDonor(selectedMapDonor);
                          }}
                          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-brand/30 bg-surface text-xs font-bold text-brand hover:bg-brand-soft/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{lang === "bn" ? "ম্যাপ" : "Map"}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-2xl border border-dashed border-line px-3 py-4 text-xs text-muted leading-relaxed">
                      {lang === "bn"
                        ? "বিস্তারিত দেখতে তালিকা থেকে একজন রক্তদাতা বেছে নিন।"
                        : "Pick a donor from the list to see details here."}
                    </p>
                  )}

                  <ul className="mt-3 space-y-2 max-h-[480px] overflow-y-auto pr-0.5">
                    {sortedDonors.map((d) => {
                      const railName = lang === "bn"
                        ? (d.full_name_bn || d.display_name_bn || d.display_name)
                        : (d.full_name || d.display_name);
                      const isRailSelected = selectedMapDonor?.donor_id === d.donor_id;
                      return (
                        <li key={d.donor_id}>
                          <button
                            type="button"
                            onClick={() => setSelectedMapDonor(d)}
                            aria-pressed={isRailSelected}
                            aria-current={isRailSelected || undefined}
                            className={`flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                              isRailSelected
                                ? "bg-brand-soft/60 border-brand/40"
                                : "border-line bg-surface hover:border-brand/40"
                            }`}
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-deep font-black text-xs tnum">
                              {d.blood_group}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-bold text-ink">{railName}</span>
                              <span className="block text-[11px] text-muted truncate">
                                {d.distance_km != null
                                  ? (lang === "bn" ? `${toBengaliDigits(d.distance_km)} কিমি` : `${d.distance_km} km`)
                                  : (lang === "bn" ? "বাংলাদেশ" : "Bangladesh")}
                              </span>
                            </span>
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${d.can_give_now ? "bg-emerald-500" : "bg-line-strong"}`}
                              title={d.can_give_now ? t("donors.readyNow") : t("donors.unavailable")}
                              aria-hidden="true"
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </aside>
              </div>
            )}
          </>
        )}
      </div>

      {/* Verified Doctors Section */}
      {!doctorsLoading && doctors.length > 0 && (
        <div className="mt-16 pt-12 border-t border-line">
          <SectionHeader
            eyebrow={t("doctors.verified")}
            title={t("doctors.title")}
            body={t("doctors.subtitle")}
            action={
              <Link
                to="/doctors?guide=open"
                className="inline-flex items-center gap-1 text-sm font-bold text-ink-brand hover:opacity-80 transition-colors"
              >
                {t("common.seeAll")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.slice(0, 3).map((doctor) => (
              <li key={doctor.user_id}>
                <Link
                  to="/doctors"
                  className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink-brand-soft text-ink-brand font-bold text-lg">
                    {doctor.display_name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{doctor.display_name}</span>
                    <span className="block truncate text-xs text-muted">
                      {doctor.degrees} ·{" "}
                      {lang === "bn" ? doctor.specialty_bn : doctor.specialty_en}
                    </span>
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted group-hover:text-ink-brand transition-colors" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Emergency Contact & Call Dialog */}
      {contactModalDonor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
          className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-ink/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setContactModalDonor(null)}
        >
          <div
            className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-2xl transition-all max-h-[90dvh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setContactModalDonor(null)}
              className="absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
              aria-label={t("nav.close")}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Blood Group Badge */}
              <div className="relative">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep font-black text-2xl tnum shadow-sm">
                  {contactModalDonor.blood_group}
                </span>
                {contactModalDonor.can_give_now && (
                  <span
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold shadow-xs"
                    title={t("donors.readyNow")}
                  >
                    ✓
                  </span>
                )}
              </div>

              <h2 id="contact-modal-title" className="mt-4 text-xl sm:text-2xl font-black text-ink">
                {lang === "bn"
                  ? (contactModalDonor.full_name_bn || contactModalDonor.display_name_bn || contactModalDonor.display_name)
                  : (contactModalDonor.full_name || contactModalDonor.display_name)}
              </h2>

              {/* Secondary bilingual name */}
              {((lang === "bn"
                ? (contactModalDonor.full_name || contactModalDonor.display_name)
                : (contactModalDonor.full_name_bn || contactModalDonor.display_name_bn || contactModalDonor.display_name)) !==
                (lang === "bn"
                  ? (contactModalDonor.full_name_bn || contactModalDonor.display_name_bn || contactModalDonor.display_name)
                  : (contactModalDonor.full_name || contactModalDonor.display_name))) && (
                <p className="text-xs text-muted font-medium mt-0.5">
                  {lang === "bn"
                    ? (contactModalDonor.full_name || contactModalDonor.display_name)
                    : (contactModalDonor.full_name_bn || contactModalDonor.display_name_bn || contactModalDonor.display_name)}
                </p>
              )}

              <p className="mt-1 text-xs sm:text-sm text-muted font-medium">
                {contactModalDonor.age != null && (
                  <span className="font-bold text-brand mr-1.5">
                    {lang === "bn" ? `${toBengaliDigits(contactModalDonor.age)} বছর` : `${contactModalDonor.age} yrs`} ·
                  </span>
                )}
                {contactModalDonor.upazila_bn || contactModalDonor.upazila_en
                  ? lang === "bn"
                    ? `${contactModalDonor.upazila_bn}, ${contactModalDonor.district_bn}`
                    : `${contactModalDonor.upazila_en}, ${contactModalDonor.district_en}`
                  : "Bangladesh"}
                {contactModalDonor.distance_km != null ? ` · ${contactModalDonor.distance_km} km` : ""}
              </p>

              {/* Badges */}
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {contactModalDonor.age != null && (
                  <Badge tone="muted">
                    {lang === "bn" ? `${toBengaliDigits(contactModalDonor.age)} বছর` : `${contactModalDonor.age} yrs`}
                  </Badge>
                )}
                <Badge tone={contactModalDonor.can_give_now ? "success" : "muted"}>
                  {contactModalDonor.can_give_now ? t("donors.readyNow") : t("donors.unavailable")}
                </Badge>
                {contactModalDonor.blood_group_verified && (
                  <Badge tone="brand">✓ {t("donors.respects")}</Badge>
                )}
              </div>

              {/* Direct Phone Number Box */}
              <div className="mt-6 w-full rounded-2xl border border-line bg-elevated/60 p-4 text-left">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  {lang === "bn" ? "রক্তদাতার মোবাইল নম্বর" : "Direct Phone Number"}
                </span>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-lg sm:text-xl font-black tracking-wide text-ink font-mono">
                    {contactModalDonor.phone || (lang === "bn" ? "নম্বর লুকানো" : "Number hidden")}
                  </span>
                  {contactModalDonor.phone && (
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(contactModalDonor.phone as string)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:bg-elevated transition-colors cursor-pointer"
                    >
                      {copiedPhone ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-600">{lang === "bn" ? "কপি হয়েছে" : "Copied!"}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-muted" />
                          <span>{lang === "bn" ? "কপি করুন" : "Copy"}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Call Now and Instant Actions */}
              <div className="mt-5 w-full space-y-2.5">
                {contactModalDonor.phone ? (
                  <>
                    <a
                      href={`tel:${contactModalDonor.phone}`}
                      className="w-full inline-flex h-13 items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
                    >
                      <PhoneCall className="h-5 w-5 fill-white" />
                      <span>{lang === "bn" ? "এখনই কল করুন" : "Call Right Now"}</span>
                    </a>

                    {/* SMS & WhatsApp buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`sms:${contactModalDonor.phone}?body=${encodeURIComponent(
                          lang === "bn"
                            ? `জরুরি রক্তের প্রয়োজন: ${contactModalDonor.blood_group}। আপনি কি রক্ত দিতে পারবেন?`
                            : `Emergency blood needed: ${contactModalDonor.blood_group}. Are you available to donate?`
                        )}`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-ink hover:bg-elevated transition-colors cursor-pointer"
                      >
                        <MessageSquare className="h-4 w-4 text-muted" />
                        <span>{lang === "bn" ? "এসএমএস পাঠান" : "Send SMS"}</span>
                      </a>

                      <a
                        href={`https://wa.me/${(contactModalDonor.phone as string).replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                          lang === "bn"
                            ? `জরুরি রক্তের প্রয়োজন: ${contactModalDonor.blood_group}। আপনি কি রক্ত দিতে পারবেন?`
                            : `Emergency blood needed: ${contactModalDonor.blood_group}. Are you available to donate?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-ink hover:bg-elevated transition-colors cursor-pointer"
                      >
                        <span className="text-emerald-600 font-bold">WhatsApp</span>
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-xs text-muted leading-relaxed text-center">
                    {lang === "bn"
                      ? "নম্বরটি সুরক্ষিত। রক্তের অনুরোধ পাঠালে রক্তদাতা নম্বর শেয়ার করবেন।"
                      : "This number is protected. Send a blood request and the donor will share it."}
                  </p>
                )}
              </div>

              {/* Alternative Request Option */}
              <div className="mt-5 pt-3 border-t border-line w-full text-center">
                <p className="text-xs text-muted">
                  {lang === "bn" ? "প্লাটফর্মে আনুষ্ঠানিক অনুরোধ পাঠাতে চান? " : "Want to broadcast a formal request? "}
                  <Link
                    to={`/requests/new?group=${contactModalDonor.blood_group}&donor=${contactModalDonor.donor_id}`}
                    className="font-bold text-brand hover:underline"
                  >
                    {lang === "bn" ? "অনুরোধ ফর্ম খুলুন" : "Open Request Form"}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right Horizontal Map & Full Address Drawer */}
      <DonorAddressMapDrawer
        donor={mapDonor}
        onClose={() => setMapDonor(null)}
        onCall={(donor: DonorCard) => {
          setMapDonor(null);
          setContactModalDonor(donor);
        }}
        onRequest={(donor: DonorCard) => {
          setMapDonor(null);
          navigate(`/requests/new?group=${donor.blood_group}&donor=${donor.donor_id}`);
        }}
      />
    </div>
  );
}

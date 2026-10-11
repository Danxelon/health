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
import { ArrowRight, Droplet, Filter, MapPin, Search } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import { Badge, DistanceChip, SectionHeader } from "@/components/ui.tsx";
import { searchDonors, type SearchDonorsArgs, type SearchResults } from "@/api/donors.ts";
import { fetchDoctors } from "@/api/doctors.ts";
import type { BloodGroup, DoctorCard, RequestUrgency } from "@/domain/types.ts";
import { URGENCY_LABELS } from "@/lib/strings.ts";
import { DEMO_UPAZILAS } from "@/lib/demo-data.ts";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

type AreaSortOption = "match" | "ready" | "name";

export default function Donors() {
  const { t, lang } = useAppShell();
  const { isLoggedIn } = useAuth();
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
  }, [selectedGroup, selectedUpazila, selectedUrgency]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    fetchDoctors().then((d) => {
      setDoctors(d);
      setDoctorsLoading(false);
    });
  }, []);

  // Sort displayed donors according to user preference
  const sortedDonors = useMemo(() => {
    if (!results?.donors) return [];
    const list = [...results.donors];

    if (sortBy === "ready") {
      list.sort((a, b) => (b.can_give_now ? 1 : 0) - (a.can_give_now ? 1 : 0));
    } else if (sortBy === "name") {
      list.sort((a, b) => a.display_name.localeCompare(b.display_name));
    }
    // "match" uses default ranked order from backend/domain
    return list;
  }, [results, sortBy]);

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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
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
                  className="w-full h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand font-medium"
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
                  className="w-full h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand font-medium placeholder:text-muted/60"
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
                  className="w-full h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand font-medium"
                >
                  <option value="">
                    {lang === "bn" ? "সমগ্র বাংলাদেশ (সকল এলাকা)" : "All Areas (Nationwide)"}
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
                  className="w-full h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand font-medium"
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
                  className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-white disabled:opacity-40 hover:bg-brand-deep transition-all shadow-xs cursor-pointer active:scale-98"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label={t("common.loading")}>
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

              {/* Sort By controls */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted font-medium">{lang === "bn" ? "সাজান:" : "Sort:"}</span>
                <div className="inline-flex rounded-xl border border-line bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => setSortBy("match")}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      sortBy === "match" ? "bg-brand text-white shadow-2xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    {lang === "bn" ? "সেরা মিল" : "Best Match"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy("ready")}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      sortBy === "ready" ? "bg-brand text-white shadow-2xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    {lang === "bn" ? "প্রস্তুত রক্তদাতা" : "Ready First"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy("name")}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {sortedDonors.map((d) => (
                  <div
                    key={d.donor_id}
                    className="group flex flex-col gap-4 p-6 rounded-3xl border border-line bg-surface hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep font-black text-base tnum shadow-2xs">
                        {d.blood_group}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate font-bold text-ink">{d.display_name}</span>
                        <span className="block truncate text-xs text-muted">
                          {d.distance_km != null ? `${d.distance_km} km` : "Bangladesh"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
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

                    <div className="mt-auto pt-3 border-t border-line">
                      <button
                        type="button"
                        onClick={() => navigate(`/requests/new?group=${d.blood_group}&donor=${d.donor_id}`)}
                        className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-xs font-bold text-white hover:bg-brand-deep transition-colors cursor-pointer shadow-2xs active:scale-98"
                      >
                        <Droplet className="h-3.5 w-3.5 fill-white" strokeWidth={2} aria-hidden="true" />
                        {t("request.express")}
                      </button>
                    </div>
                  </div>
                ))}
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
                to="/doctors"
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
    </div>
  );
}
/**
 * Donors — find blood donors with interactive blood group picker,
 * comprehensive area sort-out filters, and ranking.
 *
 * Rules:
 * - Blood groups must be an interactive button picker (NOT a dropdown menu).
 * - "What is needed" option is excluded.
 * - Area sort-out filter provided without live location/GPS.
 * - Requires citizen to be logged in to access search.
 * - Donor cards are clean, modern, and uncluttered (no clumsy locked warnings).
 * - Full grid layout without duplicate right section.
 * - Clicking any donor opens centered DonorDetailModal.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Droplet,
  Filter,
  MapPin,
  PhoneCall,
  Search,
  Sparkles,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import { Badge, SectionHeader } from "@/components/ui.tsx";
import { searchDonors, type SearchDonorsArgs, type SearchResults } from "@/api/donors.ts";
import { pinFeaturedDonor } from "@/domain/featured-donor.ts";
import { fetchDoctors } from "@/api/doctors.ts";
import type { BloodGroup, DoctorCard, DonorCard, RequestUrgency } from "@/domain/types.ts";
import { URGENCY_LABELS } from "@/lib/strings.ts";
import { ageBand } from "@/domain/profile.ts";
import {
  getAnonymousDonorLabel,
  getApproximateArea,
  getApproximateDistance,
} from "@/domain/donor-privacy.ts";
import { DEMO_UPAZILAS } from "@/lib/demo-data.ts";
import DonorDetailModal from "@/components/DonorDetailModal.tsx";
import DonorConsentModal from "@/components/DonorConsentModal.tsx";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

type AreaSortOption = "match" | "ready" | "name";
type MatchMode = "exact" | "compatible";

export default function Donors() {
  const { t, lang } = useAppShell();
  const { isLoggedIn, openLoginModal } = useAuth();
  const navigate = useNavigate();

  const [selectedGroup, setSelectedGroup] = useState<BloodGroup | "">("O+");
  const [matchMode, setMatchMode] = useState<MatchMode>("exact");
  const [selectedUrgency, setSelectedUrgency] = useState<RequestUrgency>("routine");

  // Area & donor filters
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [selectedUpazila, setSelectedUpazila] = useState<number | "">("");
  const [areaSearchQuery, setAreaSearchQuery] = useState<string>("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "ready">("all");
  const [sortBy, setSortBy] = useState<AreaSortOption>("match");

  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);

  // Session Consent & Automated Call state
  const [consentedDonorIds, setConsentedDonorIds] = useState<Set<string>>(() => new Set());
  const [consentModalDonor, setConsentModalDonor] = useState<DonorCard | null>(null);

  // Centered Detail Modal for selected donor
  const [selectedDetailDonor, setSelectedDetailDonor] = useState<DonorCard | null>(null);

  const handleDonorConsented = (donor: DonorCard) => {
    setConsentedDonorIds((prev) => new Set(prev).add(donor.donor_id));
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedDetailDonor) setSelectedDetailDonor(null);
        if (consentModalDonor) setConsentModalDonor(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDetailDonor, consentModalDonor]);

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

  const hasActiveFilters = Boolean(
    selectedDivision ||
    selectedUpazila !== "" ||
    areaSearchQuery.trim() ||
    availabilityFilter !== "all" ||
    selectedGroup !== "O+"
  );

  const handleResetFilters = () => {
    setSelectedDivision("");
    setSelectedUpazila("");
    setAreaSearchQuery("");
    setAvailabilityFilter("all");
    setSelectedGroup("O+");
  };

  // Filter upazilas based on division and text search
  const filteredUpazilas = useMemo(() => {
    const list = selectedDivision
      ? DEMO_UPAZILAS.filter((u) => u.division_en === selectedDivision)
      : DEMO_UPAZILAS;

    if (!areaSearchQuery.trim()) return list;

    const q = areaSearchQuery.trim().toLowerCase();
    const matched = list.filter((u) => {
      return (
        u.name_en.toLowerCase().includes(q) ||
        u.name_bn.includes(q) ||
        u.district_en.toLowerCase().includes(q) ||
        u.district_bn.includes(q)
      );
    });

    return matched.length > 0 ? matched : list;
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

  // Auto-search whenever blood group, area, urgency, or match mode changes
  useEffect(() => {
    if (!isLoggedIn) return;

    const upazila = DEMO_UPAZILAS.find((u) => u.id === Number(selectedUpazila));
    const divisionCentre = selectedDivision
      ? DEMO_UPAZILAS.find((u) => u.division_en === selectedDivision)
      : null;

    const lat = upazila ? upazila.lat : divisionCentre ? divisionCentre.lat : null;
    const lng = upazila ? upazila.lng : divisionCentre ? divisionCentre.lng : null;

    doSearch({
      recipientGroup: selectedGroup,
      lat,
      lng,
      upazilaId: selectedUpazila ? Number(selectedUpazila) : null,
      division: selectedDivision || null,
      urgency: selectedUrgency,
      component: null, // "what is needed" option is explicitly excluded
      exactMatchOnly: matchMode === "exact",
    });
  }, [isLoggedIn, selectedGroup, selectedUpazila, selectedDivision, selectedUrgency, matchMode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      openLoginModal("/donors");
      return;
    }

    const upazila = DEMO_UPAZILAS.find((u) => u.id === Number(selectedUpazila));
    const divisionCentre = selectedDivision
      ? DEMO_UPAZILAS.find((u) => u.division_en === selectedDivision)
      : null;

    const lat = upazila ? upazila.lat : divisionCentre ? divisionCentre.lat : null;
    const lng = upazila ? upazila.lng : divisionCentre ? divisionCentre.lng : null;

    doSearch({
      recipientGroup: selectedGroup,
      lat,
      lng,
      upazilaId: selectedUpazila ? Number(selectedUpazila) : null,
      division: selectedDivision || null,
      urgency: selectedUrgency,
      component: null,
      exactMatchOnly: matchMode === "exact",
    });
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchDoctors().then((d) => {
      setDoctors(d);
      setDoctorsLoading(false);
    });
  }, [isLoggedIn]);

  // Unified sorting and filtering pipeline
  const sortedDonors = useMemo(() => {
    if (!results?.donors) return [];
    let list = [...results.donors];

    // 1. Blood group filter
    if (selectedGroup) {
      if (matchMode === "exact") {
        list = list.filter((d) => d.blood_group === selectedGroup);
      } else {
        // In compatible mode, sort exact matches to the top
        list.sort((a, b) => {
          if (a.blood_group === selectedGroup && b.blood_group !== selectedGroup) return -1;
          if (b.blood_group === selectedGroup && a.blood_group !== selectedGroup) return 1;
          return 0;
        });
      }
    }

    // 2. Division filter (e.g. "Rangpur")
    if (selectedDivision) {
      const divLower = selectedDivision.toLowerCase();
      list = list.filter((d) => {
        const divEn = (d.division_en || "").toLowerCase();
        const divBn = d.division_bn || "";
        const addrEn = (d.address_en || "").toLowerCase();
        const addrBn = d.address_bn || "";
        const upEn = (d.upazila_en || "").toLowerCase();
        const distEn = (d.district_en || "").toLowerCase();
        return (
          divEn === divLower ||
          divBn.includes(selectedDivision) ||
          addrEn.includes(divLower) ||
          addrBn.includes(selectedDivision) ||
          upEn.includes(divLower) ||
          distEn.includes(divLower)
        );
      });
    }

    // 3. Upazila filter
    if (selectedUpazila) {
      const up = DEMO_UPAZILAS.find((u) => u.id === Number(selectedUpazila));
      if (up) {
        const upNameEn = up.name_en.toLowerCase();
        const upNameBn = up.name_bn;
        list = list.filter((d) => {
          const dUpEn = (d.upazila_en || "").toLowerCase();
          const dUpBn = d.upazila_bn || "";
          const dAddrEn = (d.address_en || "").toLowerCase();
          const dAddrBn = d.address_bn || "";
          return (
            d.upazila_id === up.id ||
            dUpEn.includes(upNameEn) ||
            dUpBn.includes(upNameBn) ||
            dAddrEn.includes(upNameEn) ||
            dAddrBn.includes(upNameBn)
          );
        });
      }
    }

    // 4. Area Search Query filter (matches query in EN/BN against address, upazila, district, division)
    if (areaSearchQuery.trim()) {
      const q = areaSearchQuery.trim().toLowerCase();
      list = list.filter((d) => {
        const addrEn = (d.address_en || "").toLowerCase();
        const addrBn = d.address_bn || "";
        const upEn = (d.upazila_en || "").toLowerCase();
        const upBn = d.upazila_bn || "";
        const distEn = (d.district_en || "").toLowerCase();
        const distBn = d.district_bn || "";
        const divEn = (d.division_en || "").toLowerCase();
        const divBn = d.division_bn || "";
        const name = (d.full_name || d.display_name || "").toLowerCase();
        const nameBn = d.full_name_bn || d.display_name_bn || "";
        return (
          addrEn.includes(q) ||
          addrBn.includes(q) ||
          upEn.includes(q) ||
          upBn.includes(q) ||
          distEn.includes(q) ||
          distBn.includes(q) ||
          divEn.includes(q) ||
          divBn.includes(q) ||
          name.includes(q) ||
          nameBn.includes(q)
        );
      });
    }

    // 5. User Sort preference
    if (sortBy === "ready") {
      list.sort((a, b) => (b.can_give_now ? 1 : 0) - (a.can_give_now ? 1 : 0));
    } else if (sortBy === "name") {
      list.sort((a, b) => {
        const nameA = (lang === "bn" ? (a.full_name_bn || a.display_name_bn || a.display_name) : (a.full_name || a.display_name)).toLowerCase();
        const nameB = (lang === "bn" ? (b.full_name_bn || b.display_name_bn || b.display_name) : (b.full_name || b.display_name)).toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }

    // 6. Featured account pin for AB+
    if (!selectedGroup) return list;
    return pinFeaturedDonor(list, selectedGroup);
  }, [results, sortBy, lang, selectedGroup, matchMode, selectedDivision, selectedUpazila, areaSearchQuery]);

  // Next nearest donor for decline recommendation in consent modal
  const nextConsentDonor = useMemo(() => {
    if (!consentModalDonor || !sortedDonors.length) return null;
    const idx = sortedDonors.findIndex((d) => d.donor_id === consentModalDonor.donor_id);
    if (idx >= 0 && idx < sortedDonors.length - 1) {
      return sortedDonors[idx + 1] ?? null;
    }
    return null;
  }, [consentModalDonor, sortedDonors]);

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
              className="w-full inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 text-sm font-bold text-white hover:bg-brand-deep transition-all shadow-md cursor-pointer"
            >
              {lang === "bn" ? "লগ ইন করুন" : "Log In"}
            </button>
            <Link
              to="/signup"
              className="w-full inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-6 text-sm font-bold text-ink hover:bg-elevated transition-all"
            >
              {lang === "bn" ? "নতুন অ্যাকাউন্ট খুলুন" : "Create New Account"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand">
            {lang === "bn" ? "জীবন রক্ষা রক্তদাতা নেটওয়ার্ক" : "Blood Donor Network"}
          </span>
          <h1 className="mt-1 text-3xl sm:text-4xl font-black text-ink tracking-tight">
            {t("donors.title")}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted max-w-2xl leading-relaxed">
            {t("donors.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/requests/new"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-sm font-bold text-white hover:bg-brand-deep transition-all shadow-sm cursor-pointer active:scale-98"
          >
            <Droplet className="h-4 w-4 fill-white" />
            <span>{t("request.express")}</span>
          </Link>
        </div>
      </div>

      {/* Search & Area Filter Controls */}
      <form
        onSubmit={handleSearchSubmit}
        className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-xs"
      >
        <div className="space-y-6">
          {/* Blood Group Picker - interactive buttons */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-ink">
                {t("donors.patientGroup")}
              </label>
              <span className="text-xs text-muted">
                {lang === "bn" ? "রক্তের গ্রুপে চাপ দিন" : "Click to pick blood group"}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 sm:gap-2.5">
              {/* "All" button */}
              <button
                type="button"
                onClick={() => setSelectedGroup("")}
                className={`h-14 sm:h-16 flex flex-col items-center justify-center rounded-2xl border font-black transition-all cursor-pointer ${
                  selectedGroup === ""
                    ? "border-brand bg-brand text-white shadow-md scale-105 ring-2 ring-brand ring-offset-2 ring-offset-surface"
                    : "border-line bg-surface text-ink hover:border-brand/50 hover:bg-brand-soft/30 hover:scale-102"
                }`}
                aria-pressed={selectedGroup === ""}
              >
                <span className="text-xs opacity-75 font-semibold">
                  <Droplet className={`h-3 w-3 ${selectedGroup === "" ? "fill-white" : "text-brand"}`} />
                </span>
                <span className="text-sm sm:text-base leading-tight font-bold mt-0.5">
                  {lang === "bn" ? "সকল" : "All"}
                </span>
              </button>

              {BLOOD_GROUPS.map((g) => {
                const isSelected = selectedGroup === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGroup(isSelected ? "" : g)}
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

            {/* Match Mode Filter: Exact Match vs Compatible */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line/60">
              <span className="text-xs text-muted font-medium">
                {lang === "bn" ? "রক্তের গ্রুপের ফিল্টার মোড:" : "Group Filter Mode:"}
              </span>
              <div role="group" aria-label="Blood match mode" className="inline-flex rounded-xl border border-line bg-surface p-0.5">
                <button
                  type="button"
                  onClick={() => setMatchMode("exact")}
                  className={`min-h-[38px] px-4 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    matchMode === "exact"
                      ? "bg-brand text-white shadow-xs"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {lang === "bn" ? `✓ শুধুমাত্র ${selectedGroup || ""} (হুবহু মিল)` : `✓ Exact ${selectedGroup || ""} Only`}
                </button>
                <button
                  type="button"
                  onClick={() => setMatchMode("compatible")}
                  className={`min-h-[38px] px-4 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    matchMode === "compatible"
                      ? "bg-brand text-white shadow-xs"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {lang === "bn" ? "চিকিৎসাগত সামঞ্জস্যপূর্ণ সকল গ্রুপ" : "All Compatible Groups"}
                </button>
              </div>
            </div>
          </div>

          {/* Area Sort-Out Filter & Urgency */}
          <div className="pt-4 border-t border-line">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                <Filter className="h-3.5 w-3.5" />
                <span>{lang === "bn" ? "রক্তদাতা ফিল্টার সমূহ" : "Donor Filters"}</span>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-bold text-brand hover:text-brand-deep cursor-pointer flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>{lang === "bn" ? "সব ফিল্টার মুছুন" : "Clear Filters"}</span>
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
              {/* Division Filter */}
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
                  {lang === "bn" ? "এলাকা বা জেলার নাম" : "Search Area / City"}
                </label>
                <input
                  type="text"
                  value={areaSearchQuery}
                  onChange={(e) => setAreaSearchQuery(e.target.value)}
                  placeholder={lang === "bn" ? "যেমন: রংপুর, মিরপুর, সিলেট..." : "e.g. Rangpur, Mirpur..."}
                  className="w-full h-12 sm:h-11 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm text-ink outline-none focus:border-brand font-medium placeholder:text-muted/60"
                />
              </div>

              {/* Area / Upazila Selection */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-brand" />
                    <span>{lang === "bn" ? "উপজেলা / থানা" : "Upazila / Thana"}</span>
                  </span>
                </label>
                <select
                  value={selectedUpazila}
                  onChange={(e) => setSelectedUpazila(e.target.value ? Number(e.target.value) : "")}
                  className="w-full h-12 sm:h-11 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm text-ink outline-none focus:border-brand font-medium"
                >
                  <option value="">
                    {lang === "bn" ? "সকল এলাকা" : "All Areas"}
                  </option>
                  {filteredUpazilas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {lang === "bn" ? `${u.name_bn}, ${u.district_bn}` : `${u.name_en}, ${u.district_en}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name or Area Quick Search */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  {lang === "bn" ? "নাম বা এলাকা খুঁজুন" : "Search Name or Area"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={areaSearchQuery}
                    onChange={(e) => setAreaSearchQuery(e.target.value)}
                    placeholder={lang === "bn" ? "যেমন: তানভীর, ধানমন্ডি..." : "e.g. Tanvir, Dhanmondi..."}
                    className="w-full h-12 sm:h-11 rounded-xl border border-line bg-surface pl-3 pr-8 text-base sm:text-sm text-ink outline-none focus:border-brand font-medium placeholder:text-muted/60"
                  />
                  {areaSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setAreaSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
                      title={lang === "bn" ? "মুছুন" : "Clear"}
                      aria-label={lang === "bn" ? "মুছুন" : "Clear"}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Availability Filter */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  {lang === "bn" ? "প্রস্তুত অবস্থা" : "Availability"}
                </label>
                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value as "all" | "ready")}
                  className="w-full h-12 sm:h-11 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm text-ink outline-none focus:border-brand font-medium"
                >
                  <option value="all">{lang === "bn" ? "সকল রক্তদাতা" : "All Donors"}</option>
                  <option value="ready">{lang === "bn" ? "এখনই প্রস্তুত (Ready)" : "Ready to Donate Now"}</option>
                </select>
              </div>

              {/* Search Submit CTA & Reset */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 inline-flex h-12 sm:h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-40 hover:bg-brand-deep transition-all shadow-xs cursor-pointer active:scale-98"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <span>{loading ? t("common.loading") : t("common.search")}</span>
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    title={lang === "bn" ? "সব ফিল্টার মুছুন" : "Reset Filters"}
                    className="inline-flex h-12 sm:h-11 min-h-[44px] w-11 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-ink hover:bg-elevated transition-colors cursor-pointer shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
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
                {matchMode === "exact" ? (
                  lang === "bn" ? (
                    <>
                      <span className="text-brand font-black">{selectedGroup}</span> হুবহু গ্রুপের রক্তদাতা পাওয়া গেছে:{" "}
                      <span className="text-ink font-bold">{sortedDonors.length} জন</span>
                    </>
                  ) : (
                    <>
                      Exact <span className="text-brand font-black">{selectedGroup}</span> donors found:{" "}
                      <span className="text-ink font-bold">{sortedDonors.length}</span>
                    </>
                  )
                ) : (
                  lang === "bn" ? (
                    <>
                      <span className="text-brand font-black">{selectedGroup}</span> রোগীর জন্য রক্তদাতা:{" "}
                      <span className="text-ink font-bold">{sortedDonors.length} জন</span>
                    </>
                  ) : (
                    <>
                      Donors matching <span className="text-brand font-black">{selectedGroup}</span>:{" "}
                      <span className="text-ink font-bold">{sortedDonors.length}</span>
                    </>
                  )
                )}
                {" · "}
                {t("donors.readyNow")}{" "}
                <span className="text-emerald-600 font-bold">
                  {sortedDonors.filter((d) => d.can_give_now).length}
                </span>
              </p>

              {/* Sort By controls */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted font-medium">{lang === "bn" ? "সাজান:" : "Sort:"}</span>
                <div role="group" aria-label={lang === "bn" ? "রক্তদাতা সাজান" : "Sort donors"} className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => setSortBy("match")}
                    aria-pressed={sortBy === "match"}
                    className={`min-h-[40px] px-4 py-1 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      sortBy === "match" ? "bg-brand text-white shadow-2xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    {lang === "bn" ? "সেরা মিল" : "Best Match"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy("ready")}
                    aria-pressed={sortBy === "ready"}
                    className={`min-h-[40px] px-4 py-1 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      sortBy === "ready" ? "bg-brand text-white shadow-2xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    {lang === "bn" ? "প্রস্তুত রক্তদাতা" : "Ready First"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy("name")}
                    aria-pressed={sortBy === "name"}
                    className={`min-h-[40px] px-4 py-1 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      sortBy === "name" ? "bg-brand text-white shadow-2xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    {lang === "bn" ? "নাম অনুযায়ী" : "By Name"}
                  </button>
                </div>
              </div>
            </div>

            {/* Empty State */}
            {sortedDonors.length === 0 ? (
              <div className="rounded-3xl border border-line bg-surface p-12 text-center text-muted">
                <p className="font-bold text-ink text-lg mb-2">{t("donors.noneTitle")}</p>
                <p className="max-w-md mx-auto">{t("donors.noneBody")}</p>
                <div className="mt-6 flex flex-wrap gap-3 justify-center">
                  {(selectedDivision || selectedUpazila || areaSearchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDivision("");
                        setSelectedUpazila("");
                        setAreaSearchQuery("");
                      }}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white hover:bg-brand-deep cursor-pointer"
                    >
                      {lang === "bn" ? "সকল এলাকার রক্তদাতা দেখুন" : "View Nationwide Donors"}
                    </button>
                  )}
                  {matchMode === "exact" && (
                    <button
                      type="button"
                      onClick={() => setMatchMode("compatible")}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-brand/30 bg-surface px-5 text-xs font-bold text-brand hover:bg-brand-soft/50 cursor-pointer"
                    >
                      {lang === "bn" ? "সামঞ্জস্যপূর্ণ রক্তদাতা খুঁজুন" : "Show Compatible Donors"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Clean Full-Width Donor Cards Grid (No right section) */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {sortedDonors.map((d) => {
                  const isConsented = consentedDonorIds.has(d.donor_id);
                  const anonymousLabel = getAnonymousDonorLabel(d, lang);
                  const approximateArea = getApproximateArea(d, lang);
                  const approximateDistance = getApproximateDistance(d.distance_km, lang);
                  const donorAgeBand = ageBand(d.age)[lang];

                  const primaryName = isConsented
                    ? (lang === "bn"
                        ? (d.full_name_bn || d.display_name_bn || d.display_name)
                        : (d.full_name || d.display_name))
                    : anonymousLabel;

                  const isExactMatch = d.blood_group === selectedGroup;

                  return (
                    <div
                      key={d.donor_id}
                      onClick={() => setSelectedDetailDonor(d)}
                      className="group flex flex-col justify-between p-5 sm:p-6 rounded-3xl border border-line bg-surface hover:border-brand/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer relative"
                    >
                      {/* Top Header: Blood Group, Donor Label, Age, Ready Badge */}
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep font-black text-xl tnum shadow-2xs group-hover:scale-105 transition-transform">
                              {d.blood_group}
                            </span>
                            <div className="min-w-0">
                              <h3 className="text-base font-black text-ink truncate group-hover:text-brand transition-colors">
                                {primaryName}
                              </h3>
                              <p className="text-xs text-muted font-medium mt-0.5">
                                {donorAgeBand && `${lang === "bn" ? "বয়স" : "Age"}: ${donorAgeBand}`}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shrink-0 ${
                              d.can_give_now
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-elevated text-muted border border-line"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${d.can_give_now ? "bg-emerald-500" : "bg-line-strong"}`} />
                            <span>{d.can_give_now ? t("donors.readyNow") : t("donors.unavailable")}</span>
                          </span>
                        </div>

                        {/* Badges: Match type & Lab verification */}
                        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                          {matchMode === "compatible" && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                                isExactMatch
                                  ? "bg-brand text-white"
                                  : "bg-brand-soft text-brand-deep"
                              }`}
                            >
                              {isExactMatch
                                ? (lang === "bn" ? "হুবহু মিল" : "Exact Match")
                                : (lang === "bn" ? "সামঞ্জস্যপূর্ণ" : "Compatible")}
                            </span>
                          )}
                          {d.blood_group_verified && (
                            <span className="inline-flex items-center gap-0.5 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                              ✓ {lang === "bn" ? "ল্যাব যাচাইকৃত" : "Verified"}
                            </span>
                          )}
                        </div>

                        {/* Approximate Area & Distance Row */}
                        <div className="mt-3.5 flex items-center gap-2 text-xs text-muted">
                          <MapPin className="h-3.5 w-3.5 text-brand shrink-0" />
                          <span className="font-bold text-ink truncate">{approximateArea}</span>
                          <span className="opacity-40">•</span>
                          <span className="text-brand font-bold shrink-0">{approximateDistance}</span>
                        </div>
                      </div>

                      {/* Card Action Buttons (Click-safe) */}
                      <div
                        className="mt-5 pt-4 border-t border-line/80 flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isConsented && d.phone ? (
                          <a
                            href={`tel:${d.phone}`}
                            className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                          >
                            <PhoneCall className="h-3.5 w-3.5 fill-white shrink-0" />
                            <span>{lang === "bn" ? "কল করুন" : "Call Now"}</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConsentModalDonor(d)}
                            className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                          >
                            <PhoneCall className="h-3.5 w-3.5 fill-white shrink-0" />
                            <span>{lang === "bn" ? "অনুমতি কল পাঠান" : "Request Consent"}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedDetailDonor(d)}
                          className="inline-flex h-11 px-4 items-center justify-center rounded-xl border border-line bg-surface hover:bg-elevated text-xs font-bold text-ink transition-colors cursor-pointer"
                        >
                          {lang === "bn" ? "বিস্তারিত" : "Details"}
                        </button>
                      </div>
                    </div>
                  );
                })}
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

      {/* Automated IVR Consent Call Modal */}
      <DonorConsentModal
        donor={consentModalDonor}
        isOpen={Boolean(consentModalDonor)}
        onClose={() => setConsentModalDonor(null)}
        onConsent={handleDonorConsented}
        isConsented={consentModalDonor ? consentedDonorIds.has(consentModalDonor.donor_id) : false}
        initialUrgency="urgent"
        nextDonor={nextConsentDonor}
        onSelectNextDonor={(d) => setConsentModalDonor(d)}
        lang={lang}
      />

      {/* Centered Donor Detail Dialog Modal */}
      <DonorDetailModal
        donor={selectedDetailDonor}
        isOpen={Boolean(selectedDetailDonor)}
        onClose={() => setSelectedDetailDonor(null)}
        isConsented={selectedDetailDonor ? consentedDonorIds.has(selectedDetailDonor.donor_id) : false}
        onConsentRequest={(donor: DonorCard) => {
          setSelectedDetailDonor(null);
          setConsentModalDonor(donor);
        }}
        lang={lang}
      />
    </div>
  );
}

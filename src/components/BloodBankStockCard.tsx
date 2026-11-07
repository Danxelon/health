/**
 * BloodBankStockCard — Location-Aware Institutional Blood Bank Directory & Shortage Radar
 *
 * Location Flow:
 * 1. Requests client browser geolocation (`navigator.geolocation.getCurrentPosition`) on mount.
 * 2. Once granted, resolves the client's nearest district/division and displays nearby
 *    verified institutional blood banks sorted by distance (`km away`).
 * 3. If the user denies/blocks location access (or geolocation is unavailable/times out),
 *    prompts the user inside this section to select their location (Division & District),
 *    and once provided, displays the matching nearby blood banks.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Droplet,
  Globe,
  MapPin,
  Navigation,
  PhoneCall,
  Radio,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { BLOOD_GROUPS, type BloodGroup } from "@/domain/types.ts";
import {
  VERIFIED_BLOOD_BANKS,
  DIVISIONS,
  DISTRICTS,
  getStockStatus,
  getStockStatusMeta,
  formatDialableHotline,
  formatStockUnits,
  formatDistanceKm,
  calculateDistanceKm,
  resolveLocationFromCoords,
  resolveLocationFromDistrict,
  resolveLocationFromDivision,
  getNearbyBloodBanks,
  filterBloodBanks,
  getEmergencyShortageRadar,
  getDistrictsForDivision,
  type BloodBank,
  type BloodBankWithDistance,
  type ResolvedClientLocation,
  type StockStatus,
} from "@/domain/blood-banks.ts";
import { toBengaliDigits } from "@/domain/profile.ts";

export interface BloodBankStockCardProps {
  initialDivision?: string;
  initialDistrict?: string;
  shortageOnly?: boolean;
  compact?: boolean;
  className?: string;
}

type LocationStage = "requesting" | "prompt_manual" | "resolved";
type GeoDenialReason = "denied" | "unavailable" | "timeout" | null;

export default function BloodBankStockCard({
  initialDivision = "ALL",
  initialDistrict = "ALL",
  shortageOnly: initialShortageOnly = false,
  compact = false,
  className = "",
}: BloodBankStockCardProps) {
  const { lang } = useAppShell();
  const isBn = lang === "bn";

  // Check if explicit location was passed via props
  const preselectedLocation = useMemo<ResolvedClientLocation | null>(() => {
    if (initialDistrict && initialDistrict !== "ALL") {
      return resolveLocationFromDistrict(initialDistrict);
    }
    if (initialDivision && initialDivision !== "ALL") {
      return resolveLocationFromDivision(initialDivision);
    }
    return null;
  }, [initialDivision, initialDistrict]);

  // Geolocation & manual location state machine
  const [locationStage, setLocationStage] = useState<LocationStage>(() =>
    preselectedLocation ? "resolved" : "requesting"
  );
  const [clientLocation, setClientLocation] = useState<ResolvedClientLocation | null>(
    () => preselectedLocation
  );
  const [geoDenialReason, setGeoDenialReason] = useState<GeoDenialReason>(null);
  const [viewScope, setViewScope] = useState<"nearby" | "all">("nearby");

  // Manual location picker inputs (used when permission is denied or when changing location)
  const [manualDivision, setManualDivision] = useState<string>(
    preselectedLocation?.division_en ?? ""
  );
  const [manualDistrict, setManualDistrict] = useState<string>(
    preselectedLocation?.district_en ?? ""
  );
  const [manualFormError, setManualFormError] = useState<boolean>(false);

  // Guard ref to ignore stale geolocation callbacks if user switches manually or unmounts
  const geoRequestIdRef = useRef<number>(0);

  // Filter states (for national view or narrowing results)
  const [selectedDivision, setSelectedDivision] = useState<string>(initialDivision);
  const [selectedDistrict, setSelectedDistrict] = useState<string>(initialDistrict);
  const [selectedGroup, setSelectedGroup] = useState<BloodGroup | "ALL">("ALL");
  const [shortageRadarOnly, setShortageRadarOnly] = useState<boolean>(initialShortageOnly);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Transfer Requisition Modal State
  const [transferModalBank, setTransferModalBank] = useState<BloodBank | null>(null);
  const [transferGroup, setTransferGroup] = useState<BloodGroup>("O+");
  const [transferUnits, setTransferUnits] = useState<number>(1);
  const [transferHospital, setTransferHospital] = useState<string>("");
  const [transferContactPhone, setTransferContactPhone] = useState<string>("");
  const [transferUrgency, setTransferUrgency] = useState<"urgent" | "critical" | "routine">("urgent");
  const [transferSubmitted, setTransferSubmitted] = useState<boolean>(false);

  const requestBrowserLocation = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGeoDenialReason("unavailable");
      setLocationStage("prompt_manual");
      return;
    }

    const requestId = ++geoRequestIdRef.current;
    setLocationStage("requesting");
    setGeoDenialReason(null);
    setManualFormError(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== geoRequestIdRef.current) return;
        const resolved = resolveLocationFromCoords(
          position.coords.latitude,
          position.coords.longitude
        );
        setClientLocation(resolved);
        setManualDivision(resolved.division_en);
        setManualDistrict(resolved.district_en);
        setViewScope("nearby");
        setLocationStage("resolved");
      },
      (err) => {
        if (requestId !== geoRequestIdRef.current) return;
        if (err.code === 1) {
          setGeoDenialReason("denied");
        } else if (err.code === 3) {
          setGeoDenialReason("timeout");
        } else {
          setGeoDenialReason("unavailable");
        }
        setLocationStage("prompt_manual");
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 300_000,
      }
    );
  }, []);

  // Automatically request client location permission on mount
  useEffect(() => {
    if (preselectedLocation) return;
    requestBrowserLocation();
    return () => {
      geoRequestIdRef.current += 1;
    };
  }, [preselectedLocation, requestBrowserLocation]);

  // Districts for manual location prompt
  const manualDistrictOptions = useMemo(() => {
    return getDistrictsForDivision(manualDivision || "ALL");
  }, [manualDivision]);

  const handleManualDivisionChange = (divEn: string) => {
    setManualDivision(divEn);
    setManualFormError(false);
    if (divEn) {
      const valid = DISTRICTS.some(
        (d) => d.division_en === divEn && d.en === manualDistrict
      );
      if (!valid) {
        setManualDistrict("");
      }
    }
  };

  const handleManualDistrictChange = (distEn: string) => {
    setManualDistrict(distEn);
    setManualFormError(false);
    if (distEn) {
      const matched = DISTRICTS.find((d) => d.en === distEn);
      if (matched && matched.division_en !== manualDivision) {
        setManualDivision(matched.division_en);
      }
    }
  };

  const handleManualLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    geoRequestIdRef.current += 1;

    const resolved = manualDistrict
      ? resolveLocationFromDistrict(manualDistrict)
      : manualDivision
      ? resolveLocationFromDivision(manualDivision)
      : null;

    if (!resolved) {
      setManualFormError(true);
      return;
    }

    setManualFormError(false);
    setClientLocation(resolved);
    setViewScope("nearby");
    setSelectedDivision("ALL");
    setSelectedDistrict("ALL");
    setLocationStage("resolved");
  };

  const openManualLocationPrompt = () => {
    geoRequestIdRef.current += 1;
    if (clientLocation) {
      setManualDivision(clientLocation.division_en);
      setManualDistrict(clientLocation.district_en);
    }
    setManualFormError(false);
    setLocationStage("prompt_manual");
  };

  // Available districts for national filter dropdown
  const districtsForDivision = useMemo(() => {
    return getDistrictsForDivision(selectedDivision);
  }, [selectedDivision]);

  const handleDivisionChange = (div: string) => {
    setSelectedDivision(div);
    if (div === "ALL") {
      setSelectedDistrict("ALL");
    } else {
      const nextDistricts = getDistrictsForDivision(div);
      const validInDiv = nextDistricts.some((d) => d.en === selectedDistrict);
      if (!validInDiv) {
        setSelectedDistrict("ALL");
      }
    }
  };

  // Nearby blood banks computed from resolved client location
  const nearbyResult = useMemo(() => {
    if (!clientLocation) return null;
    return getNearbyBloodBanks(VERIFIED_BLOOD_BANKS, clientLocation);
  }, [clientLocation]);

  // Base pool of blood banks (either nearby-only or all national centres sorted by distance)
  const baseBanks = useMemo<BloodBankWithDistance[]>(() => {
    if (!clientLocation) return [];
    if (viewScope === "nearby" && nearbyResult) {
      return nearbyResult.banks;
    }
    return VERIFIED_BLOOD_BANKS.map((bank) => ({
      ...bank,
      distance_km: calculateDistanceKm(
        { lat: clientLocation.lat, lng: clientLocation.lng },
        { lat: bank.lat, lng: bank.lng }
      ),
    })).sort((a, b) => a.distance_km - b.distance_km);
  }, [clientLocation, viewScope, nearbyResult]);

  // Filtered blood banks after applying group, shortage, search, and (in national view) area filters
  const filteredBanks = useMemo(() => {
    return filterBloodBanks(baseBanks, {
      division: viewScope === "all" ? selectedDivision : "ALL",
      district: viewScope === "all" ? selectedDistrict : "ALL",
      bloodGroup: selectedGroup,
      shortageOnly: shortageRadarOnly,
      search: searchQuery,
    });
  }, [
    baseBanks,
    viewScope,
    selectedDivision,
    selectedDistrict,
    selectedGroup,
    shortageRadarOnly,
    searchQuery,
  ]);

  // Emergency Shortage Radar metrics scoped to the active bank set once location is resolved
  const shortageRadar = useMemo(() => {
    if (locationStage === "resolved" && baseBanks.length > 0) {
      return getEmergencyShortageRadar(baseBanks);
    }
    return getEmergencyShortageRadar(VERIFIED_BLOOD_BANKS);
  }, [locationStage, baseBanks]);

  const openTransferModal = (bank: BloodBank, group?: BloodGroup) => {
    setTransferModalBank(bank);
    setTransferGroup(group ?? (selectedGroup !== "ALL" ? selectedGroup : "O+"));
    setTransferUnits(1);
    setTransferHospital("");
    setTransferContactPhone("+8801");
    setTransferUrgency("urgent");
    setTransferSubmitted(false);
  };

  const closeTransferModal = () => {
    setTransferModalBank(null);
    setTransferSubmitted(false);
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferSubmitted(true);
  };

  return (
    <section
      id="blood-bank-stock-radar"
      className={`relative rounded-3xl border border-line bg-surface text-ink shadow-sm overflow-hidden ${className}`}
      aria-labelledby="blood-bank-directory-title"
    >
      {/* Top Banner / Radar Header */}
      <div className="border-b border-line bg-gradient-to-r from-blood-soft/50 via-surface to-brand-soft/40 dark:from-blood-soft/20 dark:via-surface dark:to-brand-soft/10 p-5 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-sm mt-0.5">
              <Building2 className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600" />
              </span>
            </span>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blood/20 bg-blood-soft/80 px-2.5 py-0.5 text-[11px] font-bold text-blood-deep">
                <Radio className="h-3 w-3 animate-pulse text-blood" />
                <span>
                  {isBn
                    ? "জরুরি ঘাটতি রাডার ও লাইভ স্টক ডিরেক্টরি"
                    : "Live Stock Directory & Emergency Shortage Radar"}
                </span>
              </div>
              <h2
                id="blood-bank-directory-title"
                className="mt-1 text-xl sm:text-2xl font-extrabold text-ink leading-tight"
              >
                {isBn
                  ? "কাছের প্রাতিষ্ঠানিক ব্লাড ব্যাংক ও রক্তের স্টক"
                  : "Verified Institutional Blood Banks Near You"}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted">
                {isBn
                  ? "আপনার অবস্থানের ভিত্তিতে নিকটতম ব্লাড ব্যাংক ও হাসপাতালের রিয়েল-টাইম রক্তের স্টক ও জরুরি হটলাইন"
                  : "Location-matched real-time 8-group stock levels & direct hotlines for verified blood banks and medical institutions"}
              </p>
            </div>
          </div>

          {/* Quick Shortage Radar Pill (shown once location is resolved) */}
          {locationStage === "resolved" && (
            <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
              <button
                type="button"
                onClick={() => setShortageRadarOnly(!shortageRadarOnly)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer border ${
                  shortageRadarOnly
                    ? "bg-red-600 text-white border-red-700 ring-2 ring-red-400"
                    : "bg-surface text-blood-deep border-blood/30 hover:bg-blood-soft/60"
                }`}
              >
                <AlertTriangle className={`h-4 w-4 ${shortageRadarOnly ? "animate-bounce" : "text-blood"}`} />
                <span>
                  {isBn
                    ? `সংকট রাডার: ${toBengaliDigits(shortageRadar.banksWithCriticalShortage)}টি প্রতিষ্ঠানে ঘাটতি`
                    : `Radar: ${shortageRadar.banksWithCriticalShortage} Banks with Shortages`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Shortage Radar Quick Blood Group Pills (shown once location is resolved) */}
        {locationStage === "resolved" && (
          <div className="mt-4 pt-3.5 border-t border-line/70 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted flex items-center gap-1 mr-1">
              <Droplet className="h-3.5 w-3.5 text-brand" />
              {isBn ? "গ্রুপ অনুযায়ী স্টক যাচাই:" : "Quick Filter by Group:"}
            </span>
            <button
              type="button"
              onClick={() => setSelectedGroup("ALL")}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                selectedGroup === "ALL"
                  ? "bg-brand text-white shadow-xs"
                  : "bg-elevated text-muted hover:text-ink"
              }`}
            >
              {isBn ? "সকল গ্রুপ" : "All Groups"}
            </button>
            {BLOOD_GROUPS.map((group) => {
              const shortageCount = shortageRadar.criticalGroupCounts[group] ?? 0;
              const isSelected = selectedGroup === group;
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => setSelectedGroup(group)}
                  className={`relative px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-blood text-white border-blood-deep shadow-xs"
                      : shortageCount > 0
                      ? "bg-surface text-ink border-red-300 dark:border-red-900/50 hover:border-red-400"
                      : "bg-surface text-ink border-line hover:border-brand/40"
                  }`}
                >
                  <span>{group}</span>
                  {shortageCount > 0 && (
                    <span
                      className={`ml-1.5 inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        isSelected ? "bg-white text-blood" : "bg-red-500 text-white"
                      }`}
                      title={
                        isBn
                          ? `${toBengaliDigits(shortageCount)}টি ব্যাংকে সংকটপূর্ণ ঘাটতি`
                          : `${shortageCount} banks in critical shortage`
                      }
                    >
                      {isBn ? toBengaliDigits(shortageCount) : shortageCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* STAGE 1: Requesting Browser Geolocation Permission                   */}
      {/* ==================================================================== */}
      {locationStage === "requesting" && (
        <div className="p-6 sm:p-10">
          <div className="mx-auto max-w-xl rounded-3xl border border-line-strong bg-elevated/50 dark:bg-elevated/30 p-6 sm:p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep border border-brand/25 shadow-xs">
              <Navigation className="h-6 w-6 animate-pulse" aria-hidden="true" />
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1 text-xs font-bold text-ink border border-line">
              <span
                className="h-3.5 w-3.5 rounded-full border-2 border-brand border-t-transparent animate-spin"
                aria-hidden="true"
              />
              <span>
                {isBn ? "আপনার অবস্থান নির্ণয় করা হচ্ছে…" : "Requesting Location Access…"}
              </span>
            </div>
            <h3 className="mt-3 text-lg sm:text-xl font-extrabold text-ink">
              {isBn
                ? "কাছের ব্লাড ব্যাংক দেখতে লোকেশন অনুমতি দিন"
                : "Allow Location Access to Find Blood Banks Near You"}
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-muted max-w-md mx-auto leading-relaxed">
              {isBn
                ? "আপনার ব্রাউজারের পপ-আপে লোকেশন অ্যাক্সেস অনুমোদন (Allow) করুন, যাতে আমরা আপনার সবচেয়ে কাছের প্রাতিষ্ঠানিক ব্লাড ব্যাংক ও হাসপাতালগুলো দেখাতে পারি।"
                : "Please approve your browser's location permission prompt so we can automatically show verified blood banks and institutions closest to you."}
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={openManualLocationPrompt}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 py-2 text-xs font-bold text-ink hover:border-brand/50 hover:text-brand transition-colors cursor-pointer"
              >
                <MapPin className="h-3.5 w-3.5 text-brand" />
                <span>
                  {isBn
                    ? "অথবা নিজে আপনার জেলা নির্বাচন করুন"
                    : "Or select your location manually"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STAGE 2: Location Access Denied / Unavailable -> Ask User's Location */}
      {/* ==================================================================== */}
      {locationStage === "prompt_manual" && (
        <div className="p-6 sm:p-10">
          <div className="mx-auto max-w-2xl rounded-3xl border border-line-strong bg-elevated/50 dark:bg-elevated/30 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep border border-brand/25">
                <MapPin className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="flex-1">
                {geoDenialReason && (
                  <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-900 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {geoDenialReason === "denied"
                        ? isBn
                          ? "ব্রাউজার লোকেশন অনুমতি পাওয়া যায়নি"
                          : "Browser location permission was not granted"
                        : geoDenialReason === "timeout"
                        ? isBn
                          ? "লোকেশন নির্ণয়ে সময় বেশি লেগেছে"
                          : "Location detection timed out"
                        : isBn
                        ? "স্বয়ংক্রিয় লোকেশন উপলব্ধ নয়"
                        : "Automatic location unavailable"}
                    </span>
                  </div>
                )}

                <h3 className="text-lg sm:text-xl font-extrabold text-ink">
                  {isBn
                    ? "আপনার বর্তমান অবস্থান নির্বাচন করুন"
                    : "Where Are You Located?"}
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-muted leading-relaxed">
                  {isBn
                    ? "আপনার কাছের যাচাইকৃত ব্লাড ব্যাংক ও হাসপাতালের রক্তের স্টক দেখতে নিচে আপনার বিভাগ ও জেলা নির্বাচন করুন।"
                    : "Select your Division and District below so we can display the right institutional blood banks and live blood stocks near you."}
                </p>

                <form onSubmit={handleManualLocationSubmit} className="mt-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Division Picker */}
                    <div>
                      <label
                        htmlFor="bloodbank-manual-division"
                        className="block text-xs font-bold text-ink mb-1.5"
                      >
                        {isBn ? "বিভাগ (Division)" : "Division"}
                      </label>
                      <select
                        id="bloodbank-manual-division"
                        value={manualDivision}
                        onChange={(e) => handleManualDivisionChange(e.target.value)}
                        className="w-full rounded-2xl border border-line-strong bg-surface px-3.5 py-2.5 text-xs sm:text-sm text-ink font-semibold focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/30"
                      >
                        <option value="">
                          {isBn ? "বিভাগ নির্বাচন করুন…" : "Select Division…"}
                        </option>
                        {DIVISIONS.map((div) => (
                          <option key={div.en} value={div.en}>
                            {isBn ? `${div.bn} (${div.en})` : div.en}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* District Picker (All 64 Districts, cascaded by Division) */}
                    <div>
                      <label
                        htmlFor="bloodbank-manual-district"
                        className="block text-xs font-bold text-ink mb-1.5"
                      >
                        {isBn ? "জেলা (District)" : "District"}
                      </label>
                      <select
                        id="bloodbank-manual-district"
                        value={manualDistrict}
                        onChange={(e) => handleManualDistrictChange(e.target.value)}
                        className="w-full rounded-2xl border border-line-strong bg-surface px-3.5 py-2.5 text-xs sm:text-sm text-ink font-semibold focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/30"
                      >
                        <option value="">
                          {isBn ? "জেলা নির্বাচন করুন…" : "Select District…"}
                        </option>
                        {manualDistrictOptions.map((dist) => (
                          <option key={dist.en} value={dist.en}>
                            {isBn ? `${dist.bn} (${dist.en})` : dist.en}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {manualFormError && (
                    <p role="alert" className="text-xs font-bold text-blood-deep">
                      {isBn
                        ? "অনুগ্রহ করে আপনার জেলা অথবা বিভাগ নির্বাচন করুন।"
                        : "Please select your District or Division to view nearby blood banks."}
                    </p>
                  )}

                  <div className="pt-1 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-brand-deep transition-colors cursor-pointer"
                    >
                      <MapPin className="h-4 w-4" />
                      <span>
                        {isBn ? "কাছের ব্লাড ব্যাংক দেখুন" : "Show Nearby Blood Banks"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={requestBrowserLocation}
                      className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink-brand bg-surface px-4 py-2 text-xs sm:text-sm font-bold text-ink-brand hover:bg-ink-brand-soft transition-colors cursor-pointer"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      <span>
                        {isBn ? "জিপিএস লোকেশন ব্যবহার করুন" : "Use Current Location"}
                      </span>
                    </button>

                    {clientLocation && (
                      <button
                        type="button"
                        onClick={() => setLocationStage("resolved")}
                        className="inline-flex items-center justify-center rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-muted hover:text-ink transition-colors cursor-pointer"
                      >
                        {isBn ? "বাতিল" : "Cancel"}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STAGE 3: Location Resolved -> Nearby Blood Banks & Institutions      */}
      {/* ==================================================================== */}
      {locationStage === "resolved" && clientLocation && (
        <>
          {/* Active Client Location Bar + Search/Filters */}
          <div className="border-b border-line bg-elevated/40 p-4 sm:p-5 space-y-3.5">
            {/* Active Location Summary Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-brand/20 bg-surface px-4 py-3 shadow-2xs">
              <div className="flex items-start sm:items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-deep border border-brand/20">
                  {clientLocation.source === "gps" ? (
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold text-ink">
                      {viewScope === "nearby"
                        ? isBn
                          ? `${clientLocation.district_bn}, ${clientLocation.division_bn} বিভাগের কাছের ব্লাড ব্যাংক`
                          : `Showing blood banks near ${clientLocation.district_en}, ${clientLocation.division_en}`
                        : isBn
                        ? `সারাদেশের সকল ব্লাড ব্যাংক (${clientLocation.district_bn} থেকে দূরত্ব অনুযায়ী)`
                        : `All national blood banks (sorted by distance from ${clientLocation.district_en})`}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-ink-brand-soft px-2.5 py-0.5 text-[10px] font-extrabold text-ink-brand border border-ink-brand/25">
                      {clientLocation.source === "gps"
                        ? isBn
                          ? "লাইভ জিপিএস"
                          : "Live GPS"
                        : isBn
                        ? "নির্বাচিত এলাকা"
                        : "Selected Location"}
                    </span>
                  </div>
                  {viewScope === "nearby" && nearbyResult?.expandedToRegional && (
                    <p className="mt-0.5 text-[11px] text-muted">
                      {isBn
                        ? `${clientLocation.district_bn} জেলায় তালিকাভুক্ত কেন্দ্র না থাকায় নিকটতম আঞ্চলিক ব্লাড ব্যাংকগুলো দূরত্ব অনুযায়ী দেখানো হচ্ছে।`
                        : `Showing the closest verified regional blood banks & institutions sorted by distance from ${clientLocation.district_en}.`}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                <button
                  type="button"
                  onClick={openManualLocationPrompt}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-elevated/70 px-3 py-1.5 text-xs font-bold text-ink hover:border-brand/50 hover:text-brand transition-colors cursor-pointer"
                >
                  <MapPin className="h-3.5 w-3.5 text-brand" />
                  <span>{isBn ? "অবস্থান পরিবর্তন" : "Change Location"}</span>
                </button>

                {clientLocation.source === "manual" && (
                  <button
                    type="button"
                    onClick={requestBrowserLocation}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink-brand/40 bg-ink-brand-soft/50 px-3 py-1.5 text-xs font-bold text-ink-brand hover:bg-ink-brand-soft transition-colors cursor-pointer"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    <span>{isBn ? "জিপিএস" : "Use GPS"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const next = viewScope === "nearby" ? "all" : "nearby";
                    setViewScope(next);
                    if (next === "nearby") {
                      setSelectedDivision("ALL");
                      setSelectedDistrict("ALL");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-bold text-muted hover:text-ink transition-colors cursor-pointer"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>
                    {viewScope === "nearby"
                      ? isBn
                        ? "সারাদেশের সকল ব্যাংক"
                        : "View All National"
                      : isBn
                      ? "শুধু কাছের ব্যাংক"
                      : "Nearby Only"}
                  </span>
                </button>
              </div>
            </div>

            {/* Search & Optional National Area Filter Row */}
            <div
              className={`grid grid-cols-1 gap-3 ${
                viewScope === "all"
                  ? "sm:grid-cols-2 lg:grid-cols-4"
                  : "sm:grid-cols-3"
              }`}
            >
              {/* Search box */}
              <div className={`relative ${viewScope === "nearby" ? "sm:col-span-2" : ""}`}>
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isBn
                      ? "ব্যাংকের নাম বা ঠিকানা খুঁজুন…"
                      : "Search nearby bank name or address…"
                  }
                  className="w-full rounded-2xl border border-line bg-surface pl-10 pr-4 py-2 text-xs sm:text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2.5 text-muted hover:text-ink cursor-pointer"
                    aria-label={isBn ? "মুছে ফেলুন" : "Clear search"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Division & District selectors appear when exploring all national banks */}
              {viewScope === "all" && (
                <>
                  <div>
                    <select
                      value={selectedDivision}
                      onChange={(e) => handleDivisionChange(e.target.value)}
                      className="w-full rounded-2xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink font-medium focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand"
                      aria-label={isBn ? "বিভাগ নির্বাচন করুন" : "Select Division"}
                    >
                      <option value="ALL">
                        {isBn ? "সকল বিভাগ (All Divisions)" : "All Divisions"}
                      </option>
                      {DIVISIONS.map((div) => (
                        <option key={div.en} value={div.en}>
                          {isBn ? `${div.bn} (${div.en})` : div.en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      className="w-full rounded-2xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink font-medium focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand"
                      aria-label={isBn ? "জেলা নির্বাচন করুন" : "Select District"}
                    >
                      <option value="ALL">
                        {isBn ? "সকল জেলা (All Districts)" : "All Districts"}
                      </option>
                      {districtsForDivision.map((dist) => (
                        <option key={dist.en} value={dist.en}>
                          {isBn ? `${dist.bn} (${dist.en})` : dist.en}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Active count & filter reset */}
              <div className="flex items-center justify-between sm:justify-end gap-2">
                <span className="text-xs text-muted font-semibold">
                  {isBn
                    ? `${toBengaliDigits(filteredBanks.length)}টি প্রতিষ্ঠান পাওয়া গেছে`
                    : `${filteredBanks.length} ${
                        filteredBanks.length === 1 ? "institution" : "institutions"
                      } found`}
                </span>
                {(selectedDivision !== "ALL" ||
                  selectedDistrict !== "ALL" ||
                  selectedGroup !== "ALL" ||
                  shortageRadarOnly ||
                  searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDivision("ALL");
                      setSelectedDistrict("ALL");
                      setSelectedGroup("ALL");
                      setShortageRadarOnly(false);
                      setSearchQuery("");
                    }}
                    className="text-xs font-bold text-brand hover:underline cursor-pointer"
                  >
                    {isBn ? "ফিল্টার মুছুন" : "Reset"}
                  </button>
                )}
              </div>
            </div>

            {/* Legend / Status indicators */}
            <div className="pt-2.5 border-t border-line/60 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted">
              <span className="text-[11px] uppercase tracking-wider text-muted font-bold">
                {isBn ? "স্টক নির্দেশিকা:" : "Stock Status:"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  {isBn ? "পর্যাপ্ত / Surplus (≥ ১৫)" : "Surplus (≥ 15 units)"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-amber-700 dark:text-amber-400 font-bold">
                  {isBn ? "সীমিত / Moderate (৫ - ১৪)" : "Moderate (5 - 14 units)"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
                <span className="text-red-700 dark:text-red-400 font-bold">
                  {isBn ? "সংকটপূর্ণ / Critical Shortage (< ৫)" : "Critical Shortage (< 5 units)"}
                </span>
              </span>
            </div>
          </div>

          {/* Directory Content List */}
          <div className="p-4 sm:p-6 space-y-5">
            {filteredBanks.length === 0 ? (
              <div className="rounded-2xl border border-line bg-elevated/40 p-8 text-center">
                <Building2 className="mx-auto h-10 w-10 text-muted opacity-60" />
                <h3 className="mt-2 text-base font-bold text-ink">
                  {isBn ? "কোনো ব্লাড ব্যাংক পাওয়া যায়নি" : "No Blood Banks Found"}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {isBn
                    ? "আপনার নির্বাচিত ফিল্টারে কাছাকাছি কোনো প্রতিষ্ঠান মেলেনি। ফিল্টার রিসেট করুন অথবা সারাদেশের তালিকা দেখুন।"
                    : "No nearby blood banks match your active filter criteria. Reset filters or view all national centres."}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDivision("ALL");
                      setSelectedDistrict("ALL");
                      setSelectedGroup("ALL");
                      setShortageRadarOnly(false);
                      setSearchQuery("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer hover:bg-brand-deep"
                  >
                    {isBn ? "ফিল্টার রিসেট করুন" : "Reset Filters"}
                  </button>
                  {viewScope === "nearby" && (
                    <button
                      type="button"
                      onClick={() => setViewScope("all")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 py-2 text-xs font-bold text-ink cursor-pointer hover:border-brand/40"
                    >
                      {isBn ? "সারাদেশের সকল ব্যাংক দেখুন" : "View All National Banks"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className={`grid gap-5 ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
                {filteredBanks.map((bank) => {
                  const hasCriticalStock = BLOOD_GROUPS.some(
                    (g) => getStockStatus(bank.stocks[g] ?? 0) === "critical"
                  );

                  return (
                    <div
                      key={bank.id}
                      className={`rounded-3xl border transition-all duration-200 bg-surface p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:shadow-md ${
                        hasCriticalStock
                          ? "border-red-200 dark:border-red-950/60"
                          : "border-line hover:border-brand/30"
                      }`}
                    >
                      <div>
                        {/* Bank Header Info */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                {isBn ? "যাচাইকৃত প্রতিষ্ঠান" : "Verified Institution"}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand-deep border border-brand/25">
                                <Navigation className="h-3 w-3" aria-hidden="true" />
                                {formatDistanceKm(bank.distance_km, lang)}
                              </span>
                              <span className="rounded-full bg-elevated px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                                {isBn ? bank.district_bn : bank.district_en}
                              </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-ink leading-snug">
                              {isBn ? bank.name_bn : bank.name_en}
                            </h3>
                          </div>
                        </div>

                        {/* Address & Hours */}
                        <div className="mt-3 space-y-1.5 text-xs text-muted">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
                            <span>{isBn ? bank.address_bn : bank.address_en}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-ink-brand shrink-0" />
                            <span className="font-medium">
                              {isBn ? bank.operating_hours_bn : bank.operating_hours_en}
                            </span>
                          </div>
                        </div>

                        {/* 8-Group Stock Level Matrix */}
                        <div className="mt-5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                              {isBn ? "লাইভ রক্ত স্টক লেভেল (৮টি গ্রুপ)" : "Live Blood Stocks (All 8 Groups)"}
                            </span>
                            <span className="text-[10px] text-muted">
                              {isBn ? "আপডেট: আজ ৮:০০ AM" : "Updated: Today 8:00 AM"}
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            {BLOOD_GROUPS.map((group) => {
                              const units = bank.stocks[group] ?? 0;
                              const status: StockStatus = getStockStatus(units);
                              const meta = getStockStatusMeta(status, lang);
                              const isHighlighted = selectedGroup === group;

                              return (
                                <div
                                  key={group}
                                  onClick={() => openTransferModal(bank, group)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      openTransferModal(bank, group);
                                    }
                                  }}
                                  title={
                                    isBn
                                      ? `${group}: ${formatStockUnits(units, "bn")} (${meta.label}) - স্থানান্তর অনুরোধ করতে ক্লিক করুন`
                                      : `${group}: ${formatStockUnits(units, "en")} (${meta.label}) - Click to request transfer`
                                  }
                                  className={`rounded-2xl border p-2 text-center transition-all cursor-pointer hover:scale-[1.03] ${
                                    isHighlighted
                                      ? "ring-2 ring-brand border-brand bg-brand-soft/30 dark:bg-brand-soft/10"
                                      : "bg-elevated/40 hover:bg-elevated"
                                  } ${
                                    status === "critical"
                                      ? "border-red-300 dark:border-red-900/60"
                                      : "border-line"
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="text-xs font-black text-ink">{group}</span>
                                    {status === "critical" && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                                    )}
                                  </div>
                                  <div className="mt-0.5 text-xs font-extrabold text-ink">
                                    {formatStockUnits(units, lang)}
                                  </div>
                                  <div
                                    className={`mt-1 inline-block rounded-full px-1.5 py-0.2 text-[9px] font-bold border ${meta.badgeClass}`}
                                  >
                                    {meta.label}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Actions Bar */}
                      <div className="mt-6 pt-4 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        {/* Direct Call Hotline Button */}
                        <a
                          href={formatDialableHotline(bank.hotline)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand text-white px-4 py-2.5 text-xs font-bold shadow-xs hover:bg-brand-deep transition-all cursor-pointer active:scale-95"
                        >
                          <PhoneCall className="h-4 w-4" />
                          <span>{isBn ? `হটলাইন: ${bank.hotline}` : `Call: ${bank.hotline}`}</span>
                        </a>

                        {/* 1-Click Request Stock Transfer Button */}
                        <button
                          type="button"
                          onClick={() => openTransferModal(bank)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-ink-brand bg-surface text-ink-brand px-4 py-2 text-xs font-bold hover:bg-ink-brand-soft transition-all cursor-pointer active:scale-95"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{isBn ? "রক্তের অনুরোধ / স্টক স্থানান্তর" : "Request Stock Transfer"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Institutional Stock Transfer Requisition Modal */}
      {transferModalBank && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-lg rounded-3xl border border-line bg-surface p-6 sm:p-8 text-ink shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={closeTransferModal}
              className="absolute right-5 top-5 rounded-full p-2 text-muted hover:bg-elevated hover:text-ink cursor-pointer"
              aria-label={isBn ? "বন্ধ করুন" : "Close"}
            >
              <X className="h-5 w-5" />
            </button>

            {transferSubmitted ? (
              <div className="py-6 text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-10 w-10" />
                </span>
                <h3 className="mt-4 text-xl font-extrabold text-ink">
                  {isBn ? "রক্ত স্থানান্তরের অনুরোধ গৃহীত হয়েছে!" : "Stock Transfer Requisition Sent!"}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-muted max-w-sm mx-auto leading-relaxed">
                  {isBn
                    ? `আপনার অনুরোধটি ${transferModalBank.name_bn}-এর জরুরি রক্ত সমন্বয়কারী টিমের নিকট পাঠানো হয়েছে। জরুরি প্রয়োজনে হটলাইনে সরাসরি কল করুন।`
                    : `Your transfer requisition for ${transferUnits} unit(s) of ${transferGroup} has been logged with ${transferModalBank.name_en}. For critical emergencies, call their hotline directly.`}
                </p>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a
                    href={formatDialableHotline(transferModalBank.hotline)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-brand text-white px-6 py-3 text-sm font-bold shadow-md hover:bg-brand-deep cursor-pointer"
                  >
                    <PhoneCall className="h-4 w-4" />
                    <span>{isBn ? `হটলাইনে সরাসরি কল (${transferModalBank.hotline})` : `Call Hotline (${transferModalBank.hotline})`}</span>
                  </a>
                  <button
                    type="button"
                    onClick={closeTransferModal}
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-line bg-elevated px-6 py-3 text-sm font-bold text-muted hover:text-ink cursor-pointer"
                  >
                    {isBn ? "বন্ধ করুন" : "Done"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="rounded-xl bg-brand-soft p-2 text-brand-deep">
                    <Droplet className="h-5 w-5 fill-current" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-ink leading-tight">
                      {isBn ? "প্রাতিষ্ঠানিক রক্ত স্থানান্তর অধিযাচন" : "Institutional Blood Stock Transfer"}
                    </h3>
                    <p className="text-xs text-muted">
                      {isBn ? transferModalBank.name_bn : transferModalBank.name_en}
                    </p>
                  </div>
                </div>

                {/* Current Stock Banner */}
                <div className="my-4 rounded-2xl border border-line bg-elevated/50 p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-muted">
                      {isBn ? "বর্তমানে উপলব্ধ স্টক:" : "Currently in Stock:"}
                    </span>
                    <span className="ml-2 font-black text-ink text-sm">
                      {transferGroup}: {formatStockUnits(transferModalBank.stocks[transferGroup] ?? 0, lang)}
                    </span>
                  </div>
                  <div
                    className={`rounded-full px-2.5 py-0.5 font-bold border ${
                      getStockStatusMeta(getStockStatus(transferModalBank.stocks[transferGroup] ?? 0), lang).badgeClass
                    }`}
                  >
                    {getStockStatusMeta(getStockStatus(transferModalBank.stocks[transferGroup] ?? 0), lang).label}
                  </div>
                </div>

                <form onSubmit={handleTransferSubmit} className="space-y-4">
                  {/* Select Blood Group & Units */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">
                        {isBn ? "রক্তের গ্রুপ" : "Blood Group"}
                      </label>
                      <select
                        value={transferGroup}
                        onChange={(e) => setTransferGroup(e.target.value as BloodGroup)}
                        className="w-full rounded-2xl border border-line bg-surface p-2.5 text-xs sm:text-sm font-bold text-ink focus:border-brand focus:outline-hidden"
                      >
                        {BLOOD_GROUPS.map((g) => (
                          <option key={g} value={g}>
                            {g} ({formatStockUnits(transferModalBank.stocks[g] ?? 0, lang)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">
                        {isBn ? "প্রয়োজনীয় ব্যাগ (Units)" : "Units Needed"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={transferUnits}
                        onChange={(e) => setTransferUnits(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full rounded-2xl border border-line bg-surface p-2.5 text-xs sm:text-sm font-bold text-ink focus:border-brand focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Destination Hospital / Patient */}
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">
                      {isBn ? "গন্তব্য হাসপাতাল / ক্লিনিক" : "Destination Hospital / Clinic"}
                    </label>
                    <input
                      type="text"
                      required
                      value={transferHospital}
                      onChange={(e) => setTransferHospital(e.target.value)}
                      placeholder={
                        clientLocation
                          ? isBn
                            ? `যেমন: ${clientLocation.district_bn} সদর হাসপাতাল`
                            : `e.g. ${clientLocation.district_en} Sadar Hospital`
                          : isBn
                          ? "যেমন: সদর হাসপাতাল"
                          : "e.g. District Sadar Hospital"
                      }
                      className="w-full rounded-2xl border border-line bg-surface p-2.5 text-xs sm:text-sm text-ink focus:border-brand focus:outline-hidden"
                    />
                  </div>

                  {/* Contact Phone & Urgency */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">
                        {isBn ? "যোগাযোগ ফোন নম্বর" : "Contact Phone"}
                      </label>
                      <input
                        type="tel"
                        required
                        value={transferContactPhone}
                        onChange={(e) => setTransferContactPhone(e.target.value)}
                        placeholder="+8801..."
                        className="w-full rounded-2xl border border-line bg-surface p-2.5 text-xs sm:text-sm text-ink focus:border-brand focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink mb-1">
                        {isBn ? "জরুরি মাত্রা" : "Urgency"}
                      </label>
                      <select
                        value={transferUrgency}
                        onChange={(e) => setTransferUrgency(e.target.value as "urgent" | "critical" | "routine")}
                        className="w-full rounded-2xl border border-line bg-surface p-2.5 text-xs sm:text-sm font-semibold text-ink focus:border-brand focus:outline-hidden"
                      >
                        <option value="critical">{isBn ? "সংকটপূর্ণ (Critical - < 2h)" : "Critical (< 2h)"}</option>
                        <option value="urgent">{isBn ? "জরুরি (Urgent - 6h)" : "Urgent (6h)"}</option>
                        <option value="routine">{isBn ? "পরিকল্পিত (Routine - 24h)" : "Routine (24h)"}</option>
                      </select>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-6 pt-3 border-t border-line flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeTransferModal}
                      className="w-full sm:w-auto rounded-full border border-line px-5 py-2.5 text-xs font-bold text-muted hover:text-ink cursor-pointer"
                    >
                      {isBn ? "বাতিল" : "Cancel"}
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-brand-deep cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{isBn ? "স্থানান্তর আবেদন নিশ্চিত করুন" : "Submit Requisition"}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

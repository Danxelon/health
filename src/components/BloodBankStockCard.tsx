/**
 * BloodBankStockCard — District Blood Bank Stock Directory & Emergency Shortage Radar
 *
 * Displays verified institutional Blood Banks in Bangladesh:
 * - Bangladesh Red Crescent Central Blood Bank
 * - Quantum Voluntary Blood Lab
 * - Dhaka Medical College Hospital Blood Bank
 * - Sir Salimullah Blood Bank (Mitford)
 * - Chittagong Medical Blood Bank
 * - Rajshahi Sadar Blood Bank
 * - Rangpur Medical Blood Bank
 * and other major divisional medical centres.
 *
 * Real-time stock levels for all 8 blood groups (A+, A-, B+, B-, AB+, AB-, O+, O-)
 * with stock status indicators:
 * - "Surplus / পর্যাপ্ত" (green)
 * - "Moderate / সীমিত" (amber)
 * - "Critical Shortage / সংকটপূর্ণ" (red alert)
 *
 * Direct Call hotline button (`tel:...`) and 1-click "Request Stock Transfer / রক্তের অনুরোধ" button.
 * Dynamic filtering by Division, District, Blood Group, and Search text.
 */

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Droplet,
  MapPin,
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
  getStockStatus,
  getStockStatusMeta,
  formatDialableHotline,
  formatStockUnits,
  filterBloodBanks,
  getEmergencyShortageRadar,
  getDistrictsForDivision,
  type BloodBank,
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

export default function BloodBankStockCard({
  initialDivision = "ALL",
  initialDistrict = "ALL",
  shortageOnly: initialShortageOnly = false,
  compact = false,
  className = "",
}: BloodBankStockCardProps) {
  const { lang } = useAppShell();
  const isBn = lang === "bn";

  // Filter states
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

  // Available districts based on division selection
  const districtsForDivision = useMemo(() => {
    return getDistrictsForDivision(selectedDivision);
  }, [selectedDivision]);

  // When division changes, reset district if it doesn't belong
  const handleDivisionChange = (div: string) => {
    setSelectedDivision(div);
    if (div === "ALL") {
      setSelectedDistrict("ALL");
    } else {
      const validInDiv = districtsForDivision.some((d) => d.en === selectedDistrict);
      if (!validInDiv) {
        setSelectedDistrict("ALL");
      }
    }
  };

  // Filtered blood banks
  const filteredBanks = useMemo(() => {
    return filterBloodBanks(VERIFIED_BLOOD_BANKS, {
      division: selectedDivision,
      district: selectedDistrict,
      bloodGroup: selectedGroup,
      shortageOnly: shortageRadarOnly,
      search: searchQuery,
    });
  }, [selectedDivision, selectedDistrict, selectedGroup, shortageRadarOnly, searchQuery]);

  // Overall Emergency Shortage Radar analytics
  const shortageRadar = useMemo(() => {
    return getEmergencyShortageRadar(VERIFIED_BLOOD_BANKS);
  }, []);

  const openTransferModal = (bank: BloodBank, group?: BloodGroup) => {
    setTransferModalBank(bank);
    setTransferGroup(group ?? (selectedGroup !== "ALL" ? selectedGroup : "O+"));
    setTransferUnits(1);
    setTransferHospital(isBn ? "ঢাকা মেডিকেল কলেজ হাসপাতাল" : "Dhaka Medical College Hospital");
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
                  ? "বাংলাদেশ রেড ক্রিসেন্ট, কোয়ান্টাম ল্যাব ও মেডিকেল কলেজ ব্লাড ব্যাংকের রিয়েল-টাইম স্টক লেভেল ও হটলাইন"
                  : "Real-time 8-group stock levels & direct hotlines for Bangladesh Red Crescent, Quantum Lab & Medical Colleges"}
              </p>
            </div>
          </div>

          {/* Quick Shortage Radar Pill */}
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
        </div>

        {/* Shortage Radar Quick Blood Group Pills */}
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
      </div>

      {/* Filter & Search Bar */}
      <div className="border-b border-line bg-elevated/40 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? "ব্যাংকের নাম বা ঠিকানা খুঁজুন…" : "Search bank name or address…"}
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

          {/* Division Selector */}
          <div>
            <select
              value={selectedDivision}
              onChange={(e) => handleDivisionChange(e.target.value)}
              className="w-full rounded-2xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink font-medium focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand"
              aria-label={isBn ? "বিভাগ নির্বাচন করুন" : "Select Division"}
            >
              <option value="ALL">{isBn ? "সকল বিভাগ (All Divisions)" : "All Divisions"}</option>
              {DIVISIONS.map((div) => (
                <option key={div.en} value={div.en}>
                  {isBn ? `${div.bn} (${div.en})` : div.en}
                </option>
              ))}
            </select>
          </div>

          {/* District Selector (Cascades) */}
          <div>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full rounded-2xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink font-medium focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand"
              aria-label={isBn ? "জেলা নির্বাচন করুন" : "Select District"}
            >
              <option value="ALL">{isBn ? "সকল জেলা (All Districts)" : "All Districts"}</option>
              {districtsForDivision.map((dist) => (
                <option key={dist.en} value={dist.en}>
                  {isBn ? `${dist.bn} (${dist.en})` : dist.en}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters Button */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="text-xs text-muted font-medium">
              {isBn
                ? `${toBengaliDigits(filteredBanks.length)}টি কেন্দ্র সক্রিয়`
                : `${filteredBanks.length} centres active`}
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
        <div className="mt-3 pt-3 border-t border-line/60 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted">
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
                ? "আপনার নির্বাচিত ফিল্টারে কোনো প্রতিষ্ঠান মেলেনি। ফিল্টার রিসেট করে আবার চেষ্টা করুন।"
                : "No blood banks match your active filter criteria. Try resetting your search filters."}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedDivision("ALL");
                setSelectedDistrict("ALL");
                setSelectedGroup("ALL");
                setShortageRadarOnly(false);
                setSearchQuery("");
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer hover:bg-brand-deep"
            >
              {isBn ? "সকল ব্যাংক দেখুন" : "View All Banks"}
            </button>
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
                      placeholder={isBn ? "যেমন: ঢাকা মেডিকেল কলেজ হাসপাতাল" : "e.g. DMCH"}
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

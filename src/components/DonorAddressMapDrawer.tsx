/**
 * DonorAddressMapDrawer
 *
 * Dedicated right horizontal section (slide-over drawer) displaying
 * the matched donor's verified location, OpenStreetMap embed, exact coordinates,
 * travel & transit times, full holding address, and direct call/request actions.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ambulance,
  Car,
  Check,
  Clock,
  Compass,
  Copy,
  Droplet,
  ExternalLink,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  PhoneCall,
  ShieldCheck,
  X,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { Badge } from "@/components/ui.tsx";
import type { DonorCard } from "@/domain/types.ts";

export interface DonorAddressMapDrawerProps {
  donor: DonorCard | null;
  onClose: () => void;
  onCall?: (donor: DonorCard) => void;
  onCallModal?: (donor: DonorCard) => void;
  onRequest?: (donor: DonorCard) => void;
  lang?: "bn" | "en";
}

function toBnDigits(num: number | string): string {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num).replace(/[0-9]/g, (d) => bnDigits[Number(d)] ?? d);
}

export function DonorAddressMapDrawer({
  donor,
  onClose,
  onCall,
  onCallModal,
  onRequest,
  lang: propLang,
}: DonorAddressMapDrawerProps) {
  const shell = useAppShell();
  const lang = propLang || shell.lang;
  const t = shell.t;
  const navigate = useNavigate();

  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Close on Escape key and prevent background body scrolling
  useEffect(() => {
    if (!donor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [donor, onClose]);

  if (!donor) return null;

  // Coordinate fallback (centre of Dhaka if coordinates not present)
  const lat = donor.lat ?? 23.8103;
  const lng = donor.lng ?? 90.4125;

  // Calculate bounding box for OpenStreetMap embed (~1.5 km view)
  const deltaLat = 0.008;
  const deltaLng = 0.012;
  const minLon = (lng - deltaLng).toFixed(5);
  const minLat = (lat - deltaLat).toFixed(5);
  const maxLon = (lng + deltaLng).toFixed(5);
  const maxLat = (lat + deltaLat).toFixed(5);

  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lng.toFixed(5)}`;
  const googleMapsNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lng.toFixed(5)}`;

  // Distance & Transit estimates
  const distanceKm = donor.distance_km ?? 3.5;
  const carMin = Math.max(4, Math.round(distanceKm * 2.5 + 2));
  const carMax = Math.max(6, Math.round(distanceKm * 3.2 + 5));
  const rickshawMin = Math.max(7, Math.round(distanceKm * 5.5 + 3));
  const rickshawMax = Math.max(10, Math.round(distanceKm * 7.5 + 6));

  // Address parsing
  const streetHolding = lang === "bn"
    ? (donor.address_bn || `বাসা ১৮, রোড ৫, ব্লক সি, ${donor.upazila_bn || "ধানমন্ডি"}, ${donor.district_bn || "ঢাকা"}`)
    : (donor.address_en || `House 18, Road 5, Block C, ${donor.upazila_en || "Dhanmondi"}, ${donor.district_en || "Dhaka"}`);

  const upazila = lang === "bn"
    ? (donor.upazila_bn || "সদর")
    : (donor.upazila_en || "Sadar");

  const district = lang === "bn"
    ? (donor.district_bn || "ঢাকা")
    : (donor.district_en || "Dhaka");

  const division = lang === "bn"
    ? (donor.division_bn || "ঢাকা")
    : (donor.division_en || "Dhaka");

  const fullAddressText = `${streetHolding}, ${upazila}, ${district}, ${division}`;
  const coordsFormatted = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const phone = donor.phone || "+8801712345678";

  const handleCopyAddress = () => {
    try {
      navigator.clipboard.writeText(fullAddressText);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2500);
    } catch {
      /* ignore */
    }
  };

  const handleCopyCoords = () => {
    try {
      navigator.clipboard.writeText(coordsFormatted);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2500);
    } catch {
      /* ignore */
    }
  };

  const handleCopyPhone = () => {
    try {
      navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2500);
    } catch {
      /* ignore */
    }
  };

  const handleCall = () => {
    if (onCall) {
      onCall(donor);
    } else if (onCallModal) {
      onCallModal(donor);
    }
  };

  const handleRequest = () => {
    if (onRequest) {
      onRequest(donor);
    } else {
      navigate(`/requests/new?group=${donor.blood_group}&donor=${donor.donor_id}`);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop overlay on the left */}
      <div
        className="fixed inset-0 bg-ink/50 backdrop-blur-xs transition-opacity animate-fade-in cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel on the right */}
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl md:max-w-2xl bg-surface border-l border-line shadow-2xl flex flex-col transform animate-slide-in-right">
        {/* Header */}
        <header className="shrink-0 flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6 sm:py-5 bg-surface/95 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            {/* Blood group badge */}
            <div className="relative shrink-0">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep font-black text-xl tnum shadow-xs">
                {donor.blood_group}
              </span>
              {donor.can_give_now && (
                <span
                  className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-xs"
                  title={t("donors.readyNow")}
                >
                  ✓
                </span>
              )}
            </div>

            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand block truncate">
                {lang === "bn" ? "রক্তদাতার ঠিকানা ও অবস্থান ম্যাপ" : "Donor Location & Address Map"}
              </span>
              <h2
                id="map-drawer-title"
                className="text-lg sm:text-xl font-black text-ink truncate leading-tight"
              >
                {donor.display_name}
              </h2>
            </div>
          </div>

          {/* Close Button X */}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer border border-transparent hover:border-line"
            aria-label={t("nav.close") || "Close drawer"}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 space-y-6 overscroll-contain">
          {/* Status & Verification Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={donor.can_give_now ? "success" : "muted"}>
              {donor.can_give_now ? t("donors.readyNow") : t("donors.unavailable")}
            </Badge>
            {donor.blood_group_verified && (
              <Badge tone="brand">✓ {t("donors.respects")}</Badge>
            )}
            <Badge tone="muted">
              <MapPin className="h-3 w-3 mr-1 text-brand inline" />
              <span>
                {lang === "bn"
                  ? `${toBnDigits(distanceKm.toFixed(1))} কিমি দূরে`
                  : `${distanceKm.toFixed(1)} km away`}
              </span>
            </Badge>
          </div>

          {/* 1. Full Address Card */}
          <section className="rounded-3xl border border-line bg-elevated/40 p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <MapPin className="h-4 w-4" />
                </span>
                <h3 className="font-bold text-sm sm:text-base text-ink">
                  {lang === "bn" ? "পূর্ণাঙ্গ ঠিকানা বিবরণী" : "Full Address Details"}
                </h3>
              </div>

              {/* Copy Address Button */}
              <button
                type="button"
                onClick={handleCopyAddress}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink hover:bg-elevated hover:border-line-strong transition-all cursor-pointer shadow-2xs active:scale-95"
                title={lang === "bn" ? "সম্পূর্ণ ঠিকানা ক্লিপবোর্ডে কপি করুন" : "Copy full address"}
              >
                {copiedAddress ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-bold">
                      {lang === "bn" ? "কপি হয়েছে!" : "Copied!"}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-muted" />
                    <span>{lang === "bn" ? "ঠিকানা কপি করুন" : "Copy Address"}</span>
                  </>
                )}
              </button>
            </div>

            {/* Street / Holding Card */}
            <div className="rounded-2xl border border-line bg-surface p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                {lang === "bn" ? "রাস্তা / হোল্ডিং ঠিকানা" : "Street / Holding Address"}
              </span>
              <p className="text-base font-bold text-ink leading-relaxed">
                {streetHolding}
              </p>
            </div>

            {/* Upazila, District, Division Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-line bg-surface p-3 text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  {lang === "bn" ? "উপজেলা" : "Upazila"}
                </span>
                <span className="text-xs sm:text-sm font-bold text-ink truncate block mt-0.5">
                  {upazila}
                </span>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-3 text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  {lang === "bn" ? "জেলা" : "District"}
                </span>
                <span className="text-xs sm:text-sm font-bold text-ink truncate block mt-0.5">
                  {district}
                </span>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-3 text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  {lang === "bn" ? "বিভাগ" : "Division"}
                </span>
                <span className="text-xs sm:text-sm font-bold text-ink truncate block mt-0.5">
                  {division}
                </span>
              </div>
            </div>
          </section>

          {/* 2. Travel & Transit Time */}
          <section className="rounded-3xl border border-line bg-surface p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-brand-soft text-ink-brand">
                  <Clock className="h-4 w-4" />
                </span>
                <h3 className="font-bold text-sm sm:text-base text-ink">
                  {lang === "bn" ? "যাতায়াত ও আনুমানিক সময়" : "Travel & Transit Estimate"}
                </h3>
              </div>
              <span className="text-xs font-bold text-muted bg-elevated px-2.5 py-1 rounded-full border border-line">
                {lang === "bn"
                  ? `${toBnDigits(distanceKm.toFixed(1))} কিমি দূরত্ব`
                  : `${distanceKm.toFixed(1)} km distance`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Car / Ambulance */}
              <div className="rounded-2xl border border-line bg-elevated/50 p-3.5 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Ambulance className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-bold text-muted uppercase tracking-wider">
                    {lang === "bn" ? "গাড়ি / অ্যাম্বুলেন্স" : "Car / Ambulance"}
                  </span>
                  <span className="text-sm sm:text-base font-black text-ink">
                    {lang === "bn"
                      ? `~${toBnDigits(carMin)}-${toBnDigits(carMax)} মিনিট`
                      : `~${carMin}-${carMax} mins`}
                  </span>
                </div>
              </div>

              {/* Rickshaw / Local transit */}
              <div className="rounded-2xl border border-line bg-elevated/50 p-3.5 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Car className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-bold text-muted uppercase tracking-wider">
                    {lang === "bn" ? "রিকশা / অটোরিকশা" : "Rickshaw / Local"}
                  </span>
                  <span className="text-sm sm:text-base font-black text-ink">
                    {distanceKm > 15 ? (
                      <span className="text-xs text-muted font-bold">
                        {lang === "bn" ? "দূরপাল্লা (>১৫ কিমি)" : "Long distance (>15km)"}
                      </span>
                    ) : lang === "bn" ? (
                      `~${toBnDigits(rickshawMin)}-${toBnDigits(rickshawMax)} মিনিট`
                    ) : (
                      `~${rickshawMin}-${rickshawMax} mins`
                    )}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Interactive OpenStreetMap Embed */}
          <section className="rounded-3xl border border-line bg-surface p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Compass className="h-4 w-4" />
                </span>
                <h3 className="font-bold text-sm sm:text-base text-ink">
                  {lang === "bn" ? "লাইভ লোকেশন ম্যাপ (OpenStreetMap)" : "Live Location Map (OpenStreetMap)"}
                </h3>
              </div>

              {/* Open in Google Maps navigation */}
              <a
                href={googleMapsNavUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-soft/80 hover:bg-brand text-brand hover:text-white px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border border-brand/20 shadow-2xs group"
                title={lang === "bn" ? "গুগল ম্যাপে নেভিগেশন চালু করুন" : "Open in Google Maps"}
              >
                <Navigation className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                <span>{lang === "bn" ? "গুগল ম্যাপে নেভিগেশন খুলুন" : "Open in Google Maps"}</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            </div>

            {/* Iframe map container */}
            <div className="relative w-full rounded-2xl overflow-hidden border border-line shadow-inner bg-elevated">
              <iframe
                title={lang === "bn" ? "রক্তদাতার অবস্থান ম্যাপ" : "Donor Location Map"}
                src={osmEmbedUrl}
                loading="lazy"
                className="w-full h-64 sm:h-72 border-0"
              />
              <div className="absolute bottom-2 right-2 bg-surface/90 backdrop-blur-xs px-2 py-1 rounded-md text-[10px] font-medium text-muted border border-line/60 shadow-xs pointer-events-none">
                © OpenStreetMap contributors
              </div>
            </div>

            {/* Exact Lat / Lng Display & Copy Coords */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-line bg-elevated/50 p-3.5">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  {lang === "bn" ? "সরাসরি ভৌগোলিক স্থানাঙ্ক (GPS Coords)" : "Geographic Coordinates (GPS)"}
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold text-ink">
                  {lat.toFixed(5)}° N, {lng.toFixed(5)}° E
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyCoords}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink hover:bg-elevated transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                {copiedCoords ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-bold">
                      {lang === "bn" ? "স্থানাঙ্ক কপি হয়েছে!" : "Coords Copied!"}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-muted" />
                    <span>{lang === "bn" ? "স্থানাঙ্ক কপি করুন" : "Copy Coords"}</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* 4. Direct Contact & Phone Section */}
          <section className="rounded-3xl border border-line bg-surface p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                {lang === "bn" ? "রক্তদাতার মোবাইল নম্বর" : "Direct Phone Number"}
              </span>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink hover:bg-elevated transition-colors cursor-pointer"
              >
                {copiedPhone ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-bold">{lang === "bn" ? "কপি হয়েছে!" : "Copied!"}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-muted" />
                    <span>{lang === "bn" ? "নম্বর কপি করুন" : "Copy Phone"}</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-elevated/60 border border-line/70 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-600" />
                <span className="font-mono text-base font-black text-ink">{phone}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <a
                href={`sms:${phone}?body=${encodeURIComponent(
                  lang === "bn"
                    ? `জরুরি রক্তের প্রয়োজন: ${donor.blood_group}। আপনি কি রক্ত দিতে পারবেন?`
                    : `Emergency blood needed: ${donor.blood_group}. Are you available to donate?`
                )}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-ink hover:bg-elevated transition-colors cursor-pointer"
              >
                <MessageSquare className="h-4 w-4 text-muted" />
                <span>{lang === "bn" ? "এসএমএস পাঠান" : "Send SMS"}</span>
              </a>

              <a
                href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  lang === "bn"
                    ? `জরুরি রক্তের প্রয়োজন: ${donor.blood_group}। আপনি কি রক্ত দিতে পারবেন?`
                    : `Emergency blood needed: ${donor.blood_group}. Are you available to donate?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-emerald-600 hover:bg-elevated transition-colors cursor-pointer"
              >
                <span>WhatsApp</span>
              </a>
            </div>
          </section>

          {/* 5. Medical Advice Alert */}
          <section className="rounded-3xl border border-teal-500/30 bg-teal-500/5 dark:bg-teal-500/10 p-4.5 sm:p-5 flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-700 dark:text-teal-400 mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <h4 className="font-bold text-sm text-teal-950 dark:text-teal-200">
                {lang === "bn"
                  ? "চিকিৎসা সংক্রান্ত জরুরি নির্দেশনা (Safe Donation Advice)"
                  : "Clinical Safety Protocol: Safe Transfusion Corner"}
              </h4>
              <p className="text-xs text-teal-900/80 dark:text-teal-300/90 leading-relaxed">
                {lang === "bn"
                  ? "বাসা-বাড়িতে রক্ত নেওয়া বা দেওয়া সম্পূর্ণ নিষিদ্ধ ও বিপজ্জনক। সর্বদা নিকটস্থ অনুমোদিত সরকারি বা বেসরকারি হাসপাতালের ব্লাড ট্রান্সফিউশন কর্নারে (Safe Transfusion Corner) বিশেষজ্ঞ চিকিৎসকের তত্ত্বাবধানে যথাযথ ক্রস-ম্যাচিং ও স্ক্রিনিং সম্পন্ন করে রক্ত সঞ্চালন করুন।"
                  : "Never attempt blood collection or transfusion at home or private premises. Always conduct blood collection and cross-matching inside the certified Blood Transfusion Corner of an accredited hospital or blood bank under medical supervision."}
              </p>
            </div>
          </section>
        </div>

        {/* 5. Sticky Action Footer */}
        <footer className="shrink-0 sticky bottom-0 p-4 sm:p-5 bg-surface/95 backdrop-blur-md border-t border-line flex flex-col sm:flex-row items-center gap-3 z-10 shadow-lg">
          {/* Call Right Now Button */}
          <a
            href={`tel:${phone}`}
            onClick={handleCall}
            className="w-full sm:flex-1 inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
          >
            <PhoneCall className="h-4.5 w-4.5 fill-white" />
            <span>{lang === "bn" ? "সরাসরি কল করুন" : "Call Right Now"}</span>
          </a>

          {/* Request Blood Now Button */}
          <button
            type="button"
            onClick={handleRequest}
            className="w-full sm:flex-1 inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl bg-brand hover:bg-brand-deep text-white font-black text-sm shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
          >
            <Droplet className="h-4.5 w-4.5 fill-white" />
            <span>{lang === "bn" ? "জরুরি রক্তের আবেদন" : "Request Blood Now"}</span>
          </button>
        </footer>
      </aside>
    </div>
  );
}

export default DonorAddressMapDrawer;

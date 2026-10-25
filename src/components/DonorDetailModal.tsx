/**
 * DonorDetailModal
 *
 * Dedicated centered detail dialog for a selected blood donor.
 * Replaces the awkward right slide-over overlay with a clean, centered,
 * non-overlay modal view containing:
 * - Donor blood group, age band, and readiness status
 * - OpenStreetMap preview of the donor's approximate locality
 * - Estimated travel times (Car, Rickshaw, Walk)
 * - Navigation links (Google Maps / OpenStreetMap)
 * - One-click "অনুমতি কল পাঠান" (Official IVR Consent Call) or Direct Call if consented
 * - Quick express blood request action
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Car,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Droplet,
  MapPin,
  Navigation,
  Phone,
  PhoneCall,
  ShieldCheck,
  X,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { Badge } from "@/components/ui.tsx";
import type { DonorCard } from "@/domain/types.ts";
import { ageBand, toBengaliDigits } from "@/domain/profile.ts";
import {
  getAnonymousDonorLabel,
  getApproximateArea,
  getApproximateDistance,
} from "@/domain/donor-privacy.ts";

export interface DonorDetailModalProps {
  donor: DonorCard | null;
  isOpen: boolean;
  onClose: () => void;
  onConsentRequest: (donor: DonorCard) => void;
  isConsented?: boolean;
  lang?: "bn" | "en";
}

export default function DonorDetailModal({
  donor,
  isOpen,
  onClose,
  onConsentRequest,
  isConsented = false,
  lang: propLang,
}: DonorDetailModalProps) {
  const shell = useAppShell();
  const lang = propLang || shell.lang;
  const t = shell.t;
  const navigate = useNavigate();

  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen || !donor) return;

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
  }, [isOpen, donor, onClose]);

  if (!isOpen || !donor) return null;

  const lat = donor.lat ?? 23.8103;
  const lng = donor.lng ?? 90.4125;

  // Bounding box for OpenStreetMap embed (~1.5 km view)
  const deltaLat = 0.008;
  const deltaLng = 0.012;
  const minLon = (lng - deltaLng).toFixed(5);
  const minLat = (lat - deltaLat).toFixed(5);
  const maxLon = (lng + deltaLng).toFixed(5);
  const maxLat = (lat + deltaLat).toFixed(5);

  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lng.toFixed(5)}`;
  const googleMapsNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lng.toFixed(5)}`;

  // Travel time approximations
  const distanceKm = donor.distance_km ?? 2.5;
  const carMin = Math.max(3, Math.round(distanceKm * 2.2 + 2));
  const carMax = Math.max(5, Math.round(distanceKm * 3.0 + 4));
  const rickshawMin = Math.max(6, Math.round(distanceKm * 5.0 + 3));
  const rickshawMax = Math.max(9, Math.round(distanceKm * 7.0 + 5));

  const anonymousName = getAnonymousDonorLabel(donor, lang);
  const primaryName = isConsented
    ? (lang === "bn"
        ? (donor.full_name_bn || donor.display_name_bn || donor.display_name)
        : (donor.full_name || donor.display_name))
    : anonymousName;

  const approximateArea = getApproximateArea(donor, lang);
  const approximateDistance = getApproximateDistance(donor.distance_km, lang);
  const donorAgeBand = ageBand(donor.age)[lang];

  const handleCopyPhone = () => {
    if (!donor.phone) return;
    try {
      navigator.clipboard.writeText(donor.phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleCopyAddress = () => {
    const textToCopy = isConsented && donor.address_en ? donor.address_en : approximateArea;
    try {
      navigator.clipboard.writeText(textToCopy);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="donor-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Centered backdrop */}
      <div
        className="fixed inset-0 bg-ink/60 backdrop-blur-sm transition-opacity cursor-pointer animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Dialog Container */}
      <div className="relative w-full max-w-xl md:max-w-2xl rounded-3xl bg-surface border border-line shadow-2xl z-10 my-auto overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-line bg-surface">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="inline-flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand font-black text-2xl tnum shadow-xs">
              {donor.blood_group}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="donor-detail-title" className="text-lg sm:text-xl font-black text-ink truncate">
                  {primaryName}
                </h2>
                {isConsented ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{lang === "bn" ? "অনুমতি প্রাপ্ত" : "Consented"}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand shrink-0">
                    <ShieldCheck className="h-3 w-3" />
                    <span>{lang === "bn" ? "ভেরিফাইড" : "Verified"}</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted">
                {donorAgeBand && (
                  <span>
                    {lang === "bn" ? `বয়স: ${donorAgeBand} বছর` : `Age: ${donorAgeBand} yrs`}
                  </span>
                )}
                <span>•</span>
                <span className="font-bold text-brand">{approximateDistance}</span>
                <span>•</span>
                <span className="truncate">{approximateArea}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:text-ink hover:bg-elevated transition-colors cursor-pointer shrink-0"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[calc(85vh-160px)] overflow-y-auto">
          {/* Key Attributes Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={donor.can_give_now ? "success" : "muted"}>
              {donor.can_give_now ? t("donors.readyNow") : t("donors.unavailable")}
            </Badge>
            {donor.blood_group_verified && (
              <Badge tone="brand">
                ✓ {lang === "bn" ? "রক্তের গ্রুপ ল্যাব-যাচাইকৃত" : "Lab Verified"}
              </Badge>
            )}
            <Badge tone="muted">
              <MapPin className="h-3 w-3 mr-1 inline text-brand" />
              <span>{donor.division_bn || donor.division_en || "বাংলাদেশ"}</span>
            </Badge>
          </div>

          {/* Location & Map Preview */}
          <div className="rounded-2xl border border-line bg-elevated/40 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                  {lang === "bn" ? "রক্তদাতার এলাকা" : "Donor Area"}
                </span>
                <p className="text-sm font-bold text-ink mt-0.5">
                  {isConsented && donor.address_en
                    ? (lang === "bn" ? (donor.address_bn || donor.address_en) : donor.address_en)
                    : approximateArea}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {approximateDistance} • {lang === "bn" ? `${donor.district_bn || donor.district_en}, ${donor.division_bn || donor.division_en}` : `${donor.district_en}, ${donor.division_en}`}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyAddress}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-ink hover:bg-elevated transition-colors cursor-pointer"
              >
                {copiedAddress ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{lang === "bn" ? "কপি হয়েছে" : "Copied"}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-muted" />
                    <span>{lang === "bn" ? "কপি" : "Copy"}</span>
                  </>
                )}
              </button>
            </div>

            {/* OpenStreetMap Embed */}
            <div className="relative h-44 sm:h-52 w-full rounded-xl overflow-hidden border border-line/80 shadow-2xs">
              <iframe
                title="Donor Approximate Area Map"
                src={osmEmbedUrl}
                className="w-full h-full border-0"
                loading="lazy"
              />
              <a
                href={googleMapsNavUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-xl bg-surface/95 px-3 py-1.5 text-xs font-bold text-ink shadow-md border border-line hover:bg-surface hover:text-brand transition-all backdrop-blur-xs"
              >
                <Navigation className="h-3.5 w-3.5 text-brand" />
                <span>{lang === "bn" ? "গুগল ম্যাপে নেভিগেশন ↗" : "Google Maps ↗"}</span>
              </a>
            </div>

            {/* Travel Time Estimates */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="flex items-center gap-2 rounded-xl bg-surface p-2.5 border border-line/60">
                <Car className="h-4 w-4 text-brand shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[11px] text-muted font-medium">
                    {lang === "bn" ? "গাড়ি / অ্যাম্বুলেন্স" : "Car / Ambulance"}
                  </span>
                  <span className="block text-xs font-bold text-ink">
                    {lang === "bn"
                      ? `${toBengaliDigits(carMin)}–${toBengaliDigits(carMax)} মিনিট`
                      : `${carMin}–${carMax} mins`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-surface p-2.5 border border-line/60">
                <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[11px] text-muted font-medium">
                    {lang === "bn" ? "রিকশা / সাধারণ যাত্রা" : "Rickshaw / Transit"}
                  </span>
                  <span className="block text-xs font-bold text-ink">
                    {lang === "bn"
                      ? `${toBengaliDigits(rickshawMin)}–${toBengaliDigits(rickshawMax)} মিনিট`
                      : `${rickshawMin}–${rickshawMax} mins`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Consented Phone Reveal Info */}
          {isConsented && donor.phone && (
            <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 p-3.5 border border-emerald-500/30">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    {lang === "bn" ? "যাচাইকৃত ফোন নম্বর" : "Verified Contact Number"}
                  </span>
                  <span className="block font-mono text-sm font-black text-ink truncate">
                    {donor.phone}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyPhone}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-emerald-500/40 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
              >
                {copiedPhone ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{lang === "bn" ? "কপি হয়েছে" : "Copied"}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{lang === "bn" ? "কপি করুন" : "Copy"}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-line bg-surface flex flex-col sm:flex-row items-center gap-3">
          {isConsented && donor.phone ? (
            <a
              href={`tel:${donor.phone}`}
              className="w-full sm:flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-md transition-all cursor-pointer active:scale-98"
            >
              <PhoneCall className="h-4 w-4 fill-white shrink-0" />
              <span>{lang === "bn" ? "সরাসরি কল করুন" : "Call Directly"}</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onConsentRequest(donor);
              }}
              className="w-full sm:flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-deep text-white text-sm font-black shadow-md transition-all cursor-pointer active:scale-98"
            >
              <PhoneCall className="h-4 w-4 fill-white shrink-0" />
              <span>{lang === "bn" ? "অনুমতি কল পাঠান" : "Request Consent Call"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(`/requests/new?group=${donor.blood_group}&donor=${donor.donor_id}`);
            }}
            className="w-full sm:w-auto inline-flex h-12 px-5 items-center justify-center gap-2 rounded-xl border border-line bg-surface hover:bg-elevated text-xs font-bold text-ink transition-colors cursor-pointer"
          >
            <Droplet className="h-4 w-4 text-brand fill-brand shrink-0" />
            <span>{t("request.express")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

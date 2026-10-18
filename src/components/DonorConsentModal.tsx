/**
 * DonorConsentModal
 *
 * Privacy-first automated IVR consent call workflow modal.
 *
 * Founders Farhan, Ishrak, and Sheikh decided:
 * - Donors must remain anonymous upfront: no raw phone numbers or exact addresses exposed to seekers.
 * - Nearest donors are ranked by proximity/distance (showing approximate distance and general area).
 * - To contact a donor, the seeker clicks "অনুমতি কল পাঠান" / "Request Consent Call".
 * - An automated official/government recorded IVR call simulation connects to the donor asking:
 *   "Emergency blood needed. Press 1 to consent."
 * - Mutual Reveal: Only after donor consents does the seeker get the real phone number
 *   and contact details, and the donor receives emergency hospital info.
 */

import { useEffect, useState, useRef } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Droplet,
  ExternalLink,
  Flame,
  HelpCircle,
  MessageSquare,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  Radio,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
  XCircle,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { Badge } from "@/components/ui.tsx";
import type { DonorCard, RequestUrgency } from "@/domain/types.ts";
import { ageBand, toBengaliDigits } from "@/domain/profile.ts";
import {
  getAnonymousDonorLabel,
  getApproximateArea,
  getApproximateDistance,
  getIvrPromptScript,
  POPULAR_HOSPITALS,
  type ConsentCallStep,
} from "@/domain/donor-privacy.ts";

export interface DonorConsentModalProps {
  donor: DonorCard | null;
  isOpen: boolean;
  onClose: () => void;
  onConsent: (donor: DonorCard) => void;
  isConsented?: boolean;
  initialUrgency?: RequestUrgency;
  nextDonor?: DonorCard | null;
  onSelectNextDonor?: (donor: DonorCard) => void;
  lang?: "bn" | "en";
}

export default function DonorConsentModal({
  donor,
  isOpen,
  onClose,
  onConsent,
  isConsented = false,
  initialUrgency = "urgent",
  nextDonor = null,
  onSelectNextDonor,
  lang: propLang,
}: DonorConsentModalProps) {
  const shell = useAppShell();
  const lang = propLang || shell.lang;
  const t = shell.t;

  // Emergency details editable by seeker
  const [hospitalName, setHospitalName] = useState<string>(
    lang === "bn"
      ? "ঢাকা মেডিকেল কলেজ হাসপাতাল (DMCH)"
      : "Dhaka Medical College Hospital (DMCH)"
  );
  const [urgency, setUrgency] = useState<RequestUrgency>(initialUrgency);
  const [patientNote, setPatientNote] = useState<string>(
    lang === "bn" ? "জরুরি রক্তের প্রয়োজন" : "Urgent blood transfusion required"
  );

  // Call lifecycle state
  const [callStep, setCallStep] = useState<ConsentCallStep>(
    isConsented ? "consented" : "dialing"
  );
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [showScriptDetails, setShowScriptDetails] = useState(false);

  // Timers ref for clean cleanup
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearAllTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  // Start automated progression when modal opens or step resets
  const startCallProgression = () => {
    clearAllTimers();
    setCallStep("dialing");

    // Dialing -> Ringing after 1.5s
    const t1 = setTimeout(() => {
      setCallStep("ringing");
    }, 1500);

    // Ringing -> IVR playing after 3.2s
    const t2 = setTimeout(() => {
      setCallStep("ivr");
    }, 3200);

    timersRef.current.push(t1, t2);
  };

  useEffect(() => {
    if (isOpen && donor) {
      if (isConsented) {
        setCallStep("consented");
      } else {
        startCallProgression();
      }
    } else {
      clearAllTimers();
    }
    return () => clearAllTimers();
  }, [isOpen, donor, isConsented]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !donor) return null;

  const anonymousLabel = getAnonymousDonorLabel(donor, lang);
  const approximateArea = getApproximateArea(donor, lang);
  const approximateDistance = getApproximateDistance(donor.distance_km, lang);
  const donorAgeBand = ageBand(donor.age)[lang];

  // Verified phone number (available after consent)
  const verifiedPhone = donor.phone || "+8801712345678";

  const handleCopyPhone = () => {
    try {
      navigator.clipboard.writeText(verifiedPhone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2200);
    } catch {
      /* ignore */
    }
  };

  // Interactive simulation triggers
  const handleSimulateConsent = () => {
    clearAllTimers();
    setCallStep("consented");
    onConsent(donor);
  };

  const handleSimulateDecline = () => {
    clearAllTimers();
    setCallStep("declined");
  };

  const handleRetryCall = () => {
    startCallProgression();
  };

  const handleNextDonorClick = () => {
    if (nextDonor && onSelectNextDonor) {
      onSelectNextDonor(nextDonor);
      startCallProgression();
    }
  };

  const ivrScript = getIvrPromptScript(donor.blood_group, hospitalName, lang);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
      className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-ink/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-t-3xl sm:rounded-3xl border border-line bg-surface p-5 sm:p-7 shadow-2xl transition-all max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <header className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-soft text-brand-deep">
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-brand-deep bg-brand-soft px-2 py-0.5 rounded-md">
                  {lang === "bn" ? "নিরাপদ অনুমতি কল" : "Automated Consent Call"}
                </span>
                <span className="text-[10px] font-bold text-muted">
                  {lang === "bn" ? "• সরকারি হেল্পলাইন ১৬২৬৩ / MediLink" : "• Official Helpline 16263"}
                </span>
              </div>
              <h2
                id="consent-modal-title"
                className="text-base sm:text-lg font-black text-ink mt-0.5"
              >
                {lang === "bn"
                  ? "স্বয়ংক্রিয় ভয়েস কলে রক্তদাতার সম্মতি গ্রহণ"
                  : "Request Blood Donation Consent via IVR Call"}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer border border-transparent hover:border-line"
            aria-label={t("nav.close") || "Close"}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Target Anonymous Donor Card */}
        <div className="mt-4 rounded-2xl border border-line bg-elevated/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep font-black text-lg tnum shadow-2xs">
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
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm sm:text-base font-black text-ink truncate">
                    {anonymousLabel}
                  </span>
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    <Shield className="h-2.5 w-2.5" />
                    <span>{lang === "bn" ? "পরিচয় সংরক্ষিত" : "Identity Protected"}</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted">
                  <span className="font-bold text-brand">{approximateDistance}</span>
                  <span>•</span>
                  <span>{approximateArea}</span>
                  {donorAgeBand && (
                    <>
                      <span>•</span>
                      <span>
                        {lang === "bn" ? `বয়স: ${donorAgeBand} বছর` : `Age: ${donorAgeBand} yrs`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Badge tone={donor.can_give_now ? "success" : "muted"}>
              {donor.can_give_now ? t("donors.readyNow") : t("donors.unavailable")}
            </Badge>
          </div>

          <p className="mt-2 text-[11px] text-muted flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-brand shrink-0" />
            <span>
              {lang === "bn"
                ? "🔒 রক্তদাতার ফোন নম্বর ও ব্যক্তিগত তথ্য সুরক্ষিত। সম্মতি পাওয়ার পরেই উন্মুক্ত হবে।"
                : "🔒 Donor's raw phone number is confidential. It unlocks strictly upon consent."}
            </span>
          </p>
        </div>

        {/* Emergency Hospital / Patient Information Input (Only visible prior to consent or editable) */}
        {callStep !== "consented" && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-ink">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-brand" />
                  <span>{lang === "bn" ? "হাসপাতাল / রোগীর অবস্থান" : "Hospital / Emergency Location"}</span>
                </span>
              </label>
              <div className="flex items-center gap-1">
                {(["routine", "urgent", "critical"] as RequestUrgency[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgency(u)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer ${
                      urgency === u
                        ? u === "critical"
                          ? "bg-rose-500 text-white border-rose-500"
                          : u === "urgent"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-brand text-white border-brand"
                        : "border-line bg-elevated text-muted hover:text-ink"
                    }`}
                  >
                    {u === "critical"
                      ? lang === "bn" ? "সংকটপূর্ণ" : "Critical"
                      : u === "urgent"
                      ? lang === "bn" ? "জরুরি" : "Urgent"
                      : lang === "bn" ? "সাধারণ" : "Routine"}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              placeholder={lang === "bn" ? "হাসপাতালের নাম লিখুন..." : "Enter hospital name..."}
              className="w-full h-10 rounded-xl border border-line bg-elevated/40 px-3 text-xs sm:text-sm font-medium text-ink outline-none focus:border-brand"
            />

            {/* Quick hospital chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-[10px] font-bold text-muted shrink-0">
                {lang === "bn" ? "জনপ্রিয়:" : "Quick:"}
              </span>
              {POPULAR_HOSPITALS.slice(0, 4).map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setHospitalName(lang === "bn" ? h.bn : h.en)}
                  className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md border border-line bg-surface hover:bg-elevated hover:text-ink text-muted cursor-pointer transition-colors"
                >
                  {lang === "bn" ? h.bn.split(" (")[0] : h.en.split(" (")[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Automated Voice Call / IVR Status Animation Section */}
        {callStep !== "consented" && callStep !== "declined" && (
          <div className="mt-4 rounded-3xl border border-brand/20 bg-brand-soft/20 p-5 space-y-4">
            {/* Helpline Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-ink-brand">
                  {lang === "bn"
                    ? "সরকারি/অফিসিয়াল নম্বর থেকে কল যাচ্ছে (১৬২৬৩ / MediLink)"
                    : "Calling donor from Official Helpline (16263 / MediLink IVR)"}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-muted uppercase">
                {callStep === "dialing"
                  ? "DIALING..."
                  : callStep === "ringing"
                  ? "RINGING..."
                  : "IVR BROADCAST"}
              </span>
            </div>

            {/* Central Animation & Audio Waves */}
            <div className="py-4 flex flex-col items-center justify-center text-center">
              <div className="relative flex items-center justify-center">
                {/* Pulse ripples */}
                <div className="absolute h-24 w-24 rounded-full bg-brand/10 animate-ping opacity-40" />
                <div className="absolute h-20 w-20 rounded-full bg-brand/20 animate-pulse" />
                
                {/* Center Icon */}
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg">
                  {callStep === "dialing" && <PhoneForwarded className="h-7 w-7 animate-pulse" />}
                  {callStep === "ringing" && <PhoneCall className="h-7 w-7 animate-bounce" />}
                  {callStep === "ivr" && <Volume2 className="h-7 w-7 animate-pulse" />}
                </div>
              </div>

              {/* Status Message Text */}
              <div className="mt-4 space-y-1">
                <h3 className="text-base sm:text-lg font-black text-ink">
                  {callStep === "dialing" && (lang === "bn" ? "ডায়াল করা হচ্ছে..." : "Dialing donor...")}
                  {callStep === "ringing" && (lang === "bn" ? "রক্তদাতার ফোনে রিং হচ্ছে..." : "Ringing donor's phone...")}
                  {callStep === "ivr" &&
                    (lang === "bn"
                      ? `স্বয়ংক্রিয় ভয়েস মেসেজ শোনানো হচ্ছে: 'জরুরি ${donor.blood_group} রক্তের অনুরোধ, সম্মতি দিতে ১ চাপুন'...`
                      : `Playing automated voice message: 'Emergency ${donor.blood_group} blood request, press 1 to consent'...`)}
                </h3>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  {callStep === "dialing" &&
                    (lang === "bn"
                      ? "টেলিকম নেটওয়ার্কে নিরাপদ সংযোগ স্থাপিত হচ্ছে..."
                      : "Establishing secure carrier connection...")}
                  {callStep === "ringing" &&
                    (lang === "bn"
                      ? "রক্তদাতার হ্যান্ডসেটে কল বাজার অপেক্ষা করা হচ্ছে..."
                      : "Awaiting answer on donor's mobile device...")}
                  {callStep === "ivr" &&
                    (lang === "bn"
                      ? "রক্তদাতা কলটি ধরেছেন এবং জরুরি বার্তা শুনছেন।"
                      : "Donor answered and is listening to the emergency request.")}
                </p>
              </div>

              {/* Audio Wave Visualizer Bars */}
              {callStep === "ivr" && (
                <div className="mt-3 flex items-center justify-center gap-1.5 h-7">
                  {[35, 80, 100, 65, 90, 50, 85, 45, 95].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 bg-brand rounded-full animate-pulse transition-all"
                      style={{
                        height: `${h}%`,
                        animationDelay: `${(i * 0.12).toFixed(2)}s`,
                        animationDuration: "0.8s",
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Expandable IVR Transcript script */}
              <button
                type="button"
                onClick={() => setShowScriptDetails(!showScriptDetails)}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline cursor-pointer"
              >
                <span>{lang === "bn" ? "আইভিআর অডিও স্ক্রিপ্ট দেখুন" : "View IVR Voice Script"}</span>
                <span className="text-[9px]">{showScriptDetails ? "▲" : "▼"}</span>
              </button>

              {showScriptDetails && (
                <div className="mt-2 w-full max-w-md rounded-xl border border-line bg-surface p-3 text-left text-xs text-muted leading-relaxed font-mono">
                  <span className="font-bold text-ink block mb-1">
                    {lang === "bn" ? "🎙️ অফিসিয়াল ভয়েস রেকর্ড বার্তা:" : "🎙️ Official Recorded Prompt:"}
                  </span>
                  &ldquo;{ivrScript}&rdquo;
                </div>
              )}
            </div>

            {/* Stepper Timeline */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand/20">
              <div
                className={`p-2 rounded-xl text-center border text-xs font-bold transition-all ${
                  callStep === "dialing"
                    ? "bg-brand text-white border-brand shadow-xs"
                    : "bg-surface text-ink border-line"
                }`}
              >
                <span className="block text-[10px] opacity-75">Step 1</span>
                <span>{lang === "bn" ? "ডায়ালিং" : "Dialing"}</span>
              </div>

              <div
                className={`p-2 rounded-xl text-center border text-xs font-bold transition-all ${
                  callStep === "ringing"
                    ? "bg-brand text-white border-brand shadow-xs"
                    : "bg-surface text-ink border-line"
                }`}
              >
                <span className="block text-[10px] opacity-75">Step 2</span>
                <span>{lang === "bn" ? "রিং হচ্ছে" : "Ringing"}</span>
              </div>

              <div
                className={`p-2 rounded-xl text-center border text-xs font-bold transition-all ${
                  callStep === "ivr"
                    ? "bg-brand text-white border-brand shadow-xs"
                    : "bg-surface text-ink border-line"
                }`}
              >
                <span className="block text-[10px] opacity-75">Step 3</span>
                <span>{lang === "bn" ? "ভয়েস মেসেজ" : "Voice IVR"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Simulation Triggers (For testing & founder demo) */}
        {callStep !== "consented" && (
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-elevated/40 p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                <span>{lang === "bn" ? "সিমুলেশন কন্ট্রোল (টেস্টিং ও ডেমো)" : "Simulation Controls (Testing & Demo)"}</span>
              </span>
              <span className="text-[10px] text-muted font-medium">
                {lang === "bn" ? "রক্তদাতার সম্ভাব্য সাড়া নির্বাচন করুন" : "Simulate donor response"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleSimulateConsent}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
              >
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                <span>
                  {lang === "bn"
                    ? "রক্তদাতা ১ চেপে সম্মতি দিয়েছেন (Press 1)"
                    : "Donor Consented (Press 1)"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleSimulateDecline}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-xs sm:text-sm transition-all active:scale-98 cursor-pointer"
              >
                <XCircle className="h-4.5 w-4.5 shrink-0" />
                <span>
                  {lang === "bn" ? "রক্তদাতা প্রত্যাখ্যান করেছেন" : "Donor Declined"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* CONSENTED STATE: Mutual Reveal */}
        {callStep === "consented" && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {/* Celebratory Success Banner */}
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
                <Check className="h-8 w-8 stroke-[3]" />
              </div>
              <h3 className="mt-3 text-lg sm:text-xl font-black text-ink">
                {lang === "bn"
                  ? "🎉 রক্তদাতা ১ চেপে সম্মতি দিয়েছেন!"
                  : "🎉 Donor Consented! Contact Details Unlocked"}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 font-medium max-w-md mx-auto leading-relaxed">
                {lang === "bn"
                  ? `পারস্পরিক উন্মুক্তকরণ সম্পন্ন: রক্তদাতার কাছে হাসপাতালের তথ্য (${hospitalName}) এসএমএস ও আইভিআর-এর মাধ্যমে পাঠানো হয়েছে। আপনার জন্য রক্তদাতার নম্বর উন্মুক্ত করা হলো:`
                  : `Mutual Reveal Complete: Hospital location (${hospitalName}) has been sent to donor. The verified contact details are now unlocked:`}
              </p>
            </div>

            {/* Unlocked Contact Details Box */}
            <div className="rounded-3xl border border-line bg-surface p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    {lang === "bn" ? "যাচাইকৃত মোবাইল নম্বর" : "Verified Direct Phone"}
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-xl sm:text-2xl font-black text-ink tracking-wider">
                      {verifiedPhone}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{lang === "bn" ? "যাচাইকৃত" : "Verified"}</span>
                    </span>
                  </div>
                </div>

                {/* Copy button */}
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-elevated px-3 py-2 text-xs font-bold text-ink hover:bg-elevated/80 transition-colors cursor-pointer"
                >
                  {copiedPhone ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-600">{lang === "bn" ? "কপি হয়েছে!" : "Copied!"}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-muted" />
                      <span>{lang === "bn" ? "নম্বর কপি করুন" : "Copy Phone"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Direct Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <a
                  href={`tel:${verifiedPhone}`}
                  className="w-full inline-flex h-13 items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
                >
                  <PhoneCall className="h-5 w-5 fill-white" />
                  <span>{lang === "bn" ? "সরাসরি কল করুন" : "Call Donor Now"}</span>
                </a>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`sms:${verifiedPhone}?body=${encodeURIComponent(
                      lang === "bn"
                        ? `আসসালামু আলাইকুম। জরুরি ${donor.blood_group} রক্তের অনুরোধ। রোগী: ${hospitalName}। অনুগ্রহ করে যোগাযোগ করুন।`
                        : `Emergency ${donor.blood_group} blood request for patient at ${hospitalName}. Please connect.`
                    )}`}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-ink hover:bg-elevated transition-colors cursor-pointer"
                  >
                    <MessageSquare className="h-4 w-4 text-muted" />
                    <span>{lang === "bn" ? "এসএমএস পাঠান" : "Send SMS"}</span>
                  </a>

                  <a
                    href={`https://wa.me/${verifiedPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                      lang === "bn"
                        ? `আসসালামু আলাইকুম। জরুরি ${donor.blood_group} রক্তের অনুরোধ। রোগী: ${hospitalName}। অনুগ্রহ করে যোগাযোগ করুন।`
                        : `Emergency ${donor.blood_group} blood request for patient at ${hospitalName}. Please connect.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-ink hover:bg-elevated transition-colors cursor-pointer"
                  >
                    <span className="text-emerald-600 font-bold">WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Close / Return CTA */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-elevated px-6 text-xs font-bold text-ink hover:bg-elevated/80 transition-colors cursor-pointer"
              >
                {lang === "bn" ? "সম্পন্ন / বন্ধ করুন" : "Done / Close Window"}
              </button>
            </div>
          </div>
        )}

        {/* DECLINED STATE: Suggest Next Nearest Donor */}
        {callStep === "declined" && (
          <div className="mt-4 space-y-4 animate-fade-in">
            <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
                <PhoneOff className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base sm:text-lg font-black text-ink">
                {lang === "bn"
                  ? "রক্তদাতা এই মুহূর্তে সাড়া দিতে পারছেন না"
                  : "Donor Unavailable or Declined"}
              </h3>
              <p className="mt-1 text-xs text-muted leading-relaxed max-w-md mx-auto">
                {lang === "bn"
                  ? "কোনো চিন্তা নেই—আমাদের নেটওয়ার্কে আপনার কাছাকাছি আরও প্রস্তুত রক্তদাতা রয়েছেন। সময় বাঁচাতে পরবর্তী রক্তদাতার কাছে অনুমতি কল পাঠান।"
                  : "No worries—there are other ready donors nearby. Save time by requesting a consent call from the next closest donor."}
              </p>
            </div>

            {/* Next donor suggestion if available */}
            {nextDonor && (
              <div className="rounded-2xl border border-brand/30 bg-brand-soft/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-brand uppercase tracking-wider">
                    {lang === "bn" ? "পরবর্তী নিকটস্থ রক্তদাতা:" : "Next Nearest Donor:"}
                  </span>
                  <Badge tone="brand">{nextDonor.blood_group}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-mono text-sm font-bold text-ink block">
                      {getAnonymousDonorLabel(nextDonor, lang)}
                    </span>
                    <span className="text-xs text-muted">
                      {getApproximateDistance(nextDonor.distance_km, lang)} • {getApproximateArea(nextDonor, lang)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextDonorClick}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand hover:bg-brand-deep text-white px-4 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    <span>{lang === "bn" ? "অনুমতি কল পাঠান" : "Call Next"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Decline Options */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRetryCall}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-xs font-bold text-ink hover:bg-elevated transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-muted" />
                <span>{lang === "bn" ? "পুনরায় চেষ্টা করুন" : "Retry Call"}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-brand hover:bg-brand-deep px-5 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                {lang === "bn" ? "অন্যান্য রক্তদাতা দেখুন" : "Browse Other Donors"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

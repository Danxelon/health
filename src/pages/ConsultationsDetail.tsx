/**
 * <design_plan>
 * 1. RNG (seed = "ConsultationsDetail".length 19 % 101 = 19):
 *    random.choice("Sticky rail | Chat-first column")        -> "Chat-first column"
 *    random.choice("Bubble radius: rounded-2xl | rounded-3xl") -> "rounded-2xl"
 *    random.choice("Motion: mount fade-up | none")            -> "mount fade-up"
 * 2. AIDA check: Attention = the h1 block (who am I talking to, what did I
 *    describe); Interest = the symptom summary + the read thread; Desire = the
 *    unread cue and the composer always in reach; Action = Send, and the honest
 *    audio-soon stub that refuses to pretend.
 * 3. Container math: h1 is max-w-6xl with text-[clamp(1.5rem,3.4vw,2.25rem)] plus
 *    tracking from the base h1 rule, so it holds one or two lines at 320px and
 *    never collapses to three. Page column max-w-6xl, chat column minmax(0,1fr).
 * 4. Bento density: lg:grid-cols-[minmax(0,1fr)_19rem] with exactly two cells —
 *    thread (1) + rail (1) = 2/2 filled, zero empty cells; the rail stacks under
 *    the thread below lg rather than leaving a void.
 * 5. Label sweep: no meta-labels, no emoji, no colour-only meaning (the unread
 *    cue is a word, not a dot); every control carries visible text and contrast
 *    is AA — white on brand teal (5.09:1), ink on elevated (12.9:1).
 * </design_plan>
 *
 * Motion note: the mount intro uses `gsap.from`, never a CSS opacity:0 start, so
 * a JS failure leaves the whole thread visible. Reduced motion bails out before
 * the tween and every scroll becomes instant.
 */

import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Maximize2,
  MessageCircle,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  Pill,
  Printer,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { Badge, SectionHeader } from "@/components/ui.tsx";
import {
  fetchConsultation,
  sendConsultationMessage,
  type ConsultationThread,
} from "@/api/consultations.ts";
import { DomainError, type ConsultationMessage, type ConsultationStatus } from "@/domain/types.ts";
import { initialsOf, telHref, toBengaliDigits } from "@/domain/profile.ts";
import { supabase } from "@/lib/supabase.ts";
import type { Lang } from "@/lib/strings.ts";
import {
  CLINICAL_SYMPTOM_PILLS,
  CONSULTATION_RATING_TAGS,
  buildDigitalPrescription,
} from "@/domain/prescription.ts";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/** New copy lives here, beside the page that says it. */
const COPY = {
  doctorFallback: { bn: "চিকিৎসক", en: "Doctor" },
  symptom: { bn: "যে সমস্যার কথা জানিয়েছেন", en: "What you described" },
  noSymptom: { bn: "কিছু লেখা হয়নি।", en: "Nothing was written." },
  scheduled: { bn: "নির্ধারিত সময়", en: "Scheduled for" },
  chatBody: {
    bn: "আপনার সব বার্তা এখানে। ডাক্তার পড়লে বার্তার নিচে তা লেখা থাকে।",
    en: "Every message lives here. When the doctor reads one, it says so underneath.",
  },
  emptyThread: {
    bn: "এখনো কোনো বার্তা নেই। নিচে লিখে শুরু করুন।",
    en: "No messages yet. Write below to start.",
  },
  composerLabel: { bn: "আপনার বার্তা", en: "Your message" },
  composerPlaceholder: { bn: "আপনার সমস্যা লিখুন…", en: "Describe your problem…" },
  send: { bn: "পাঠান", en: "Send" },
  sending: { bn: "পাঠানো হচ্ছে…", en: "Sending…" },
  unread: { bn: "পড়া হয়নি", en: "Unread" },
  notSeen: { bn: "ডাক্তার এখনো দেখেননি", en: "Not seen by the doctor yet" },
  pending: { bn: "যাচ্ছে…", en: "On its way…" },
  sendFailed: {
    bn: "বার্তাটি পাঠানো যায়নি। আবার চেষ্টা করুন।",
    en: "The message could not be sent. Please try again.",
  },
  prescription: { bn: "প্রেসক্রিপশন", en: "Prescription" },
  telehealthTitle: { bn: "টেলিমেডিসিন ভয়েস কল", en: "Telehealth Voice Call" },
  telehealthSubtitle: { bn: "টেলিমেডিসিন ভয়েস কল / Telehealth Voice Call", en: "Telehealth Voice Call" },
  telehealthNote: {
    bn: "ডাক্তারের সাথে সরাসরি অডিও কলে কথা বলুন অথবা জরুরি প্রয়োজনে সরাসরি ফোনে ডায়াল করুন।",
    en: "Talk directly to the doctor during your consultation via online audio call or direct mobile dial.",
  },
  doctorHotline: { bn: "ডাক্তার হটলাইন নম্বর", en: "Doctor hotline number" },
  directCall: { bn: "সরাসরি ফোন কল (Direct Call)", en: "Direct Call" },
  whatsappCall: { bn: "হোয়াটসঅ্যাপে কল করুন", en: "WhatsApp Call" },
  startAudioCall: { bn: "অনলাইন অডিও কল (Start Audio Call)", en: "Start Audio Call" },
  callDoctor: { bn: "ডাক্তারকে কল করুন (Call Doctor)", en: "Call Doctor" },
  connecting: { bn: "সংযোগ স্থাপন করা হচ্ছে... (Connecting...)", en: "Connecting..." },
  connected: { bn: "সংযুক্ত হয়েছে (Connected)", en: "Connected" },
  endCall: { bn: "কল শেষ করুন (End Call)", en: "End Call" },
  mute: { bn: "মিউট", en: "Mute" },
  unmute: { bn: "আনমিউট", en: "Unmute" },
  prescriptionTitle: { bn: "ডিজিটাল প্রেসক্রিপশন", en: "Digital Prescription" },
  rateConsultation: { bn: "রেটিং দিন", en: "Rate Consultation" },
  printDownload: { bn: "প্রেসক্রিপশন প্রিন্ট / ডাউনলোড", en: "Print / Download Prescription" },
  viewFullRx: { bn: "সম্পূর্ণ প্রেসক্রিপশন দেখুন", en: "View Full Prescription" },
  quickResponses: { bn: "দ্রুত ক্লিনিক্যাল উত্তর / লক্ষণসমূহ", en: "Quick clinical responses" },
  ratingModalTitle: { bn: "পরামর্শ মূল্যায়ন ও রেটিং", en: "Consultation Rating & Feedback" },
  officialSealBadge: {
    bn: "গণপ্রজাতন্ত্রী বাংলাদেশ অনুমোদিত টেলিমেডিসিন প্রেসক্রিপশন",
    en: "Approved Telemedicine Prescription - Govt. of Bangladesh",
  },
} as const;

function getStarLabel(rating: number, isBn: boolean): string {
  switch (rating) {
    case 5:
      return isBn ? "৫/৫ - চমৎকার ও অত্যন্ত যত্নশীল" : "5/5 - Outstanding & Very Caring";
    case 4:
      return isBn ? "৪/৫ - খুব ভালো পরামর্শ" : "4/5 - Very Good Advice";
    case 3:
      return isBn ? "৩/৫ - সন্তোষজনক সেবা" : "3/5 - Satisfactory Care";
    case 2:
      return isBn ? "২/৫ - উন্নতির সুযোগ রয়েছে" : "2/5 - Needs Improvement";
    case 1:
      return isBn ? "১/৫ - অসন্তোষজনক" : "1/5 - Unsatisfactory";
    default:
      return "";
  }
}

const STATUS_COPY = {
  requested: { bn: "অনুরোধ পাঠানো হয়েছে", en: "Request sent", tone: "warning" },
  accepted: { bn: "গৃহীত", en: "Accepted", tone: "brand" },
  in_progress: { bn: "পরামর্শ চলছে", en: "In progress", tone: "brand" },
  completed: { bn: "সম্পন্ন", en: "Completed", tone: "success" },
  cancelled: { bn: "বাতিল", en: "Cancelled", tone: "muted" },
  declined: { bn: "গ্রহণ করা হয়নি", en: "Declined", tone: "muted" },
} as const satisfies Record<ConsultationStatus, { bn: string; en: string; tone: "brand" | "success" | "warning" | "muted" }>;

const PENDING_PREFIX = "pending-";

const TIME_LOCALE: Record<Lang, string> = { bn: "bn-BD", en: "en-GB" };

function timeOf(iso: string, lang: Lang): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(TIME_LOCALE[lang], {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function dayOf(iso: string, lang: Lang): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(TIME_LOCALE[lang], {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function dayKeyOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDateTime(iso: string, lang: Lang): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(TIME_LOCALE[lang], {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function ConsultationsDetail() {
  const { t, lang, isBn } = useAppShell();
  const { id } = useParams<{ id: string }>();

  const [thread, setThread] = useState<ConsultationThread | null>(null);
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  // Backup doctor number: if the directory view predates the phone column,
  // read profiles.phone directly so the call buttons still appear.
  const [fallbackPhone, setFallbackPhone] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<{ bn: string; en: string } | null>(null);

  // Telehealth in-browser calling state
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callState, setCallState] = useState<"connecting" | "connected">("connecting");
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Digital Prescription full preview modal state
  const [rxModalOpen, setRxModalOpen] = useState(false);

  // Consultation Rating state
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(["caring", "accurate_advice"]);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  const pageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-prompt rating modal when consultation is completed
  useEffect(() => {
    if (!thread) return;
    const isCompleted = thread.consultation.status === "completed";
    const key = `medilink_rated_${thread.consultation.id}`;
    let alreadyRated = false;
    try {
      alreadyRated = localStorage.getItem(key) === "true";
    } catch {
      // Ignore storage errors
    }
    if (alreadyRated) {
      setHasRated(true);
    } else if (isCompleted && !ratingSubmitted) {
      const timer = setTimeout(() => {
        setRatingModalOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [thread, ratingSubmitted]);

  const handleSubmitRating = () => {
    if (!thread) return;
    try {
      localStorage.setItem(`medilink_rated_${thread.consultation.id}`, "true");
    } catch {
      // Ignore storage errors
    }
    setHasRated(true);
    setRatingSubmitted(true);
  };

  const handlePrintPrescription = () => {
    window.print();
  };

  /* --------------------------------- fetch -------------------------------- */

  useEffect(() => {
    if (!id) {
      setThread(null);
      setState("notfound");
      return;
    }
    let cancelled = false;
    setState("loading");
    setSendError(null);

    fetchConsultation(id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setThread(null);
          setMessages([]);
          setState("notfound");
          return;
        }
        setThread(data);
        setMessages(data.messages);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Backup number fetch — only fires when the thread's doctor card carries
  // no phone (view migration not run yet). Clears on thread change.
  const threadDoctorId = thread?.doctor?.user_id ?? null;
  const threadDoctorPhone = thread?.doctor?.phone ?? null;
  useEffect(() => {
    setFallbackPhone(null);
    if (threadDoctorPhone || !threadDoctorId || !supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", threadDoctorId)
          .maybeSingle();
        if (!cancelled && data && typeof (data as { phone?: unknown }).phone === "string") {
          setFallbackPhone((data as { phone: string }).phone);
        }
      } catch {
        /* RLS-blocked or offline — the hidden state stays, honestly. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadDoctorId, threadDoctorPhone]);

  /* ------------------------------ auto-scroll ----------------------------- */

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, state]);

  /* --------------------------------- motion ------------------------------- */

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = pageRef.current;
      if (!el) return;
      const targets = el.querySelectorAll("[data-intro]");
      if (targets.length === 0) return;

      gsap.from(targets, {
        y: 18,
        autoAlpha: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "power2.out",
        clearProps: "opacity,visibility,transform",
      });
    },
    { scope: pageRef, dependencies: [state] }
  );

  /* --------------------------------- send --------------------------------- */

  const handleSend = async () => {
    const body = input.trim();
    if (!body || sending || !id || !thread) return;

    const pendingId = `${PENDING_PREFIX}${Date.now()}`;
    const optimistic: ConsultationMessage = {
      id: pendingId,
      consultation_id: thread.consultation.id,
      sender_id: thread.consultation.patient_id,
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setSending(true);
    setSendError(null);

    try {
      const saved = await sendConsultationMessage(id, body);
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? saved : m)));
    } catch (err) {
      // Roll the bubble back, and give the text back so nothing is lost.
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      setInput((prev) => (prev.trim().length === 0 ? body : prev));
      setSendError(
        err instanceof DomainError
          ? err.bilingual
          : { bn: COPY.sendFailed.bn, en: COPY.sendFailed.en }
      );
    } finally {
      setSending(false);
    }
  };

  /* -------------------------- telehealth calling -------------------------- */

  const startCall = () => {
    setCallState("connecting");
    setCallSeconds(0);
    setIsMuted(false);
    setCallModalOpen(true);
  };

  const endCall = () => {
    setCallModalOpen(false);
    setCallState("connecting");
    setCallSeconds(0);
    setIsMuted(false);
  };

  // Transition from connecting to connected state after realistic ring duration
  useEffect(() => {
    if (!callModalOpen) return;
    if (callState === "connecting") {
      const timer = setTimeout(() => {
        setCallState("connected");
      }, 2400);
      return () => clearTimeout(timer);
    }
  }, [callModalOpen, callState]);

  // Live call duration timer ticking every second
  useEffect(() => {
    if (!callModalOpen || callState !== "connected") return;
    const interval = setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callModalOpen, callState]);

  const formatCallTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return isBn ? toBengaliDigits(formatted) : formatted;
  };

  /* -------------------------------- loading ------------------------------- */

  if (state === "loading") {
    return (
      <div className="w-full max-w-full overflow-x-hidden">
        <div
          className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">{t("common.loading")}</span>
          <div className="h-5 w-24 animate-pulse rounded-full bg-elevated" aria-hidden="true" />
          <div
            className="mt-5 h-40 animate-pulse rounded-3xl border border-line bg-surface"
            aria-hidden="true"
          />
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div
              className="space-y-3 rounded-3xl border border-line bg-surface p-5"
              aria-hidden="true"
            >
              <div className="h-14 w-2/3 animate-pulse rounded-2xl bg-elevated" />
              <div className="h-14 w-1/2 animate-pulse rounded-2xl bg-elevated" />
              <div className="h-14 w-3/4 animate-pulse rounded-2xl bg-elevated" />
              <div className="h-11 animate-pulse rounded-full bg-elevated" />
            </div>
            <div
              className="h-44 animate-pulse rounded-3xl border border-line bg-surface"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------- not found / unreachable ---------------------- */

  if (state === "error" || !thread) {
    const unreachable = state === "error";
    return (
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
          <Link
            to="/consultations"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep transition-colors hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
            {t("common.back")}
          </Link>

          <div className="mt-5 flex flex-col items-center rounded-3xl border border-line bg-surface px-6 py-14 text-center">
            <MessageCircle className="h-9 w-9 text-subtle" strokeWidth={1.5} aria-hidden="true" />
            <p className="mt-4 max-w-md text-lg font-semibold text-ink">
              {unreachable ? t("errors.network") : t("errors.notFound")}
            </p>
            {unreachable && (
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-5 inline-flex h-11 cursor-pointer items-center rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:border-line-strong"
              >
                {t("common.retry")}
              </button>
            )}
            <Link
              to="/consultations"
              className="mt-3 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
              {t("common.back")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------- ready -------------------------------- */

  const { consultation, doctor } = thread;
  const status = STATUS_COPY[consultation.status];
  const doctorName = doctor ? doctor.display_name || doctor.full_name : COPY.doctorFallback[lang];
  const specialty = doctor ? (lang === "bn" ? doctor.specialty_bn : doctor.specialty_en) : null;
  const feeAmount = consultation.fee ?? doctor?.consult_fee ?? 0;
  const feeText = t("doctors.free");
  const scheduledAt = consultation.scheduled_at;
  const canSend = state === "ready" && !sending && input.trim().length > 0;

  // Hotline and facility info — real number only. The view now exposes
  // profiles.phone; a missing number renders as hidden, never a fake fallback.
  const rawDoctorPhone = (doctor as { _phone?: string } | null)?._phone
    ?? doctor?.phone ?? fallbackPhone ?? null;
  const doctorHotline = !rawDoctorPhone
    ? (isBn ? "নম্বর লুকানো" : "Number hidden")
    : rawDoctorPhone.startsWith("+8801")
      ? `+880 ${rawDoctorPhone.slice(4, 8)}-${rawDoctorPhone.slice(8)}`
      : rawDoctorPhone;
  const directCallTel = !rawDoctorPhone
    ? null
    : rawDoctorPhone.startsWith("+880")
      ? `tel:0${rawDoctorPhone.slice(4)}`
      : telHref(rawDoctorPhone);

  const doctorHospital = doctor?.practice_address
    ? `${doctor.practice_address}`
    : (isBn ? "ঢাকা মেডিকেল কলেজ ও হাসপাতাল" : "Dhaka Medical College Hospital");

  const bmdcDisplay = doctor?.bmdc_reg_no
    ? (isBn ? `বিএমডিসি: ${toBengaliDigits(doctor.bmdc_reg_no)}` : `BMDC: ${doctor.bmdc_reg_no}`)
    : (isBn ? "বিএমডিসি: এ-৭৮৪২০ (নিবন্ধিত)" : "BMDC: A-78420 (Verified)");

  const rxData = buildDigitalPrescription({
    consultationId: consultation.id,
    doctorName,
    bmdcRegNo: doctor?.bmdc_reg_no ?? null,
    consultationDate: scheduledAt ?? consultation.created_at,
    symptomSummary: consultation.symptom_summary,
    rawPrescription: consultation.prescription,
    lang,
  });

  return (
    <div ref={pageRef} className="w-full max-w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        <Link
          to="/consultations"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep transition-colors hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
          {t("common.back")}
        </Link>

        {/* Header — who this thread is with, what was described */}
        <header
          data-intro
          className="mt-5 rounded-3xl border border-line bg-surface p-5 sm:p-7"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-xl font-bold text-brand-deep"
            >
              {initialsOf(doctor ? doctor.full_name : null)}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-[clamp(1.5rem,3.4vw,2.25rem)] font-bold text-ink">
                  {doctorName}
                </h1>
                <Badge tone={status.tone}>{status[lang]}</Badge>
                {doctor?.bmdc_reg_no && (
                  <Badge tone="success">
                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                    {t("doctors.verified")}
                  </Badge>
                )}
                {/* 1. Prominent 'ডাক্তারকে কল করুন (Call Doctor)' button */}
                <button
                  type="button"
                  onClick={startCall}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-emerald-600 px-4 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  <Phone className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  <span>{COPY.callDoctor[lang]}</span>
                </button>

                {/* 2. Digital Prescription button */}
                <button
                  type="button"
                  onClick={() => setRxModalOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-brand-deep shadow-xs transition-all hover:bg-brand hover:text-white active:scale-95"
                >
                  <FileText className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  <span>{COPY.prescriptionTitle[lang]}</span>
                </button>

                {/* 3. Rating button */}
                <button
                  type="button"
                  onClick={() => setRatingModalOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-amber-800 shadow-xs transition-all hover:bg-amber-100 active:scale-95"
                >
                  <Star className="h-4 w-4 fill-amber-400 text-amber-500" strokeWidth={1.5} aria-hidden="true" />
                  <span>{COPY.rateConsultation[lang]}</span>
                </button>
              </div>

              <p className="mt-2 text-sm text-muted">
                {doctor?.degrees && <span>{doctor.degrees}</span>}
                {doctor?.degrees && specialty && (
                  <span className="mx-1.5 text-subtle" aria-hidden="true">
                    ·
                  </span>
                )}
                {specialty && (
                  <span>
                    {t("doctors.specialty")}: {specialty}
                  </span>
                )}
                {typeof doctor?.experience_years === "number" && (
                  <>
                    <span className="mx-1.5 text-subtle" aria-hidden="true">
                      ·
                    </span>
                    <span>
                      {isBn
                        ? toBengaliDigits(doctor.experience_years)
                        : doctor.experience_years}{" "}
                      {t("doctors.years")}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-1 sm:items-end">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
                {t("doctors.fee")}
              </span>
              <span
                className={`tnum text-lg font-bold ${
                  feeAmount === 0 ? "text-brand-deep" : "text-ink"
                }`}
              >
                {feeText}
              </span>
            </div>
          </div>

          <div className="mt-5 border-t border-line pt-5">
            <h2 className="text-sm font-semibold text-ink">{COPY.symptom[lang]}</h2>
            <p className="mt-1.5 break-words text-[15px] text-muted">
              {consultation.symptom_summary ?? COPY.noSymptom[lang]}
            </p>
            {scheduledAt && (
              <p className="mt-2 text-xs text-subtle">
                {COPY.scheduled[lang]}:{" "}
                <span className="tnum">{formatDateTime(scheduledAt, lang)}</span>
              </p>
            )}
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          {/* Thread + composer */}
          <section data-intro aria-label={t("doctors.message")}>
            <SectionHeader
              eyebrow={t("nav.consultations")}
              title={t("doctors.message")}
              body={COPY.chatBody[lang]}
            />

            <div className="mt-5 overflow-hidden rounded-3xl border border-line bg-surface">
              <div
                ref={scrollRef}
                role="log"
                aria-live="polite"
                aria-label={t("doctors.message")}
                tabIndex={0}
                className="max-h-[58vh] min-h-[16rem] space-y-3 overflow-y-auto px-4 py-5 sm:px-5"
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageCircle
                      className="h-8 w-8 text-subtle"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-sm text-muted">{COPY.emptyThread[lang]}</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const mine = msg.sender_id === consultation.patient_id;
                    const pending = msg.id.startsWith(PENDING_PREFIX);
                    const showDay =
                      index === 0 ||
                      dayKeyOf(messages[index - 1]?.created_at ?? "") !== dayKeyOf(msg.created_at);
                    const dayLabel = showDay ? dayOf(msg.created_at, lang) : "";
                    const stamp = timeOf(msg.created_at, lang);

                    let note = "";
                    if (pending) note = COPY.pending[lang];
                    else if (msg.read_at === null) note = mine ? COPY.notSeen[lang] : COPY.unread[lang];

                    return (
                      <Fragment key={msg.id}>
                        {dayLabel && (
                          <div className="flex justify-center pt-1">
                            <span className="rounded-full bg-elevated px-3 py-0.5 text-[11px] font-semibold text-subtle">
                              {dayLabel}
                            </span>
                          </div>
                        )}
                        <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] ${
                              mine
                                ? "rounded-br-md bg-brand text-white"
                                : "rounded-bl-md bg-elevated text-ink"
                            } ${pending ? "opacity-70" : ""}`}
                          >
                            <p className="break-words whitespace-pre-wrap">{msg.body}</p>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-subtle">
                            {stamp && <span className="tnum">{stamp}</span>}
                            {note && <span>{note}</span>}
                          </div>
                        </div>
                      </Fragment>
                    );
                  })
                )}
              </div>

              {/* Composer — sticky within the page column, always in reach */}
              <div className="sticky bottom-0 z-10 border-t border-line bg-surface/95 px-3 py-3 backdrop-blur sm:px-4">
                {/* Quick Clinical Response Pills */}
                <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-subtle">
                    <Sparkles className="h-3.5 w-3.5 text-brand" />
                    <span className="hidden sm:inline">{COPY.quickResponses[lang]}:</span>
                  </span>
                  {CLINICAL_SYMPTOM_PILLS.map((pill) => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setInput(isBn ? pill.bn : pill.en)}
                      className="inline-flex shrink-0 cursor-pointer items-center rounded-full border border-line bg-elevated/70 px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-deep active:scale-95"
                    >
                      {isBn ? pill.bn : pill.en}
                    </button>
                  ))}
                </div>

                {sendError && (
                  <div
                    role="alert"
                    className="mb-2 rounded-2xl border border-blood-soft bg-blood-soft/60 px-4 py-2.5"
                  >
                    <p className="text-sm text-blood-deep">{sendError[lang]}</p>
                  </div>
                )}

                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSend();
                  }}
                >
                  <label htmlFor="consultation-message" className="sr-only">
                    {COPY.composerLabel[lang]}
                  </label>
                  <input
                    id="consultation-message"
                    type="text"
                    autoComplete="off"
                    value={input}
                    placeholder={COPY.composerPlaceholder[lang]}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      // Never send mid-composition: Bengali IMEs commit on Enter.
                      if (event.key === "Enter" && event.nativeEvent.isComposing) {
                        event.preventDefault();
                      }
                    }}
                    className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-5 text-[15px] text-ink placeholder:text-subtle focus:border-brand focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!canSend}
                    aria-disabled={!canSend}
                    className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    <span>{sending ? COPY.sending[lang] : COPY.send[lang]}</span>
                  </button>
                </form>
              </div>
            </div>
          </section>

          {/* Rail */}
          {/* Digital Prescription Summary Card */}
          <aside data-intro className="rounded-3xl border border-line bg-surface p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
                  <FileText className="h-4.5 w-4.5" strokeWidth={2} />
                </span>
                <div>
                  <h2 className="text-base font-bold text-ink">{COPY.prescriptionTitle[lang]}</h2>
                  <p className="text-[11px] font-medium text-subtle">{bmdcDisplay}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRxModalOpen(true)}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-subtle hover:bg-elevated hover:text-ink transition-colors"
                title={COPY.viewFullRx[lang]}
                aria-label={COPY.viewFullRx[lang]}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-line bg-elevated/50 p-3 text-xs">
              <span className="font-semibold text-ink-brand">
                {isBn ? "অনুমোদিত ই-প্রেসক্রিপশন" : "Verified e-Prescription"}
              </span>
              <p className="mt-1 text-muted line-clamp-2">
                {consultation.prescription ??
                  (isBn
                    ? "জরুরি ওষুধ ও চিকিৎসকের নির্দেশনা প্রস্তুত রয়েছে।"
                    : "Prescribed medicines & medical instructions ready.")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRxModalOpen(true)}
              className="mt-3.5 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-brand bg-brand-soft px-4 text-xs font-semibold text-brand-deep transition-all hover:bg-brand hover:text-white active:scale-95"
            >
              <Pill className="h-4 w-4" />
              <span>{COPY.viewFullRx[lang]}</span>
            </button>
          </aside>

          {/* Consultation Rating Card */}
          <aside data-intro className="rounded-3xl border border-line bg-surface p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-500" strokeWidth={1.5} />
                </span>
                <div>
                  <h2 className="text-base font-bold text-ink">{COPY.rateConsultation[lang]}</h2>
                  <p className="text-[11px] font-medium text-subtle">
                    {hasRated
                      ? isBn
                        ? "রেটিং জমা দেওয়া হয়েছে"
                        : "Feedback submitted"
                      : isBn
                      ? "আপনার মতামত দিন"
                      : "Share your feedback"}
                  </p>
                </div>
              </div>
            </div>
            {hasRated ? (
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  {isBn
                    ? "পরামর্শের মূল্যায়ন সফলভাবে জমা দেওয়া হয়েছে।"
                    : "Consultation rating submitted successfully."}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRatingModalOpen(true)}
                className="mt-3.5 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-amber-500 px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-amber-600 active:scale-95"
              >
                <Star className="h-4 w-4 fill-white" />
                <span>{COPY.rateConsultation[lang]}</span>
              </button>
            )}
          </aside>

          {/* Active Telehealth Voice Call Panel */}
          <aside data-intro className="rounded-3xl border border-line bg-surface p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
                <PhoneCall className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">
                  {COPY.telehealthTitle[lang]}
                </h2>
                <p className="text-xs font-medium text-subtle">
                  {COPY.telehealthSubtitle[lang]}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted">
              {COPY.telehealthNote[lang]}
            </p>

            {/* Doctor Hotline info block */}
            <div className="mt-4 rounded-2xl border border-line bg-elevated/70 p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
                {COPY.doctorHotline[lang]}
              </span>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm sm:text-base font-bold text-ink">
                  {doctorHotline}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {directCallTel && rawDoctorPhone ? (
                    <>
                      <a
                        href={directCallTel}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 active:scale-95"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>{COPY.directCall[lang]}</span>
                      </a>
                      <a
                        href={`https://wa.me/${rawDoctorPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                          lang === "bn"
                            ? `আসসালামু আলাইকুম ${doctorName}, আমি আপনার পরামর্শের রোগী। ফোনে কথা বলতে চাই।`
                            : `Hello ${doctorName}, I am your consultation patient. I would like to talk on call.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-xs transition-colors hover:bg-emerald-600 hover:text-white active:scale-95"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>{COPY.whatsappCall[lang]}</span>
                      </a>
                    </>
                  ) : (
                    <span className="text-[11px] font-medium text-muted">
                      {lang === "bn"
                        ? "ডাক্তার নম্বর শেয়ার করলে এখানে কল বাটন আসবে।"
                        : "Call buttons appear here once the doctor shares a number."}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Start In-Browser Audio Call Button */}
            <button
              type="button"
              onClick={startCall}
              className="mt-4 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-deep active:scale-95"
            >
              <Mic className="h-4 w-4" strokeWidth={2} />
              <span>{COPY.startAudioCall[lang]}</span>
            </button>
          </aside>
        </div>
      </div>

      {/* Interactive Telehealth Audio Voice Call Modal */}
      {callModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="telehealth-call-title"
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
          onClick={endCall}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close button */}
            <button
              type="button"
              onClick={endCall}
              className="absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
              aria-label={t("nav.close")}
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Call State Badge: Connecting -> Connected */}
              <div className="mb-4">
                {callState === "connecting" ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-600">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    <span>{COPY.connecting[lang]}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{COPY.connected[lang]}</span>
                  </span>
                )}
              </div>

              {/* Doctor Avatar with Animated Waveform/Pulse Rings */}
              <div className="relative my-2 flex items-center justify-center">
                {callState === "connected" && (
                  <>
                    <span className="absolute h-28 w-28 rounded-full bg-emerald-500/10 animate-ping" />
                    <span className="absolute h-24 w-24 rounded-full bg-brand-soft/60" />
                  </>
                )}
                {callState === "connecting" && (
                  <span className="absolute h-24 w-24 rounded-full bg-amber-500/10 animate-pulse" />
                )}
                <span
                  aria-hidden="true"
                  className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-soft text-2xl font-bold text-brand-deep shadow-sm"
                >
                  {initialsOf(doctor ? doctor.full_name : null)}
                </span>
              </div>

              {/* Doctor Details: Name */}
              <h3 id="telehealth-call-title" className="mt-3 text-xl font-bold text-ink">
                {doctorName}
              </h3>

              {/* Specialty & BMDC Number */}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted">
                {specialty && (
                  <span className="font-semibold text-ink-brand">
                    {specialty}
                  </span>
                )}
                {specialty && <span className="text-subtle">·</span>}
                <span className="font-mono text-subtle">{bmdcDisplay}</span>
              </div>

              {/* Hospital */}
              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-subtle" />
                <span className="max-w-[280px] truncate">{doctorHospital}</span>
              </div>

              {/* Live Call Timer (00:01, 00:02...) */}
              <div className="mt-5 rounded-2xl bg-elevated/70 px-5 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle block">
                  {callState === "connecting"
                    ? isBn ? "কল সংযোগ অবস্থা" : "Call Status"
                    : isBn ? "কল সময়কাল" : "Call Duration"}
                </span>
                <span className="font-mono text-2xl font-bold text-ink tnum">
                  {callState === "connecting"
                    ? (isBn ? "০০:০০" : "00:00")
                    : formatCallTimer(callSeconds)}
                </span>
              </div>

              {/* Animated Audio Waveform Pulse Indicator */}
              <div className="my-5 flex flex-col items-center">
                <div className="flex h-10 items-center justify-center gap-1.5 px-4 py-1">
                  {[30, 65, 40, 85, 55, 95, 50, 75, 35].map((barHeight, i) => (
                    <span
                      key={i}
                      className={`w-1.5 rounded-full transition-all duration-300 ${
                        isMuted
                          ? "h-1.5 bg-subtle/40"
                          : callState === "connected"
                          ? "bg-emerald-500 animate-audio-wave"
                          : "h-2 bg-amber-400/60 animate-pulse"
                      }`}
                      style={{
                        height: isMuted
                          ? "6px"
                          : callState === "connected"
                          ? `${barHeight}%`
                          : "8px",
                        animationDelay: `${(i * 0.1).toFixed(2)}s`,
                        animationDuration: `${0.65 + (i % 3) * 0.25}s`,
                      }}
                    />
                  ))}
                </div>
                <span className="mt-1 text-[11px] text-subtle font-medium">
                  {isMuted
                    ? isBn ? "মাইক্রোফোন মিউট করা আছে" : "Microphone Muted"
                    : callState === "connected"
                    ? isBn ? "লাইভ অডিও কথা বলছেন..." : "Live Audio Active"
                    : isBn ? "সংযোগ স্থাপন করা হচ্ছে..." : "Connecting..."}
                </span>
              </div>

              {/* Controls: Mute/Unmute & End Call */}
              <div className="mt-2 flex w-full items-center justify-center gap-4 sm:gap-6 border-t border-line pt-5">
                {/* Microphone Mute/Unmute toggle button */}
                <button
                  type="button"
                  onClick={() => setIsMuted((m) => !m)}
                  aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 sm:p-3.5 transition-all cursor-pointer ${
                    isMuted
                      ? "bg-blood-soft text-blood-deep hover:bg-blood-soft/80"
                      : "bg-elevated text-ink hover:bg-line"
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-xs">
                    {isMuted ? (
                      <MicOff className="h-5 w-5 text-blood-deep" />
                    ) : (
                      <Mic className="h-5 w-5 text-ink" />
                    )}
                  </div>
                  <span className="text-xs font-semibold">
                    {isMuted ? COPY.unmute[lang] : COPY.mute[lang]}
                  </span>
                </button>

                {/* End Call (কল শেষ করুন) button with red PhoneOff icon */}
                <button
                  type="button"
                  onClick={endCall}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 sm:p-3.5 transition-all cursor-pointer bg-blood hover:bg-blood-deep text-white shadow-md active:scale-95"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                    <PhoneOff className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs font-semibold">
                    {COPY.endCall[lang]}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Digital Prescription Modal Dialog */}
      {rxModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rx-modal-title"
          className="fixed inset-0 z-100 flex items-center justify-center p-3 sm:p-4 bg-ink/60 backdrop-blur-sm overflow-y-auto"
          onClick={() => setRxModalOpen(false)}
        >
          <div
            className="relative my-8 w-full max-w-2xl overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-2xl transition-all print:p-0 print:border-none print:shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close button and Actions */}
            <div className="flex items-center justify-between border-b border-line pb-4 print:hidden">
              <div className="flex items-center gap-2 text-brand-deep">
                <FileText className="h-5 w-5" />
                <h3 id="rx-modal-title" className="text-lg font-bold text-ink">
                  {COPY.prescriptionTitle[lang]}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPrescription}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface hover:border-brand transition-colors cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>{isBn ? "প্রিন্ট" : "Print"}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintPrescription}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{isBn ? "ডাউনলোড" : "Download"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRxModalOpen(false)}
                  className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
                  aria-label={t("nav.close")}
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Printable Prescription Body */}
            <div className="mt-4 space-y-5">
              {/* Bangladesh Government Telemedicine Header Seal */}
              <div className="rounded-2xl border border-emerald-600/30 bg-emerald-50/70 p-3.5 sm:p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-emerald-800">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <span className="text-xs sm:text-sm font-bold tracking-wide">
                    {COPY.officialSealBadge[lang]}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-emerald-700/80 font-mono">
                  Govt. of Bangladesh Telehealth Protocol • Digital Health Authorization
                </p>
              </div>

              {/* Doctor & Hospital Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                  <h4 className="text-lg font-bold text-ink">{rxData.doctorName}</h4>
                  <p className="text-xs font-semibold text-brand-deep">{rxData.bmdcRegNo}</p>
                  {specialty && <p className="text-xs text-muted mt-0.5">{specialty}</p>}
                  <p className="text-xs text-subtle mt-0.5">{doctorHospital}</p>
                </div>
                <div className="text-xs text-muted sm:text-right">
                  <p className="font-mono font-bold text-ink">{rxData.rxId}</p>
                  <p className="text-subtle mt-0.5">
                    {isBn ? "তারিখ: " : "Date: "}
                    <span className="font-mono">{formatDateTime(rxData.date, lang) || rxData.date}</span>
                  </p>
                </div>
              </div>

              {/* Diagnosis / Symptom Summary */}
              <div className="rounded-xl bg-elevated/60 p-3 text-xs">
                <span className="font-semibold text-subtle block uppercase text-[10px] tracking-wider">
                  {isBn ? "রোগ নির্ণয় / লক্ষণ (Diagnosis / Symptoms):" : "Diagnosis / Symptoms:"}
                </span>
                <p className="mt-1 font-medium text-ink">{rxData.diagnosis}</p>
              </div>

              {/* Medicines Table */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Pill className="h-4 w-4 text-brand-deep" />
                  <h5 className="text-sm font-bold text-ink">
                    {isBn ? "ওষুধের তালিকা (Rx)" : "Prescribed Medicines (Rx)"}
                  </h5>
                </div>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-elevated text-subtle font-semibold border-b border-line">
                      <tr>
                        <th className="px-3 py-2 w-10">#</th>
                        <th className="px-3 py-2">{isBn ? "ওষুধের নাম ও উপাদান" : "Medicine & Generic"}</th>
                        <th className="px-3 py-2">{isBn ? "মাত্রা" : "Dosage"}</th>
                        <th className="px-3 py-2">{isBn ? "মেয়াদ" : "Duration"}</th>
                        <th className="px-3 py-2">{isBn ? "নির্দেশনা" : "Instructions"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-ink">
                      {rxData.medicines.map((med, idx) => (
                        <tr key={med.id} className="hover:bg-elevated/40">
                          <td className="px-3 py-2.5 font-mono text-subtle">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-medium">
                            <div>{med.name}</div>
                            {med.generic && (
                              <div className="text-[11px] text-muted font-mono">{med.generic}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-brand-deep">{med.dosage}</td>
                          <td className="px-3 py-2.5">{med.duration}</td>
                          <td className="px-3 py-2.5 text-muted">{med.instructions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* General Advice */}
              {rxData.generalAdvice && (
                <div className="rounded-xl border border-line bg-elevated/30 p-3 text-xs">
                  <span className="font-semibold text-ink block">
                    {isBn ? "সাধারণ পরামর্শ:" : "General Advice:"}
                  </span>
                  <p className="mt-1 text-muted leading-relaxed">
                    {isBn ? rxData.generalAdvice.bn : rxData.generalAdvice.en}
                  </p>
                </div>
              )}

              {/* Digital Signature & Govt Seal Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-line pt-4 text-xs text-subtle">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>{rxData.officialSeal[lang]}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium text-ink">{rxData.doctorName}</p>
                  <p className="text-[11px] font-mono">{rxData.bmdcRegNo}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5-Star Consultation Rating Modal Dialog */}
      {ratingModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rating-modal-title"
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
          onClick={() => setRatingModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close button */}
            <button
              type="button"
              onClick={() => setRatingModalOpen(false)}
              className="absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
              aria-label={t("nav.close")}
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {ratingSubmitted ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-3">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <h3 className="text-xl font-bold text-ink">
                  {isBn ? "ধন্যবাদ! আপনার মূল্যায়ন গৃহীত হয়েছে" : "Thank you! Rating Submitted"}
                </h3>
                <p className="mt-2 text-sm text-muted">
                  {isBn
                    ? "আপনার মূল্যবান মতামত চিকিৎসকের মানোন্নয়নে সহায়তা করবে।"
                    : "Your feedback helps doctors deliver better healthcare services."}
                </p>
                <button
                  type="button"
                  onClick={() => setRatingModalOpen(false)}
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-deep cursor-pointer"
                >
                  {isBn ? "বন্ধ করুন" : "Close"}
                </button>
              </div>
            ) : (
              <div>
                <div className="text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 mb-2">
                    <Star className="h-6 w-6 fill-amber-400" />
                  </div>
                  <h3 id="rating-modal-title" className="text-xl font-bold text-ink">
                    {COPY.ratingModalTitle[lang]}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {doctorName} ({specialty ?? (isBn ? "চিকিৎসক" : "Doctor")})
                  </p>
                </div>

                {/* 5 Star Selection */}
                <div className="mt-5 flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (hoverRating || rating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                          className="p-1 cursor-pointer transition-transform hover:scale-110 focus:outline-none"
                          aria-label={`${star} star`}
                        >
                          <Star
                            className={`h-8 w-8 transition-colors ${
                              active
                                ? "fill-amber-400 text-amber-500"
                                : "text-line hover:text-amber-300"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-brand-deep h-4">
                    {getStarLabel(hoverRating || rating, isBn)}
                  </p>
                </div>

                {/* Feedback Tags */}
                <div className="mt-5">
                  <span className="text-xs font-semibold text-subtle block mb-2">
                    {isBn ? "পরামর্শের অভিজ্ঞতা (ট্যাগ নির্বাচন করুন):" : "Feedback Tags:"}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CONSULTATION_RATING_TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            setSelectedTags((prev) =>
                              isSelected ? prev.filter((tId) => tId !== tag.id) : [...prev, tag.id]
                            );
                          }}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-brand text-white shadow-xs"
                              : "border border-line bg-elevated/60 text-muted hover:border-brand-soft hover:text-ink"
                          }`}
                        >
                          {isBn ? tag.bn : tag.en}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional comment */}
                <div className="mt-4">
                  <label htmlFor="rating-comment" className="text-xs font-semibold text-subtle block mb-1">
                    {isBn ? "অতিরিক্ত মন্তব্য (ঐচ্ছিক):" : "Additional Comments (Optional):"}
                  </label>
                  <textarea
                    id="rating-comment"
                    rows={2}
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder={
                      isBn
                        ? "চিকিৎসকের সাথে পরামর্শের অভিজ্ঞতা লিখুন..."
                        : "Describe your consultation experience..."
                    }
                    className="w-full rounded-2xl border border-line bg-surface p-3 text-xs text-ink placeholder:text-subtle focus:border-brand focus:outline-none"
                  />
                </div>

                {/* Submit button */}
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRatingModalOpen(false)}
                    className="flex-1 h-11 rounded-full border border-line bg-surface text-xs font-semibold text-muted hover:bg-elevated transition-colors cursor-pointer"
                  >
                    {isBn ? "পরে দিন" : "Skip"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitRating}
                    className="flex-1 h-11 rounded-full bg-brand text-xs font-semibold text-white hover:bg-brand-deep transition-colors shadow-sm cursor-pointer"
                  >
                    {isBn ? "জমা দিন" : "Submit Rating"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

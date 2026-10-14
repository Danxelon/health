/**
 * Login — Dual-mode login interface:
 * 1. Citizen / Donor (Mobile OTP) [নাগরিক / রক্তদাতা]
 *    Fast 2-step phone number + 6-digit OTP ("201222" for every number,
 *    no SMS is sent) flow. After the code
 *    is accepted a REAL Supabase session + profile row is provisioned (see
 *    `@/api/registration.ts`), so the account exists in the database.
 * 2. Admin & Doctor Login [অ্যাডমিন ও ডাক্তার লগইন]
 *    Institutional credentials flow using Email and Password against the
 *    live database. Quick-fill badges insert the seeded staff emails.
 *    Direct role-based routing: Admin -> /admin, Doctor -> /articles (or next).
 */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  House,
  KeyRound,
  Lock,
  Mail,
  Phone,
  RotateCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import { ensureCitizenSession } from "@/api/registration.ts";
import { isValidPhoneBD, maskPhone, normalisePhoneBD } from "@/domain/profile.ts";

gsap.registerPlugin(useGSAP);

type LoginMode = "citizen" | "staff";
type Step = 1 | 2;

/** Which failure the code field is showing, as a key rather than a sentence so
 *  a language switch mid-error re-renders in the new language. */
type OtpIssue = "length" | "wrong" | null;

/** The universal gate code — same for every phone number, no SMS is sent. */
const GATE_CODE = "201222";

const COPY = {
  tabCitizen: {
    bn: "নাগরিক / রক্তদাতা",
    en: "Citizen / Donor",
  },
  tabCitizenBadge: {
    bn: "মোবাইল ওটিপি",
    en: "Mobile OTP",
  },
  tabStaff: {
    bn: "অ্যাডমিন ও ডাক্তার লগইন",
    en: "Admin / Doctor Login",
  },
  subtitleCitizen: {
    bn: "মোবাইল নম্বর দিন — আমরা একটি ছয় সংখ্যার কোড পাঠাব।",
    en: "Enter your mobile number and we will send a six-digit code.",
  },
  subtitleStaff: {
    bn: "স্বাস্থ্য অধিদপ্তর ও অনুমোদিত চিকিৎসকদের প্রাতিষ্ঠানিক লগইন পোর্টাল।",
    en: "Institutional portal for health officials & verified doctors.",
  },
  emailLabel: {
    bn: "অফিসিয়াল ইমেইল",
    en: "Official Email",
  },
  passwordLabel: {
    bn: "পাসওয়ার্ড",
    en: "Password",
  },
  quickFillTitle: {
    bn: "সংরক্ষিত স্টাফ অ্যাকাউন্ট:",
    en: "Seeded staff accounts:",
  },
  demoAdmin: {
    bn: "Demo Admin",
    en: "Demo Admin",
  },
  demoDoctor: {
    bn: "Demo Doctor",
    en: "Demo Doctor",
  },
  signIn: {
    bn: "সাইন ইন করুন",
    en: "Sign In",
  },
  signingIn: {
    bn: "সাইন ইন হচ্ছে…",
    en: "Signing In…",
  },
  emptyCreds: {
    bn: "ইমেইল এবং পাসওয়ার্ড দুটিই প্রয়োজন।",
    en: "Both email and password are required.",
  },
  credWrong: {
    bn: "ইমেইল বা পাসওয়ার্ড সঠিক নয়। আবার চেষ্টা করুন।",
    en: "Invalid email or password. Please try again.",
  },
  codeSentTo: {
    bn: "নম্বরে কোড পাঠানো হয়েছে",
    en: "Code sent to",
  },
  secure: {
    bn: "নিরাপদ যাচাই — কোডটি কারও সঙ্গে ভাগ করবেন না।",
    en: "Secure check — never share this code with anyone.",
  },
  verifying: {
    bn: "যাচাই হচ্ছে…",
    en: "Verifying…",
  },
  back: {
    bn: "পেছনে",
    en: "Back",
  },
  requested: {
    bn: "নতুন কোডের অনুরোধ নেওয়া হয়েছে।",
    en: "You asked for a new code.",
  },
  needAccount: {
    bn: "এখনো অ্যাকাউন্ট নেই?",
    en: "New here?",
  },
  phoneInvalid: {
    bn: "একটি বৈধ মোবাইল নম্বর দিন।",
    en: "Enter a valid mobile number.",
  },
  codeLength: {
    bn: "ছয় সংখ্যার কোড লিখুন।",
    en: "Enter the six-digit code.",
  },
  codeWrong: {
    bn: "কোডটি সঠিক নয়। আবার চেষ্টা করুন।",
    en: "That code is not correct. Try again.",
  },
} as const;

/** Bengali puts the number first, English last — the label carries the order. */
function sentLine(lang: "bn" | "en", masked: string): string {
  return lang === "bn"
    ? `${masked} ${COPY.codeSentTo.bn}`
    : `${COPY.codeSentTo.en} ${masked}`;
}

export default function Login() {
  const { t, lang } = useAppShell();
  const { login, loginWithCredentials } = useAuth();
  const navigate = useNavigate();

  // Active Login Mode Tab
  const [activeTab, setActiveTab] = useState<LoginMode>(() => {
    try {
      const mode = new URLSearchParams(window.location.search).get("mode");
      return mode === "staff" ? "staff" : "citizen";
    } catch {
      return "citizen";
    }
  });

  // Citizen OTP State
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpIssue, setOtpIssue] = useState<OtpIssue>(null);
  // Backend failure after a CORRECT code (session/provisioning). Shown
  // separately so a database problem never looks like a mistyped code.
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [submittingOtp, setSubmittingOtp] = useState(false);

  // Admin / Doctor Credentials State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [submittingCred, setSubmittingCred] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const phoneOk = isValidPhoneBD(phone);
  const phoneError = phone.length > 0 && !phoneOk ? COPY.phoneInvalid[lang] : null;
  const otpError =
    otpIssue === null
      ? null
      : otpIssue === "length"
        ? COPY.codeLength[lang]
        : COPY.codeWrong[lang];

  const goToStep2 = () => {
    if (!phoneOk) return;
    setOtp("");
    setOtpIssue(null);
    setProvisionError(null);
    setRequested(false);
    setStep(2);
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      setOtpIssue("length");
      return;
    }
    if (otp !== GATE_CODE) {
      setOtpIssue("wrong");
      setProvisionError(null);
      return;
    }
    setSubmittingOtp(true);
    setOtpIssue(null);
    setProvisionError(null);
    try {
      // Real account: provision (or reuse) the Supabase session for this
      // number so the citizen exists in the database, then cache locally.
      await ensureCitizenSession(phone);
      const displayName = normalisePhoneBD(phone) ?? phone;
      login(phone || "01711000000", displayName, "citizen");
      const next = new URLSearchParams(window.location.search).get("next") || "/donors";
      navigate(next, { replace: true });
    } catch (err: unknown) {
      // The code was right — the backend call failed. Say so explicitly.
      const message = err instanceof Error ? err.message : "Login failed. Try again.";
      setProvisionError(message);
      console.warn("Citizen session provisioning failed:", message);
    } finally {
      setSubmittingOtp(false);
    }
  };

  const requestNewCode = () => {
    setOtp("");
    setOtpIssue(null);
    setProvisionError(null);
    setRequested(true);
  };

  const fillDemoAdmin = () => {
    setEmail("showystore2026@gmail.com");
    setPassword("iloveyou");
    setCredError(null);
  };

  const fillDemoDoctor = () => {
    setEmail("dr.rahman@health.gov.bd");
    setPassword("Doctor2026!");
    setCredError(null);
  };

  const handleCredentialSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setCredError(COPY.emptyCreds[lang]);
      return;
    }

    setSubmittingCred(true);
    setCredError(null);

    try {
      const res = await loginWithCredentials(email.trim(), password);
      if (res.success) {
        const next = new URLSearchParams(window.location.search).get("next");
        if (res.role === "admin") {
          navigate("/admin", { replace: true });
        } else if (res.role === "doctor") {
          navigate(next || "/articles", { replace: true });
        } else {
          navigate(next || "/donors", { replace: true });
        }
      } else {
        setCredError(res.error || COPY.credWrong[lang]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication error";
      setCredError(message);
    } finally {
      setSubmittingCred(false);
    }
  };

  // Step & Tab transition — a smooth cross-fade on the incoming panel
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const active = containerRef.current?.querySelector<HTMLElement>("[data-active='true']");
      if (!active) return;
      gsap.fromTo(
        active,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }
      );
    },
    { scope: containerRef, dependencies: [activeTab, step] }
  );

  // Put caret where next action is
  useEffect(() => {
    if (activeTab === "citizen") {
      if (step === 1) phoneRef.current?.focus();
      else otpRef.current?.focus();
    } else {
      if (!email) emailRef.current?.focus();
      else passwordRef.current?.focus();
    }
  }, [activeTab, step]);

  const maskedPhone = maskPhone(normalisePhoneBD(phone));

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <div className="mx-auto w-full max-w-xl px-4 sm:px-6 pb-24">
        {/* Attention Header */}
        <header className="pt-14 text-center sm:pt-20">
          <h1 className="display mx-auto max-w-6xl text-[clamp(2.25rem,5.2vw,4rem)] text-ink">
            {t("auth.login")}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-muted">
            {activeTab === "citizen" ? COPY.subtitleCitizen[lang] : COPY.subtitleStaff[lang]}
          </p>
        </header>

        {/* Dual-Mode Tab Switcher */}
        <div
          role="tablist"
          aria-label={lang === "bn" ? "লগইন মোড নির্বাচন" : "Select login mode"}
          className="mt-8 grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-surface p-1.5 shadow-xs"
        >
          <button
            type="button"
            role="tab"
            id="tab-citizen"
            aria-selected={activeTab === "citizen"}
            aria-controls="panel-citizen"
            onClick={() => {
              setActiveTab("citizen");
              setCredError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "citizen"
                ? "bg-brand text-white shadow-sm"
                : "text-muted hover:text-ink hover:bg-elevated"
            }`}
          >
            <Smartphone className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="truncate">
              {COPY.tabCitizen[lang]}
              <span className="hidden sm:inline sm:ml-1 text-[11px] font-normal opacity-85">
                ({COPY.tabCitizenBadge[lang]})
              </span>
            </span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-staff"
            aria-selected={activeTab === "staff"}
            aria-controls="panel-staff"
            onClick={() => {
              setActiveTab("staff");
              setCredError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "staff"
                ? "bg-brand text-white shadow-sm"
                : "text-muted hover:text-ink hover:bg-elevated"
            }`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="truncate">{COPY.tabStaff[lang]}</span>
          </button>
        </div>

        {/* Step Numbers Indicator (Citizen Mode only) */}
        {activeTab === "citizen" && (
          <ol
            className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold"
            aria-label={t("auth.login")}
          >
            {([1, 2] as const).map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={`tnum flex h-6 w-6 items-center justify-center rounded-full ${
                    step === s
                      ? "bg-brand text-white"
                      : step > s
                        ? "bg-brand-soft text-brand-deep"
                        : "bg-elevated text-subtle"
                  }`}
                >
                  {s}
                </span>
                {i < 1 && <span className="h-px w-6 bg-line" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        )}

        <div ref={containerRef} className="mt-6">
          {/* ================================================================= */}
          {/* TAB 1: Citizen / Donor (Mobile OTP)                               */}
          {/* ================================================================= */}
          <div
            id="panel-citizen"
            role="tabpanel"
            aria-labelledby="tab-citizen"
            hidden={activeTab !== "citizen"}
          >
            {/* ---------------- Step 1 — Phone Number ---------------- */}
            <section
              data-active={activeTab === "citizen" && step === 1 ? "true" : "false"}
              hidden={activeTab !== "citizen" || step !== 1}
              aria-label={t("auth.phone")}
              className="reveal-init"
            >
              <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                <label className="block text-sm font-semibold text-ink" htmlFor="login-phone">
                  <span className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted" strokeWidth={1.8} aria-hidden="true" />
                    {t("auth.phone")}
                  </span>
                </label>
                <input
                  id="login-phone"
                  ref={phoneRef}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  aria-invalid={phoneError !== null}
                  aria-describedby={phoneError ? "login-phone-error" : undefined}
                  className="tnum mt-3 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none transition-colors focus:border-brand"
                />
                {phoneError && (
                  <p id="login-phone-error" role="alert" className="mt-2 text-xs text-blood-deep">
                    {phoneError}
                  </p>
                )}

                <button
                  type="button"
                  disabled={!phoneOk}
                  onClick={goToStep2}
                  className="mt-6 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-40"
                >
                  {t("auth.sendOtp")}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                </button>

                {/* Every citizen signs in with the OTP code above — the
                    account is provisioned in the database on first login. */}
              </div>
            </section>

            {/* ---------------- Step 2 — 6-digit OTP Code ---------------- */}
            <section
              data-active={activeTab === "citizen" && step === 2 ? "true" : "false"}
              hidden={activeTab !== "citizen" || step !== 2}
              aria-label={t("auth.otp")}
              className="reveal-init"
            >
              <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                <p className="flex items-start gap-2.5 text-sm text-muted">
                  <Smartphone
                    className="mt-0.5 h-4 w-4 shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span>{sentLine(lang, maskedPhone)}</span>
                </p>
                <p className="mt-3 flex items-start gap-2.5 text-sm text-success">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span>{COPY.secure[lang]}</span>
                </p>

                <label className="mt-6 block text-sm font-semibold text-ink" htmlFor="login-otp">
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted" strokeWidth={1.8} aria-hidden="true" />
                    {t("auth.otp")}
                  </span>
                </label>
                <input
                  id="login-otp"
                  ref={otpRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  dir="ltr"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setOtpIssue(null);
                    setProvisionError(null);
                    setRequested(false);
                  }}
                  placeholder="000000"
                  aria-invalid={otpError !== null || provisionError !== null}
                  aria-describedby={otpError || provisionError ? "login-otp-error" : undefined}
                  className="tnum mt-3 w-full rounded-xl border border-line bg-surface px-4 py-3 text-center text-2xl tracking-[0.5em] text-ink outline-none transition-colors focus:border-brand"
                />
                {otpError && (
                  <p id="login-otp-error" role="alert" className="mt-2 text-xs text-blood-deep">
                    {otpError}
                  </p>
                )}
                {provisionError && (
                  <p role="alert" className="mt-2 text-xs text-blood-deep">
                    {lang === "bn" ? "কোড সঠিক, কিন্তু অ্যাকাউন্ট তৈরি হয়নি: " : "Code accepted, but sign-in failed: "}
                    {provisionError}
                  </p>
                )}

                <button
                  type="button"
                  disabled={otp.length !== 6 || submittingOtp}
                  onClick={verifyOtp}
                  aria-busy={submittingOtp}
                  className="mt-6 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-40"
                >
                  {submittingOtp ? (
                    <>
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                        aria-hidden="true"
                      />
                      {COPY.verifying[lang]}
                    </>
                  ) : (
                    <>
                      {t("auth.verify")}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    </>
                  )}
                </button>
                <span role="status" aria-live="polite" className="sr-only">
                  {submittingOtp ? COPY.verifying[lang] : ""}
                </span>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-line-strong"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    {COPY.back[lang]}
                  </button>
                  <button
                    type="button"
                    onClick={requestNewCode}
                    className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-brand-deep underline-offset-4 transition-colors hover:text-brand hover:underline"
                  >
                    <RotateCw className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    {t("auth.resend")}
                  </button>
                </div>
                <p role="status" aria-live="polite" className="mt-2 text-xs text-success">
                  {requested ? COPY.requested[lang] : ""}
                </p>
              </div>
            </section>
          </div>

          {/* ================================================================= */}
          {/* TAB 2: Admin / Doctor Login                                       */}
          {/* ================================================================= */}
          <div
            id="panel-staff"
            role="tabpanel"
            aria-labelledby="tab-staff"
            hidden={activeTab !== "staff"}
          >
            <section
              data-active={activeTab === "staff" ? "true" : "false"}
              aria-label={COPY.tabStaff[lang]}
              className="reveal-init"
            >
              <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                {/* Pre-filled / Quick-fill Hint Badges */}
                <div className="mb-6 rounded-xl border border-line bg-elevated/70 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-ink">
                    <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={2.2} aria-hidden="true" />
                    <span>{COPY.quickFillTitle[lang]}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={fillDemoAdmin}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs transition-all hover:border-brand hover:text-brand cursor-pointer"
                      title="Quick fill showystore2026@gmail.com / iloveyou"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-blood-deep" strokeWidth={2} aria-hidden="true" />
                      <span>{COPY.demoAdmin[lang]}</span>
                      <span className="text-[11px] text-muted font-normal">(showystore2026@gmail.com)</span>
                    </button>
                    <button
                      type="button"
                      onClick={fillDemoDoctor}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs transition-all hover:border-brand hover:text-brand cursor-pointer"
                      title="Quick fill dr.rahman@health.gov.bd / Doctor2026!"
                    >
                      <Stethoscope className="h-3.5 w-3.5 text-success" strokeWidth={2} aria-hidden="true" />
                      <span>{COPY.demoDoctor[lang]}</span>
                      <span className="text-[11px] text-muted font-normal">(dr.rahman@health.gov.bd)</span>
                    </button>
                  </div>
                </div>

                {/* Form fields */}
                <form onSubmit={handleCredentialSubmit} noValidate>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-ink" htmlFor="login-email">
                        <span className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted" strokeWidth={1.8} aria-hidden="true" />
                          {COPY.emailLabel[lang]}
                        </span>
                      </label>
                      <input
                        id="login-email"
                        ref={emailRef}
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (credError) setCredError(null);
                        }}
                        placeholder="admin@health.gov.bd"
                        className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none transition-colors focus:border-brand placeholder:text-muted/60"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-ink" htmlFor="login-password">
                        <span className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-muted" strokeWidth={1.8} aria-hidden="true" />
                          {COPY.passwordLabel[lang]}
                        </span>
                      </label>
                      <div className="relative mt-2">
                        <input
                          id="login-password"
                          ref={passwordRef}
                          type={showPassword ? "text" : "password"}
                          name="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (credError) setCredError(null);
                          }}
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-line bg-surface px-4 py-3 pr-11 text-ink outline-none transition-colors focus:border-brand placeholder:text-muted/60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors cursor-pointer p-1"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {credError && (
                    <div
                      id="login-cred-error"
                      role="alert"
                      className="mt-4 flex items-start gap-2.5 rounded-xl border border-blood-soft bg-blood-soft/60 p-3.5 text-xs font-semibold text-blood-deep animate-shake"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden="true" />
                      <span>{credError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingCred || !email.trim() || !password}
                    className="mt-6 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-40 shadow-sm"
                  >
                    {submittingCred ? (
                      <>
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                          aria-hidden="true"
                        />
                        {COPY.signingIn[lang]}
                      </>
                    ) : (
                      <>
                        <span>{COPY.signIn[lang]}</span>
                        <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </section>
          </div>
        </div>

        {/* Action — Register and Home links */}
        <div className="mt-10 space-y-3 text-center text-sm">
          <p className="text-muted">{COPY.needAccount[lang]}</p>
          <Link
            to="/register"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-7 text-[15px] font-semibold text-ink transition-colors hover:border-line-strong"
          >
            {t("auth.register")}
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <p>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-semibold text-muted transition-colors hover:text-ink"
            >
              <House className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              {t("errors.goHome")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

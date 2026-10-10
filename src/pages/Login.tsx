/**
 * Login — phone, then a six-digit code. Two steps, nothing else.
 *
 * This is the screen a person reaches at 2am on a cheap Android phone, so it
 * carries exactly one field and one primary button at a time. It is
 * deliberately standalone: there is no api/auth module in this tree, so the
 * "send" is a UI transition and the code gate is the same honest demo gate the
 * register screen uses. Nothing here pretends a backend exists.
 *
 * The privacy rule this screen obeys without exception: the number is typed
 * once and never rendered again — every later reference goes through
 * `maskPhone()`, so someone reading over a shoulder learns an operator prefix
 * and nothing more.
 */

/**
 * <design_plan>
 * 1. RNG (seed = "Login page" char count 10 % 101 = 10):
 *    random.choice(HERO)      -> "Clean Center" (one column, centred)
 *    random.choice(COMPONENT) -> "two-step card" (phone card, then code card)
 *    random.choice(GSAP)      -> "step cross-fade"
 *    random.choice(FONT)      -> "Cabinet Grotesk / Satoshi"
 * 2. AIDA: Attention = the h1 and its one-line promise; Interest = step 1
 *    phone card; Desire = step 2, where the masked number and the
 *    never-share-this-code line do the reassuring; Action = the single
 *    `bg-brand` button under each step, plus the register link below the form.
 * 3. Container math: H1 `max-w-6xl` with `text-[clamp(2.25rem,5.2vw,4rem)]`.
 *    The clamp floor (2.25rem) holds the heading to one or two lines down to
 *    320px, because both titles are two words. The form card caps at
 *    `max-w-xl` so the field never stretches past a comfortable thumb reach.
 * 4. Density: this screen has no bento grid by design — one single-column card
 *    is visible at a time and only one of the two sections is ever rendered
 *    (the other is `hidden`), so there are no empty cells to interlock and
 *    nothing to span. Density here is vertical rhythm: `pt-14 sm:pt-20` to the
 *    h1, `mt-6` to the card, `mt-10` to the links.
 * 5. Label sweep: no meta-labels, no "STEP 01", no emoji. Primary button text
 *    is white on `bg-brand` (AA at this size); blood red appears only on the
 *    two error strings, each paired with words rather than colour alone.
 * </design_plan>
 */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ArrowLeft,
  ArrowRight,
  House,
  Info,
  KeyRound,
  Phone,
  RotateCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { isValidPhoneBD, maskPhone, normalisePhoneBD } from "@/domain/profile.ts";
import { DEMO_MODE } from "@/lib/supabase.ts";

gsap.registerPlugin(useGSAP);

type Step = 1 | 2;

/** Which failure the code field is showing, as a key rather than a sentence so
 *  a language switch mid-error re-renders in the new language. */
type OtpIssue = "length" | "wrong" | null;

/** The demo code, in one place so the hint and the gate cannot drift apart. */
const DEMO_CODE = "123456";

const COPY = {
  subtitle: {
    bn: "মোবাইল নম্বর দিন — আমরা একটি ছয় সংখ্যার কোড পাঠাব।",
    en: "Enter your mobile number and we will send a six-digit code.",
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
  fillCode: {
    bn: "কোড বসিয়ে দিন",
    en: "Fill the code",
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
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpIssue, setOtpIssue] = useState<OtpIssue>(null);
  const [requested, setRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

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
    setRequested(false);
    setStep(2);
  };

  const verify = () => {
    if (otp.length !== 6) {
      setOtpIssue("length");
      return;
    }
    setSubmitting(true);
    // The demo gate. A live build would call an OTP RPC from here; there is no
    // auth module in this tree, so this is the whole of the check — and the
    // demo note below the field says so out loud.
    window.setTimeout(() => {
      setSubmitting(false);
      if (otp === DEMO_CODE) {
        navigate("/donors", { replace: true });
      } else {
        setOtpIssue("wrong");
      }
    }, 500);
  };

  const requestNewCode = () => {
    setOtp("");
    setOtpIssue(null);
    setRequested(true);
  };

  // Step transition — a cross-fade on the incoming panel only. Under reduced
  // motion the whole block bails out and both panels are simply visible.
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const active = containerRef.current?.querySelector<HTMLElement>("[data-active='true']");
      if (!active) return;
      gsap.fromTo(
        active,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }
      );
    },
    { scope: containerRef, dependencies: [step] }
  );

  // Put the caret where the next action is; the point of a two-step flow is
  // that the next thing to do is never a hunt.
  useEffect(() => {
    if (step === 1) phoneRef.current?.focus();
    else otpRef.current?.focus();
  }, [step]);

  const maskedPhone = maskPhone(normalisePhoneBD(phone));

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <div className="mx-auto w-full max-w-xl px-4 sm:px-6 pb-24">
        {/* Attention */}
        <header className="pt-14 text-center sm:pt-20">
          <h1 className="display mx-auto max-w-6xl text-[clamp(2.25rem,5.2vw,4rem)] text-ink">
            {t("auth.login")}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-muted">{COPY.subtitle[lang]}</p>
        </header>

        <ol
          className="mt-8 flex items-center justify-center gap-2 text-xs font-semibold"
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

        <div ref={containerRef} className="mt-6">
          {/* ---------------- Step 1 — the number ---------------- */}
          <section
            data-active={step === 1 ? "true" : "false"}
            hidden={step !== 1}
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
            </div>
          </section>

          {/* ---------------- Step 2 — the code ---------------- */}
          <section
            data-active={step === 2 ? "true" : "false"}
            hidden={step !== 2}
            aria-label={t("auth.otp")}
            className="reveal-init"
          >
            <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
              {/* The number comes back masked, and the line under it says why
                  the code is worth keeping to yourself. */}
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
                  setRequested(false);
                }}
                placeholder="000000"
                aria-invalid={otpError !== null}
                aria-describedby={otpError ? "login-otp-error" : undefined}
                className="tnum mt-3 w-full rounded-xl border border-line bg-surface px-4 py-3 text-center text-2xl tracking-[0.5em] text-ink outline-none transition-colors focus:border-brand"
              />
              {otpError && (
                <p id="login-otp-error" role="alert" className="mt-2 text-xs text-blood-deep">
                  {otpError}
                </p>
              )}

              {/* Action */}
              <button
                type="button"
                disabled={otp.length !== 6 || submitting}
                onClick={verify}
                aria-busy={submitting}
                className="mt-6 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-40"
              >
                {submitting ? (
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
                {submitting ? COPY.verifying[lang] : ""}
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

              {DEMO_MODE && (
                <div
                  role="note"
                  className="mt-5 rounded-xl border border-line bg-brand-soft/60 px-4 py-3 text-xs text-brand-deep"
                >
                  <p className="flex items-start gap-2">
                    <Info
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>{t("auth.devNote")}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOtp(DEMO_CODE);
                      setOtpIssue(null);
                      setRequested(false);
                    }}
                    className="mt-2 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-3.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-elevated"
                  >
                    <RotateCw className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                    {COPY.fillCode[lang]}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Action — a new account is one tap away, and home is never lost. */}
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

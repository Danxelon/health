/**
 * Register — onboarding (NID · phone · basic details) + OTP.
 *
 * The form mirrors plan.md §7.2 `register_profile`: NID and phone are identity
 * keys collected here, followed by basic details and an OTP step.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ShieldCheck, Smartphone } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import { acceptableDonorsFor, isRareGroup } from "@/domain/blood.ts";
import { nidIssue, normalisePhoneBD } from "@/domain/profile.ts";
import { DEMO_UPAZILAS, districtsOf, upazilasOf } from "@/lib/demo-data.ts";
import { BLOOD_GROUPS, type BloodGroup } from "@/domain/types.ts";

type Step = 1 | 2 | 3;

/** The groups a patient of `group` can receive from, as a joined string. */
function acceptsText(group: BloodGroup, lang: "bn" | "en"): string {
  return acceptableDonorsFor(group)
    .map((g) => (lang === "bn" ? g.replace("+", " ধনাত্মক").replace("-", " ঋণাত্মক") : g))
    .join(" · ");
}

export default function Register() {
  const { t, lang } = useAppShell();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);

  // Step 1 — identity
  const [nid, setNid] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [nidTouched, setNidTouched] = useState(false);

  // Step 2 — details & upazila (cascading: division → district → upazila)
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [division, setDivision] = useState("");
  const [district, setDistrict] = useState("");
  const [upazila, setUpazila] = useState<number | null>(null);
  const [fullName, setFullName] = useState("");

  // Step 3 — OTP
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);

  const issue = nidTouched ? nidIssue(nid) : null;
  const phoneOk = phone.length === 0 || normalisePhoneBD(phone) !== null;
  const divisions = useMemo(
    () => [...new Set(DEMO_UPAZILAS.map((u) => u.division_en))].sort(),
    []
  );
  const districts = division === "" ? [] : districtsOf(division);
  const upazilas = district === "" ? [] : upazilasOf(district);

  const step1Ok = nidIssue(nid) === null && phoneOk && dob.length === 10 && !issue;
  const step2Ok = bloodGroup !== null && upazila !== null && fullName.trim().length > 0;

  const sendOtp = () => {
    setSent(true);
    setOtpError(null);
  };

  const verifyOtp = () => {
    if (otp === "123456") {
      login(phone || "01711000000", fullName || "Registered Citizen");
      navigate("/donors", { replace: true });
    } else {
      setOtpError(
        lang === "bn"
          ? "কোডটি সঠিক নয়। আবার চেষ্টা করুন।"
          : "That code is not correct. Try again."
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24">
      <div className="mx-auto mt-10 max-w-xl">
        {/* Stepper */}
        <ol className="flex items-center gap-2 text-xs font-semibold" aria-label={t("auth.register")}>
          {([1, 2, 3] as const).map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full tnum ${
                  step === s
                    ? "bg-brand text-white"
                    : step > s
                      ? "bg-brand-soft text-brand-deep"
                      : "bg-elevated text-subtle"
                }`}
              >
                {s}
              </span>
              {i < 2 && <span className="h-px w-6 bg-line" aria-hidden="true" />}
            </li>
          ))}
        </ol>

        <h1 className="mt-6 text-3xl text-ink">
          {step === 1 ? t("auth.register") : step === 2 ? t("auth.dob") : t("auth.otp")}
        </h1>

        {/* STEP 1 — identity */}
        {step === 1 && (
          <div className="mt-6 space-y-5">
            <label className="block text-sm font-semibold text-ink">
              {t("auth.nid")}
              <input
                inputMode="numeric"
                value={nid}
                onChange={(e) => {
                  setNid(e.target.value);
                  setNidTouched(true);
                }}
                placeholder="…"
                className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
              />
              <span className="mt-1 block text-xs text-blood-deep" role="alert">
                {issue?.en}{" "}
                <span lang="bn" className="text-muted">
                  {issue?.bn}
                </span>
              </span>
              {/* Last four shown for recognition */}
              {!issue && nid.length >= 10 && (
                <span className="mt-1 block text-xs text-success">
                  ✓ {t("auth.dob")} …{nid.slice(-4)}
                </span>
              )}
            </label>

            <label className="block text-sm font-semibold text-ink">
              {t("auth.phone")}
              <input
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
              />
              {!phoneOk && (
                <span className="mt-1 block text-xs text-blood-deep" role="alert">
                  {lang === "bn" ? "একটি বৈধ মোবাইল নম্বর দিন।" : "Enter a valid mobile number."}
                </span>
              )}
            </label>

            <label className="block text-sm font-semibold text-ink">
              {t("auth.dob")}
              <input
                type="date"
                value={dob}
                max="2008-12-31"
                onChange={(e) => setDob(e.target.value)}
                className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
              />
            </label>

            <button
              type="button"
              disabled={!step1Ok}
              onClick={() => setStep(2)}
              className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white disabled:opacity-40 hover:bg-brand-deep transition-colors cursor-pointer"
            >
              {t("common.next")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* STEP 2 — blood group + upazila */}
        {step === 2 && (
          <div className="mt-6 space-y-5">
            <p className="text-sm font-semibold text-ink">{t("auth.bloodGroup")}</p>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label={t("auth.bloodGroup")}>
              {BLOOD_GROUPS.map((g) => {
                const rare = isRareGroup(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setBloodGroup(g)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm font-bold tnum transition-colors cursor-pointer ${
                      bloodGroup === g
                        ? "border-brand bg-brand-soft text-brand-deep"
                        : "border-line bg-surface text-ink hover:border-line-strong"
                    }`}
                  >
                    {g}
                    {rare && <span className="text-[9px] font-semibold uppercase text-blood">{t("donors.respects")}…</span>}
                  </button>
                );
              })}
            </div>
            {bloodGroup && (
              <p className="text-xs text-muted">
                {lang === "bn"
                  ? "যাদের কাছ থেকে নিতে পারবেন: " + acceptsText(bloodGroup, "bn")
                  : "You can receive from: " + acceptsText(bloodGroup, "en")}
              </p>
            )}

            <label className="block text-sm font-semibold text-ink">
              {t("request.upazila")}
              <select
                value={division}
                onChange={(e) => {
                  setDivision(e.target.value);
                  setDistrict("");
                  setUpazila(null);
                }}
                className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
              >
                <option value="">{lang === "bn" ? "বিভাগ" : "Division"}</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            {division !== "" && (
              <label className="block text-sm font-semibold text-ink">
                {lang === "bn" ? "জেলা" : "District"}
                <select
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    setUpazila(null);
                  }}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
                >
                  <option value="">—</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {district !== "" && upazilas.length > 0 && (
              <label className="block text-sm font-semibold text-ink">
                {t("request.upazila")}
                <select
                  value={upazila ?? ""}
                  onChange={(e) => setUpazila(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
                >
                  <option value="">—</option>
                  {upazilas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {lang === "bn" ? u.name_bn : u.name_en}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block text-sm font-semibold text-ink">
              {t("settings.profile")}
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={lang === "bn" ? "আপনার নাম" : "Your name"}
                className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
              />
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:border-line-strong transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("common.back")}
              </button>
              <button
                type="button"
                disabled={!step2Ok}
                onClick={() => setStep(3)}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white disabled:opacity-40 hover:bg-brand-deep transition-colors cursor-pointer"
              >
                {t("auth.sendOtp")}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — OTP */}
        {step === 3 && (
          <div className="mt-6 space-y-5">
            <p className="flex items-center gap-2 text-sm text-muted">
              <Smartphone className="h-4 w-4" aria-hidden="true" />
              {lang === "bn"
                ? `কোড পাঠানো হয়েছে ${phone} নম্বরে।`
                : `We sent a code to ${phone}.`}
            </p>
            <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" />
            <label className="block text-sm font-semibold text-ink">
              {t("auth.otp")}
              <input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-center text-2xl tracking-[0.6em] tnum outline-none focus:border-brand"
              />
            </label>
            {otpError && (
              <p className="text-xs text-blood-deep" role="alert">
                {otpError}
              </p>
            )}
            {!sent ? (
              <button
                type="button"
                onClick={sendOtp}
                disabled={!step2Ok}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white disabled:opacity-40 hover:bg-brand-deep transition-colors cursor-pointer"
              >
                {t("auth.sendOtp")}
              </button>
            ) : (
              <button
                type="button"
                onClick={verifyOtp}
                disabled={otp.length !== 6}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white disabled:opacity-40 hover:bg-brand-deep transition-colors cursor-pointer"
              >
                {t("auth.verify")}
              </button>
            )}
          </div>
        )}

        <p className="mt-8 text-sm text-muted">
          {lang === "bn" ? "ইতিমধ্যে অ্যাকাউন্ট আছে? " : "Already have an account? "}
          <Link to="/login" className="font-semibold text-brand-deep">
            {t("auth.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
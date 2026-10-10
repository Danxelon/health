/**
 * Contact — how to reach the team, and where to send something that is NOT a
 * formal complaint.
 *
 * The page has one job before anything else: put 999 in front of a person who
 * may have landed here mid-emergency. The helpline slab comes first and reads
 * at arm's length; the form underneath is deliberately calm and quiet. A
 * complaint against a specific donor, doctor or service belongs on /complain,
 * where it gets a ticket number and a deadline — so this page points there
 * rather than pretending a general message is the same thing.
 *
 * <design_plan>
 * 1. RNG (seed = "Contact page" char count 12 % 101 = 12):
 *    random.choice("Hero")     -> "calm left-aligned utility header" (no stamp, no pill)
 *    random.choice("GSAP")     -> "stagger reveal on scroll", "hover physics on media"
 *    random.choice("Surfaces") -> "blood-soft helpline slab, then surface cards on bg"
 * 2. AIDA: Attention = the 999 slab (the one thing that must be read first);
 *    Interest = the message form; Desire = office address + hours cards;
 *    Action = the formal-complaint band before the footer, plus the tel: link.
 * 3. H1 math: `max-w-6xl` + text-[clamp(2.25rem,5.5vw,4rem)] holds on one line
 *    at every width; `.display` supplies the tight tracking. No stats in header.
 * 4. Bento density: lg:grid-cols-3 grid-flow-dense. Form spans 2 cols x 2 rows
 *    (4 cells) + Office (1x1) + Hours (1x1) = 6/6 cells, zero empty. On md it
 *    becomes a 2x2: form row 1 (2 cells), office + hours row 2 (2 cells).
 * 5. Label sweep: no meta-labels, no emoji; blood red appears only on the 999
 *    slab and inline validation; every control carries visible text; white on
 *    brand and blood-deep on blood-soft both clear AA at body size.
 * </design_plan>
 */

import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, CheckCircle2, Clock, Mail, MapPin, Phone, Send } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { SectionHeader } from "@/components/ui.tsx";
import { isValidPhoneBD } from "@/domain/profile.ts";
import { DEMO_MODE } from "@/lib/supabase.ts";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Page copy. New surfaces keep their words here rather than inventing `t()`
 * paths; the few keys that already exist in `STRINGS` are pulled through `t()`.
 */
const COPY = {
  title: { bn: "যোগাযোগ", en: "Contact" },
  lead: {
    bn: "প্রশ্ন, মতামত বা যেকোনো সমস্যার কথা জানান। তবে জরুরি অবস্থায় অপেক্ষা করবেন না — আগে কল করুন।",
    en: "Reach us with a question, feedback, or a problem. But in an emergency, do not wait for a reply — call first.",
  },
  helplineLabel: { bn: "২৪ ঘণ্টার জাতীয় হেল্পলাইন", en: "National helpline, 24 hours" },
  helplineTitle: { bn: "প্রাণের ঝুঁকি থাকলে ৯৯৯", en: "If a life is at risk, call 999" },
  helplineNote: {
    bn: "অ্যাম্বুলেন্স, পুলিশ বা আগুন — যেকোনো প্রাণঘাতী জরুরি অবস্থায় ৯৯৯ এক নম্বর। এই ফর্মটি অপেক্ষা করবে, জীবন নয়।",
    en: "Ambulance, police or fire — for any life-threatening emergency, 999 is the number. This form can wait; a life cannot.",
  },
  callNow: { bn: "এখনই কল করুন", en: "Call now" },
  formTitle: { bn: "আমাদের বার্তা পাঠান", en: "Send us a message" },
  formBody: {
    bn: "সাধারণ প্রশ্ন ও মতামতের জন্য। আনুষ্ঠানিক অভিযোগের জন্য অভিযোগের পাতা ব্যবহার করুন।",
    en: "For general questions and feedback. For a formal complaint, use the complaints page.",
  },
  name: { bn: "আপনার নাম", en: "Your name" },
  namePh: { bn: "যেমন: রফিকুল ইসলাম", en: "e.g. Rafiqul Islam" },
  contact: { bn: "ইমেইল বা মোবাইল", en: "Email or mobile" },
  contactPh: { bn: "you@example.com অথবা 01XXXXXXXXX", en: "you@example.com or 01XXXXXXXXX" },
  message: { bn: "আপনার বার্তা", en: "Your message" },
  messagePh: {
    bn: "সংক্ষেপে লিখুন — কী জানতে চান, বা কী সমস্যা হয়েছে।",
    en: "Briefly — what you want to know, or what went wrong.",
  },
  required: { bn: "এই ঘরটি পূরণ করুন।", en: "This field is required." },
  nameShort: { bn: "অন্তত ২ অক্ষরের নাম লিখুন।", en: "Enter at least 2 characters." },
  contactBad: {
    bn: "একটি বৈধ ইমেইল বা মোবাইল নম্বর দিন।",
    en: "Enter a valid email address or mobile number.",
  },
  messageShort: { bn: "অন্তত ১০ অক্ষরে আপনার বার্তা লিখুন।", en: "Write at least 10 characters." },
  errorSummary: {
    bn: "পাঠানোর আগে চিহ্নিত ঘরগুলো ঠিক করুন।",
    en: "Please fix the highlighted fields before sending.",
  },
  sending: { bn: "পাঠানো হচ্ছে…", en: "Sending…" },
  successTitle: { bn: "বার্তা পৌঁছেছে", en: "Message received" },
  successBody: {
    bn: "আমরা সাধারণত ২ কর্মদিবসের মধ্যে উত্তর দিই। আপনার রেফারেন্স নম্বরটি রেখে দিন।",
    en: "We usually reply within 2 working days. Keep your reference number.",
  },
  successDemo: {
    bn: "এটি ডেমো পরিবেশ — সত্যই কোনো বার্তা পাঠানো হয়নি, নম্বরটি নমুনা মাত্র।",
    en: "This is the demo build — nothing was actually sent; the number is a sample.",
  },
  another: { bn: "আরেকটি বার্তা পাঠান", en: "Send another message" },
  officeTitle: { bn: "দপ্তর", en: "Office" },
  officeAddress: {
    bn: "স্তর ৬, বাড়ি ১২, রোড ৭\nধানমন্ডি, ঢাকা ১২০৫",
    en: "Level 6, House 12, Road 7\nDhanmondi, Dhaka 1205",
  },
  officeNote: { bn: "সাক্ষাতের আগে সময় নিয়ে আসুন।", en: "Please book before visiting." },
  emailLabel: { bn: "ইমেইল", en: "Email" },
  emailValue: { bn: "hello@jibonrokkha.org", en: "hello@jibonrokkha.org" },
  hoursTitle: { bn: "সময়সূচি", en: "Hours" },
  hoursWeek: { bn: "রবি – বৃহস্পতি", en: "Sunday – Thursday" },
  hoursWeekValue: { bn: "সকাল ৯টা – সন্ধ্যা ৬টা", en: "9:00 am – 6:00 pm" },
  hoursFri: { bn: "শুক্রবার", en: "Friday" },
  hoursFriValue: { bn: "বন্ধ", en: "Closed" },
  hoursSat: { bn: "শনিবার", en: "Saturday" },
  hoursSatValue: { bn: "সকাল ১০টা – দুপুর ২টা", en: "10:00 am – 2:00 pm" },
  hoursNote: { bn: "হেল্পলাইন কিন্তু ২৪ ঘণ্টাই খোলা থাকে।", en: "The helpline stays open 24 hours." },
  formalTitle: { bn: "এটি আনুষ্ঠানিক অভিযোগ নয়", en: "This is not a formal complaint" },
  formalBody: {
    bn: "কোনো রক্তদাতা, ডাক্তার বা সেবার বিরুদ্ধে অভিযোগ করলে সেটি টিকিট নম্বর ও সময়সীমাসহ নথিভুক্ত হয়। সেজন্য অভিযোগের পাতা ব্যবহার করুন।",
    en: "A complaint against a donor, a doctor, or the service is logged with a ticket number and a deadline. Use the complaints page for that.",
  },
} as const;

type Errors = { name?: string; contact?: string; message?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A local reference for the acknowledgement. No backend is involved yet. */
function makeTicket(): string {
  const serial = Math.floor(1000 + Math.random() * 9000);
  return `JR-${new Date().getFullYear()}-${serial}`;
}

export default function Contact() {
  const { t, lang } = useAppShell();

  const rootRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);

  const c = (key: keyof typeof COPY): string => COPY[key][lang];

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = rootRef.current;
      if (!el) return;
      const targets = el.querySelectorAll("[data-reveal]");
      if (targets.length === 0) return;
      gsap.fromTo(
        targets,
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.09,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        }
      );
    },
    { scope: rootRef }
  );

  function validate(): Errors {
    const next: Errors = {};

    const trimmedName = name.trim();
    if (trimmedName.length === 0) next.name = c("required");
    else if (trimmedName.length < 2) next.name = c("nameShort");

    const trimmedContact = contact.trim();
    if (trimmedContact.length === 0) next.contact = c("required");
    else if (!EMAIL_RE.test(trimmedContact) && !isValidPhoneBD(trimmedContact)) {
      next.contact = c("contactBad");
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) next.message = c("required");
    else if (trimmedMessage.length < 10) next.message = c("messageShort");

    return next;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setAttempted(true);

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors(null);
    setSending(true);
    // Demo mode and the (not-yet-wired) live path share this local success
    // state. In a real build this is where the contact RPC would be called.
    window.setTimeout(() => {
      setTicket(makeTicket());
      setSending(false);
    }, 450);
  }

  function resetForm(): void {
    setName("");
    setContact("");
    setMessage("");
    setErrors(null);
    setAttempted(false);
    setTicket(null);
  }

  const invalid = errors;
  const showSummary = attempted && invalid !== null;

  const hours: ReadonlyArray<{ label: string; value: string; closed?: boolean }> = [
    { label: c("hoursWeek"), value: c("hoursWeekValue") },
    { label: c("hoursFri"), value: c("hoursFriValue"), closed: true },
    { label: c("hoursSat"), value: c("hoursSatValue") },
  ];

  const fieldBase =
    "mt-2 w-full rounded-xl border bg-surface px-4 py-3 text-ink outline-none transition-colors focus:border-brand";
  const fieldTone = (bad: boolean): string => (bad ? "border-blood" : "border-line");

  return (
    <div ref={rootRef} className="overflow-x-hidden w-full max-w-full">
      {/* Header — the calm opening. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-14 sm:pt-20" aria-labelledby="contact-h1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-brand">
          {t("app.gov")}
        </p>
        <h1
          id="contact-h1"
          data-reveal
          className="display mt-4 max-w-6xl text-[clamp(2.25rem,5.5vw,4rem)] text-ink"
        >
          {c("title")}
        </h1>
        <p data-reveal className="mt-5 max-w-2xl text-base sm:text-lg text-muted">
          {c("lead")}
        </p>
      </section>

      {/* Attention — the helpline, read first, at arm's length. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-12 sm:mt-16" aria-labelledby="helpline-h2">
        <div
          data-reveal
          className="rounded-3xl border border-blood-soft bg-blood-soft px-6 py-8 sm:px-10 sm:py-10"
        >
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-blood-deep">
                <Phone className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {c("helplineLabel")}
              </p>
              <h2 id="helpline-h2" className="mt-3 text-2xl sm:text-3xl text-blood-deep">
                {c("helplineTitle")}
              </h2>
              <p className="mt-3 text-sm text-blood-deep">{c("helplineNote")}</p>
              <p className="mt-4 flex items-start gap-1.5 text-xs text-blood-deep">
                <span aria-hidden="true">·</span>
                {t("footer.notice")}
              </p>
            </div>

            <a
              href="tel:999"
              className="group inline-flex flex-col items-center justify-center gap-1 rounded-3xl border border-blood/30 bg-blood-soft px-8 py-6 hover:bg-blood-soft/70 transition-colors cursor-pointer"
            >
              <Phone className="h-5 w-5 text-blood-deep" strokeWidth={1.8} aria-hidden="true" />
              <span className="tnum display text-[clamp(3rem,11vw,5rem)] leading-none text-blood-deep">
                999
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blood-deep">
                {c("callNow")}
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Interest + Desire — the gapless bento: form, office, hours. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24">
        <SectionHeader eyebrow={c("title")} title={c("formTitle")} body={c("formBody")} />

        <div className="mt-8 grid grid-flow-dense gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Form — spans 2 cols x 2 rows on lg. */}
          <div
            data-reveal
            className="md:col-span-2 lg:col-span-2 lg:row-span-2 rounded-3xl border border-line bg-surface p-6 sm:p-8"
          >
            {ticket === null ? (
              <form onSubmit={onSubmit} noValidate className="flex h-full flex-col gap-5">
                {showSummary && (
                  <div
                    id="contact-error-summary"
                    role="alert"
                    className="rounded-2xl border border-blood-soft bg-blood-soft/60 px-4 py-3 text-sm text-blood-deep"
                  >
                    {c("errorSummary")}
                  </div>
                )}

                <div>
                  <label htmlFor="contact-name" className="block text-sm font-semibold text-ink">
                    {c("name")}
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={c("namePh")}
                    aria-invalid={invalid?.name ? true : undefined}
                    aria-describedby={invalid?.name ? "contact-name-error" : undefined}
                    className={`${fieldBase} ${fieldTone(Boolean(invalid?.name))}`}
                  />
                  {invalid?.name && (
                    <span id="contact-name-error" className="mt-1.5 block text-xs text-blood-deep">
                      {invalid.name}
                    </span>
                  )}
                </div>

                <div>
                  <label htmlFor="contact-detail" className="block text-sm font-semibold text-ink">
                    {c("contact")}
                  </label>
                  <input
                    id="contact-detail"
                    name="contact"
                    type="text"
                    autoComplete="email"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={c("contactPh")}
                    aria-invalid={invalid?.contact ? true : undefined}
                    aria-describedby={invalid?.contact ? "contact-detail-error" : undefined}
                    className={`${fieldBase} ${fieldTone(Boolean(invalid?.contact))}`}
                  />
                  {invalid?.contact && (
                    <span id="contact-detail-error" className="mt-1.5 block text-xs text-blood-deep">
                      {invalid.contact}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col">
                  <label htmlFor="contact-message" className="block text-sm font-semibold text-ink">
                    {c("message")}
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={c("messagePh")}
                    aria-invalid={invalid?.message ? true : undefined}
                    aria-describedby={invalid?.message ? "contact-message-error" : undefined}
                    className={`${fieldBase} ${fieldTone(Boolean(invalid?.message))} flex-1 resize-y`}
                  />
                  {invalid?.message && (
                    <span id="contact-message-error" className="mt-1.5 block text-xs text-blood-deep">
                      {invalid.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white disabled:opacity-50 hover:bg-brand-deep transition-colors cursor-pointer sm:w-auto sm:self-start"
                >
                  <Send className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  {sending ? c("sending") : t("complain.submit")}
                </button>
              </form>
            ) : (
              <div role="status" aria-live="polite" className="flex h-full flex-col justify-center gap-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
                  <CheckCircle2 className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h3 className="text-xl sm:text-2xl text-ink">{c("successTitle")}</h3>
                <p className="max-w-md text-sm text-muted">{c("successBody")}</p>

                <div className="inline-flex w-fit flex-col gap-1 rounded-2xl border border-line bg-elevated px-5 py-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                    {t("complain.ticket")}
                  </span>
                  <span className="tnum display text-2xl text-ink">{ticket}</span>
                </div>

                {DEMO_MODE && (
                  <p className="text-xs text-subtle">
                    {t("common.demoMode")} — {c("successDemo")}
                  </p>
                )}

                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:border-line-strong transition-colors cursor-pointer"
                >
                  {c("another")}
                </button>
              </div>
            )}
          </div>

          {/* Office — 1x1. */}
          <div
            data-reveal
            className="group overflow-hidden rounded-3xl border border-line bg-surface p-6"
          >
            <div className="relative h-28 overflow-hidden rounded-2xl bg-elevated">
              <img
                src="https://picsum.photos/seed/dhanmondi-office/1920/1080"
                alt=""
                loading="lazy"
                className="h-full w-full object-cover opacity-90 contrast-110 grayscale-[20%] transition-transform duration-700 ease-out group-hover:scale-105"
              />
            </div>
            <h3 className="mt-4 flex items-center gap-2 text-lg font-bold text-ink">
              <MapPin className="h-4.5 w-4.5 text-brand" strokeWidth={1.8} aria-hidden="true" />
              {c("officeTitle")}
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm text-muted">{c("officeAddress")}</p>
            <p className="mt-3 flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted" strokeWidth={1.8} aria-hidden="true" />
              <a
                href={`mailto:${c("emailValue")}`}
                className="font-semibold text-brand-deep hover:text-brand transition-colors"
              >
                {c("emailValue")}
              </a>
            </p>
            <p className="mt-3 text-xs text-subtle">{c("officeNote")}</p>
          </div>

          {/* Hours — 1x1. */}
          <div
            data-reveal
            className="rounded-3xl border border-line bg-surface p-6"
          >
            <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
              <Clock className="h-4.5 w-4.5 text-brand" strokeWidth={1.8} aria-hidden="true" />
              {c("hoursTitle")}
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              {hours.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">{row.label}</dt>
                  <dd className={`tnum font-semibold ${row.closed ? "text-subtle" : "text-ink"}`}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 border-t border-line pt-4 text-xs text-subtle">{c("hoursNote")}</p>
          </div>
        </div>
      </section>

      {/* Action — the honest split: this form is not a complaint. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-20 sm:mt-28" aria-labelledby="formal-h2">
        <div
          data-reveal
          className="grain relative overflow-hidden rounded-[2rem] bg-ink-brand px-6 py-12 sm:px-12 sm:py-16"
        >
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 id="formal-h2" className="text-2xl sm:text-3xl text-white">
                {c("formalTitle")}
              </h2>
              <p className="mt-3 text-sm text-white/80">{c("formalBody")}</p>
            </div>
            <Link
              to="/complain"
              className="inline-flex h-12 w-fit items-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-ink-brand hover:bg-white/90 transition-colors cursor-pointer"
            >
              {t("complain.title")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

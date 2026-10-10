/**
 * <design_plan>
 * 1. RNG (seed = "Helpline".length = 8; 8 % 101 = 8):
 *    random.choice(hero)      -> "emergency-first call panel, no hero photograph"
 *    random.choice(component) -> "12-column number bento, spans 12/12/12 -> 6+6/12 -> 4+4+4"
 *    random.choice(gsap)      -> "staggered hero rise, then one scroll-triggered rise per block"
 *    random.choice(type)      -> "Cabinet Grotesk display on the 999 figure, Satoshi for body"
 * 2. AIDA check: Attention = H1 + the giant 999 button; Interest = the three numbers
 *    and what each one is actually for; Desire = the honest 999-vs-Jibon-Rokkha
 *    triage lists and the nearby-hospitals route to donors; Action = the closing
 *    brand panel that hands a non-emergency user a next step.
 * 3. Container math: hero H1 is `max-w-6xl` with text-[clamp(2.25rem,6.5vw,4.5rem)].
 *    At 320px that is ~2.25rem over a ~17rem column -> two lines
 *    ("জীবন বিপদে পড়লে —" / "আগে ফোন, পরে খোঁজ।"); at 1440px it is ~4.5rem, two lines.
 *    Never more than three lines at any width.
 * 4. Bento density: the number grid is `grid-cols-12 grid-flow-dense`. Spans are
 *    12/12/12 (mobile: 3 full rows), 6+6 then 12 (sm: 2 full rows), 4+4+4 (lg: 1 full
 *    row). Every breakpoint sums to exactly 12 per row -> zero empty cells.
 *    The triage pair is `lg:grid-cols-2` -> one full row, zero voids.
 * 5. Label sweep: no "SECTION 01", no emoji, no stamp icons on headings. Red appears
 *    only on 999, the 999 card, and the "call first" phrase — always beside a Phone
 *    icon and the digits themselves, never as colour-only meaning. Button text is
 *    white on bg-blood (4.97:1 light) at >=20px bold, and white on bg-brand-deep
 *    (7.44:1 light / 4.69:1 dark) for the filled brand CTAs.
 * </design_plan>
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Ambulance,
  ArrowRight,
  Building2,
  HeartPulse,
  Info,
  MapPin,
  PhoneCall,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { SectionHeader } from "@/components/ui.tsx";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

const COPY = {
  eyebrow: { bn: "জরুরি হেল্পলাইন", en: "Emergency helpline" },
  titleLead: { bn: "জীবন বিপদে পড়লে —", en: "When life is at risk," },
  titleAccent: { bn: "আগে ফোন, পরে খোঁজ।", en: "call first, search later." },
  body: {
    bn: "৯৯৯-এ পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্স পাওয়া যায়। ১৬২৬৩ সরকারি স্বাস্থ্য পরামর্শ দেয়, আর ৩৩৩ সরকারি সেবার তথ্য দেয়। কোন নম্বর কখন — নিচে লেখা আছে।",
    en: "999 reaches the police, the fire service and an ambulance. 16263 gives government medical advice, and 333 answers questions about government services. Which number to use, and when, is below.",
  },
  callNow: { bn: "এখনই কল করুন", en: "Call now" },
  call999Aria: { bn: "৯৯৯ নম্বরে এখনই কল করুন", en: "Call 999 now" },
  heroNote: {
    bn: "ফোন করার আগে নিশ্চিত হওয়ার দরকার নেই — সন্দেহ হলে কল করুন।",
    en: "You do not have to be sure before you dial. If something feels wrong, call.",
  },
  heroDisclaimer: {
    bn: "সাধারণ নির্দেশনা — চিকিৎসা পরামর্শ নয়।",
    en: "General guidance — not medical advice.",
  },

  numbersEyebrow: { bn: "তিনটি নম্বর", en: "Three numbers" },
  numbersTitle: { bn: "কোন নম্বর, কী জন্য", en: "Which number, and what for" },
  numbersBody: {
    bn: "যেকোনো ফোন থেকে ডায়াল করা যায় — অ্যাপ বা ইন্টারনেট লাগবে না।",
    en: "Any phone can dial these — no app and no internet needed.",
  },

  triageEyebrow: { bn: "সিদ্ধান্তের তালিকা", en: "How to decide" },
  triageTitle: {
    bn: "৯৯৯, নাকি জীবন রক্ষা — কোনটি কখন",
    en: "999 or Jibon Rokkha — which one, when",
  },
  triageBody: {
    bn: "জীবন রক্ষা একটি অনলাইন প্ল্যাটফর্ম, কোনো হটলাইন নয়। নিচের দুটি তালিকা মিলিয়ে দেখুন।",
    en: "Jibon Rokkha is an online platform, not a hotline. Check the two lists below before you choose.",
  },
  redTitle: { bn: "এখনই ৯৯৯-এ কল করুন", en: "Call 999 right now" },
  redLead: {
    bn: "নিচের যেকোনো একটি হলে অপেক্ষা করবেন না।",
    en: "If any one of these is happening, do not wait.",
  },
  platformTitle: { bn: "জীবন রক্ষা যেসব কাজে", en: "What Jibon Rokkha is for" },
  platformLead: {
    bn: "এগুলো জরুরি নয় — সময় নিয়ে করা যায়।",
    en: "None of these is an emergency — they can be done calmly.",
  },
  unsure: {
    bn: "নিশ্চিত না হলে ৯৯৯-এ কল করুন। এক মিনিটের কল ক্ষতি করে না — দেরি করে।",
    en: "If you are not sure, call 999. A minute on the phone costs nothing; waiting can cost a lot.",
  },

  hospitalsEyebrow: { bn: "রক্তের প্রস্তুতি", en: "Blood, arranged early" },
  hospitalsTitle: { bn: "কাছের হাসপাতাল", en: "Nearby hospitals" },
  hospitalsBody: {
    bn: "যে হাসপাতালে যাচ্ছেন, তার কাছের রক্তদাতা খুঁজতে উপজেলা দিয়ে অনুসন্ধান করুন। ফলাফলে শুধু দূরত্বের ব্যান্ড দেখা যায় — কারও ঠিকানা নয়।",
    en: "To find a donor near the hospital you are going to, search by upazila. Results show a distance band, never an address.",
  },
  hospitalsCard: {
    bn: "হাসপাতালের কাছে রক্তদাতা খুঁজুন",
    en: "Find donors near a hospital",
  },
  hospitalsAlt: { bn: "হাসপাতালের করিডর", en: "A hospital corridor" },

  actionTitle: {
    bn: "জরুরি নয়, কিন্তু প্রস্তুতি দরকার?",
    en: "Not an emergency, but still planning?",
  },
  actionBody: {
    bn: "আগামী কয়েক দিনের মধ্যে অপারেশন বা ডেলিভারি থাকলে এখনই রক্তদাতা ঠিক করে রাখা যায় — দরকারের দিনে খোঁজ করতে না হয়।",
    en: "If a surgery or a delivery is coming up in the next few days, you can line donors up now instead of searching on the day.",
  },
  disclaimer: {
    bn: "এই পাতাটি সাধারণ নির্দেশনা — চিকিৎসা পরামর্শ নয়। এটি ডাক্তার বা অ্যাম্বুলেন্সের বিকল্প নয়।",
    en: "This page is general guidance, not medical advice. It does not replace a doctor or an ambulance.",
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Numbers                                                                     */
/* -------------------------------------------------------------------------- */

type Tone = "blood" | "brand" | "ink";

interface NumberEntry {
  digits: string;
  tel: string;
  Icon: typeof PhoneCall;
  tone: Tone;
  label: { bn: string; en: string };
  use: { bn: string; en: string };
}

const NUMBERS: readonly NumberEntry[] = [
  {
    digits: "999",
    tel: "tel:999",
    Icon: Ambulance,
    tone: "blood",
    label: { bn: "জাতীয় জরুরি সেবা", en: "National emergency service" },
    use: {
      bn: "পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্স। যখন জীবন সরাসরি বিপদে।",
      en: "Police, fire service and ambulance. For when a life is in immediate danger.",
    },
  },
  {
    digits: "16263",
    tel: "tel:16263",
    Icon: Stethoscope,
    tone: "brand",
    label: { bn: "স্বাস্থ্য বাতায়ন", en: "Government health helpline" },
    use: {
      bn: "সরকারি স্বাস্থ্য হেল্পলাইন — ফোনে চিকিৎসা পরামর্শ, জরুরি নয় এমন সমস্যায়।",
      en: "Medical advice over the phone, for problems that are not an emergency.",
    },
  },
  {
    digits: "333",
    tel: "tel:333",
    Icon: Building2,
    tone: "ink",
    label: { bn: "সরকারি সেবার তথ্য", en: "Government services" },
    use: {
      bn: "কোন সরকারি সেবা কোথায় পাওয়া যাবে — তার তথ্যের জন্য।",
      en: "Information about which government service is available where.",
    },
  },
];

const TONES: Record<
  Tone,
  { wrap: string; icon: string; digits: string; cta: string }
> = {
  blood: {
    wrap: "border-blood-soft bg-blood-soft/40 hover:border-blood/40",
    icon: "text-blood",
    digits: "text-blood-deep",
    cta: "text-blood-deep",
  },
  brand: {
    wrap: "border-line bg-surface hover:border-brand/40",
    icon: "text-brand",
    digits: "text-ink",
    cta: "text-brand-deep",
  },
  ink: {
    wrap: "border-line bg-surface hover:border-ink-brand/40",
    icon: "text-ink-brand",
    digits: "text-ink",
    cta: "text-ink-brand",
  },
};

function NumberCard({ entry, className }: { entry: NumberEntry; className: string }) {
  const { t, lang } = useAppShell();
  const tone = TONES[entry.tone];
  const { Icon } = entry;

  return (
    <a
      href={entry.tel}
      className={`group relative flex flex-col gap-3 overflow-hidden rounded-3xl border p-5 sm:p-6 transition-colors duration-300 cursor-pointer ${tone.wrap} ${className}`}
    >
      <span className="flex items-start justify-between gap-3">
        <Icon className={`h-7 w-7 ${tone.icon}`} strokeWidth={1.8} aria-hidden="true" />
        <ArrowRight
          className="mt-1 h-5 w-5 shrink-0 text-muted transition-transform duration-300 group-hover:translate-x-1"
          aria-hidden="true"
        />
      </span>

      <span className={`display tnum block text-4xl sm:text-5xl ${tone.digits}`}>
        {entry.digits}
      </span>

      <span className="block text-base font-bold text-ink">{entry.label[lang]}</span>
      <span className="block text-sm text-muted">{entry.use[lang]}</span>

      <span className={`mt-auto pt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${tone.cta}`}>
        {t("request.call")}
        <span className="tnum">{entry.digits}</span>
      </span>
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Triage lists                                                                */
/* -------------------------------------------------------------------------- */

const RED_FLAGS: readonly { bn: string; en: string }[] = [
  {
    bn: "শ্বাস নিতে কষ্ট হচ্ছে, বা শ্বাস বন্ধ হয়ে আসছে",
    en: "Struggling to breathe, or breathing has stopped",
  },
  {
    bn: "বুকের ব্যথা, যা বাহু বা চোয়াল পর্যন্ত ছড়াচ্ছে",
    en: "Chest pain spreading to the arm or the jaw",
  },
  {
    bn: "হঠাৎ একদিকে দুর্বলতা, কথা জড়ানো, মুখ বেঁকে যাওয়া",
    en: "Sudden weakness on one side, slurred speech, a drooping face",
  },
  {
    bn: "থামছে না এমন রক্তক্ষরণ",
    en: "Bleeding that will not stop",
  },
  {
    bn: "গুরুতর সড়ক দুর্ঘটনা, পড়ে যাওয়া বা মাথায় আঘাত",
    en: "A serious road accident, a bad fall, or a head injury",
  },
  {
    bn: "অজ্ঞান হয়ে যাওয়া, খিঁচুনি, বা বিষপান",
    en: "Unconsciousness, a fit, or poisoning",
  },
  {
    bn: "আগুন, পানিতে ডুবে যাওয়া বা বিদ্যুৎস্পৃষ্ট",
    en: "Fire, drowning, or an electric shock",
  },
  {
    bn: "প্রসবের সময় জরুরি অবস্থা",
    en: "An emergency during childbirth",
  },
];

const PLATFORM_USES: readonly { bn: string; en: string }[] = [
  {
    bn: "কয়েক দিন পরে অপারেশন বা ডেলিভারির জন্য রক্তের ব্যবস্থা করা",
    en: "Arranging blood for a surgery or a delivery a few days away",
  },
  {
    bn: "হাসপাতালের কাছে মিলে যাওয়া রক্তদাতা খোঁজা",
    en: "Finding compatible donors near a hospital",
  },
  {
    bn: "নিজের রক্তের গ্রুপ ও উপজেলা দিয়ে রক্তদাতা হিসেবে নিবন্ধন করা",
    en: "Registering as a donor with your blood group and upazila",
  },
  {
    bn: "জরুরি নয় — এমন ডাক্তারি পরামর্শ নেওয়া",
    en: "Getting medical advice that is not an emergency",
  },
  {
    bn: "হাসপাতাল, ব্লাড ব্যাংক বা ডাক্তার নিয়ে অভিযোগ জানানো",
    en: "Filing a complaint about a hospital, a blood bank, or a doctor",
  },
];

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function Helpline() {
  const { t, lang } = useAppShell();
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = root.current;
      if (!el) return;

      gsap.fromTo(
        el.querySelectorAll("[data-hero]"),
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.09, delay: 0.1, ease: "power3.out" }
      );

      el.querySelectorAll<HTMLElement>("[data-rise]").forEach((node) => {
        gsap.fromTo(
          node,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            ease: "power2.out",
            scrollTrigger: { trigger: node, start: "top 90%" },
          }
        );
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} className="overflow-x-hidden w-full max-w-full">
      {/* Attention — the call comes before anything else on the page. */}
      <section className="relative overflow-hidden" aria-labelledby="helpline-h1">
        <div className="aurora absolute inset-0 -z-10" aria-hidden="true" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-14">
          <p
            data-hero
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blood-deep"
          >
            <TriangleAlert className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {COPY.eyebrow[lang]}
          </p>

          <h1
            id="helpline-h1"
            data-hero
            className="display mt-4 max-w-6xl text-[clamp(2.25rem,6.5vw,4.5rem)] text-ink"
          >
            {COPY.titleLead[lang]}{" "}
            <span className="text-blood">{COPY.titleAccent[lang]}</span>
          </h1>

          <p data-hero className="mt-5 max-w-2xl text-base sm:text-lg text-muted">
            {COPY.body[lang]}
          </p>

          <div
            data-hero
            className="mt-8 rounded-3xl border border-blood-soft bg-blood-soft/50 p-4 sm:p-5"
          >
            <a
              href="tel:999"
              aria-label={COPY.call999Aria[lang]}
              className="group inline-flex h-12 sm:h-16 w-full sm:w-auto items-center justify-center gap-3 rounded-full bg-blood px-5 sm:px-9 font-bold text-white shadow-[0_14px_34px_-14px_rgba(215,38,61,0.7)] transition-colors duration-300 hover:bg-blood-deep cursor-pointer"
            >
              <PhoneCall className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" strokeWidth={2.2} aria-hidden="true" />
              <span className="display tnum text-[clamp(1.5rem,6vw,2.25rem)] leading-none">999</span>
              <span className="text-lg sm:text-xl font-bold">{COPY.callNow[lang]}</span>
            </a>

            <p className="mt-3 flex items-start gap-2 text-sm text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span>{COPY.heroNote[lang]}</span>
            </p>
          </div>

          <p data-hero className="mt-3 text-xs text-muted">
            {COPY.heroDisclaimer[lang]}
          </p>
        </div>
      </section>

      {/* Interest — what each number is for. */}
      <section
        className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24"
        aria-labelledby="numbers-h2"
      >
        <SectionHeader
          eyebrow={COPY.numbersEyebrow[lang]}
          title={<span id="numbers-h2">{COPY.numbersTitle[lang]}</span>}
          body={COPY.numbersBody[lang]}
        />

        <div
          data-rise
          className="reveal-init mt-8 grid grid-cols-12 grid-flow-dense gap-3"
        >
          {NUMBERS.map((entry, index) => (
            <div
              key={entry.digits}
              className={
                index === 2
                  ? "col-span-12 sm:col-span-12 lg:col-span-4"
                  : "col-span-12 sm:col-span-6 lg:col-span-4"
              }
            >
              <NumberCard
                entry={entry}
                className="h-full"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Desire — honest triage, then the route to donors near a hospital. */}
      <section
        className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24"
        aria-labelledby="triage-h2"
      >
        <SectionHeader
          eyebrow={COPY.triageEyebrow[lang]}
          title={<span id="triage-h2">{COPY.triageTitle[lang]}</span>}
          body={COPY.triageBody[lang]}
        />

        <div data-rise className="reveal-init mt-8 grid gap-3 lg:grid-cols-2 grid-flow-dense">
          <div className="rounded-3xl border border-blood-soft bg-blood-soft/40 p-5 sm:p-7">
            <h3 className="flex items-center gap-2 text-xl font-bold text-ink">
              <Ambulance className="h-5 w-5 text-blood" strokeWidth={1.8} aria-hidden="true" />
              {COPY.redTitle[lang]}
            </h3>
            <p className="mt-2 text-sm text-muted">{COPY.redLead[lang]}</p>
            <ul role="list" className="mt-5 space-y-3">
              {RED_FLAGS.map((flag) => (
                <li key={flag.en} className="flex items-start gap-3 text-[15px] text-ink">
                  <span
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blood"
                    aria-hidden="true"
                  />
                  <span>{flag[lang]}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-5 sm:p-7">
            <h3 className="flex items-center gap-2 text-xl font-bold text-ink">
              <HeartPulse className="h-5 w-5 text-brand" strokeWidth={1.8} aria-hidden="true" />
              {COPY.platformTitle[lang]}
            </h3>
            <p className="mt-2 text-sm text-muted">{COPY.platformLead[lang]}</p>
            <ul role="list" className="mt-5 space-y-3">
              {PLATFORM_USES.map((item) => (
                <li key={item.en} className="flex items-start gap-3 text-[15px] text-ink">
                  <span
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand"
                    aria-hidden="true"
                  />
                  <span>{item[lang]}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 flex items-start gap-2 rounded-2xl bg-elevated p-4 text-sm text-ink">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={1.8} aria-hidden="true" />
              <span>{COPY.unsure[lang]}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Desire -> Action — donors near the hospital you are going to. */}
      <section
        className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24"
        aria-labelledby="hospitals-h2"
      >
        <SectionHeader
          eyebrow={COPY.hospitalsEyebrow[lang]}
          title={<span id="hospitals-h2">{COPY.hospitalsTitle[lang]}</span>}
          body={COPY.hospitalsBody[lang]}
        />

        <Link
          to="/donors"
          data-rise
          className="reveal-init group mt-8 grid grid-flow-dense overflow-hidden rounded-3xl border border-line bg-surface sm:grid-cols-2"
        >
          <div className="relative h-56 overflow-hidden sm:h-auto">
            <img
              src="https://picsum.photos/seed/helpline-hospital/1920/1080"
              alt={COPY.hospitalsAlt[lang]}
              loading="lazy"
              className="h-full w-full object-cover opacity-90 contrast-110 grayscale-[20%] transition-transform duration-700 ease-out group-hover:scale-105"
            />
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8">
            <span className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
              <MapPin className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              {t("nav.donors")}
            </span>
            <span className="mt-3 block text-xl font-bold text-ink sm:text-2xl">
              {COPY.hospitalsCard[lang]}
            </span>
            <span className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 self-start rounded-full bg-brand-deep px-7 text-[15px] font-semibold text-white transition-transform duration-300 group-hover:-translate-y-0.5 sm:w-auto">
              {t("nav.donors")}
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </span>
          </div>
        </Link>
      </section>

      {/* Action — the non-emergency next step, so the page does not dead-end. */}
      <section
        className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 sm:mt-24"
        aria-labelledby="action-h2"
      >
        <div
          data-rise
          className="reveal-init grain relative overflow-hidden rounded-[2rem] bg-brand-deep px-6 py-14 sm:px-12 sm:py-20"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(40rem 28rem at 88% -12%, rgba(255,255,255,0.14), transparent 60%), radial-gradient(34rem 26rem at 4% 112%, rgba(215,38,61,0.28), transparent 62%)",
            }}
            aria-hidden="true"
          />
          <div className="relative max-w-2xl">
            <h2 id="action-h2" className="display text-[clamp(1.75rem,4.2vw,3rem)] text-white">
              {COPY.actionTitle[lang]}
            </h2>
            <p className="mt-4 text-[15px] text-white/85 sm:text-base">{COPY.actionBody[lang]}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/donors"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-brand-deep transition-transform duration-300 hover:-translate-y-0.5 cursor-pointer"
              >
                {t("nav.donors")}
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </Link>
              <Link
                to="/requests/new"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/40 px-7 text-[15px] font-semibold text-white transition-colors duration-300 hover:bg-white/10 cursor-pointer"
              >
                {t("nav.request")}
              </Link>
            </div>

            <p className="mt-6 flex items-start gap-2 text-sm text-white/85">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span>{t("footer.notice")}</span>
            </p>
          </div>
        </div>

        <p className="mt-6 flex items-start gap-2 text-sm text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>{COPY.disclaimer[lang]}</span>
        </p>
      </section>
    </div>
  );
}

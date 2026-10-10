/**
 * Legal — terms, privacy, retention, and how contact is stored and used.
 *
 * This is a trust instrument, so it reads differently from the campaign
 * pages: calm, quiet, scannable prose in a narrow measure rather than bento
 * cards and marquees. Blood red appears exactly once, on the one honest
 * caution the whole page exists to deliver. Every paragraph is bilingual by
 * re-render: `COPY[key][lang]` swaps the current language on toggle.
 *
 * <design_plan>
 * 1. RNG (seed = file-name char count 6 % 101): draws "prose-first" over
 *    "bento" — legal copy earns the plain single column, no mock-random
 *    gimmicks that would read as marketing on a terms page.
 * 2. AIDA: the h1 + lead are Attention, the anchor strip is Interest (a
 *    reader can pull the section they came for), the body sections build
 *    Desire-for-clarity, and the contact line is the Action block.
 * 3. Container math: h1 `max-w-6xl` with `clamp(2rem, 5vw, 3rem)` so the
 *    title never spans more than two lines; the body column is `max-w-3xl`
 *    so a 45–52-character Bengali line stays comfortable at the CSS
 *    line-height (1.75 for the bn script, 1.6 for Latin).
 * 4. Density: deliberately a single column — a terms page is not a bento,
 *    and top-style anchors give the page shape without stepper fakery.
 * 5. Motion and labels: headings reveal with GSAP only when the visitor
 *    has not chosen reduced motion; no "SECTION 01" labels, no emoji; the
 *    one blood-red phrase is followed by its plain-word reason.
 * </design_plan>
 */

import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { HeartPulse, ShieldCheck, Timer, TriangleAlert } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* -------------------------------------------------------------------------- */
/* Local copy — every string on this page (bn written in real Bengali script). */
/* -------------------------------------------------------------------------- */

type Line = { bn: string; en: string };

const COPY = {
  title: { bn: "শর্তাবলি ও গোপনীয়তা", en: "Terms and privacy" },
  eyebrow: {
    bn: "জীবন রক্ষা · নিয়ম ও অধিকার",
    en: "Jibon Rokkha · rules and rights",
  },
  lead: {
    bn: "সরল ভাষায় লেখা — শর্ত, গোপনীয়তা, তথ্য কতদিন রাখা হয়, এবং যোগাযোগের তথ্য কীভাবে সংরক্ষিত ও ব্যবহৃত হয়। এখানে দুর্বোধ্য কোনো নিয়ম নেই, নেই কোনো ঢাকঢোল।",
    en: "Written in plain language — the terms, the privacy rules, how long data is kept, and how your contact details are stored and used. No fine print, no spin.",
  },
  effective: { bn: "কার্যকর: ১ অক্টোবর ২০২৫", en: "Effective: 1 October 2025" },
  lastUpdated: { bn: "সর্বশেষ হালনাগাদ: ৩ অক্টোবর ২০২৫", en: "Last updated: 3 October 2025" },

  sectionTerms: { bn: "শর্তাবলি", en: "Terms" },
  terms1: {
    bn: "জীবন রক্ষা একটি সেবামূলক প্ল্যাটফর্ম — ব্লাড ব্যাংক, হাসপাতাল বা চিকিৎসা প্রতিষ্ঠান নয়। এটি অভাবী ব্যক্তির সঙ্গে কাছের স্বেচ্ছাসেবক রক্তদাতার সংযোগ ঘটায়।",
    en: "Jibon Rokkha is a support platform — not a blood bank, a hospital, or a medical practice. It connects someone in need with nearby donors who volunteer to help.",
  },
  terms2: {
    bn: "প্ল্যাটফর্মে থাকা কোনো লেখাই চিকিৎসা পরামর্শ নয়। রোগ নির্ণয় বা চিকিৎসার সিদ্ধান্ত সবসময় নিন কোনো স্বীকৃত ডাক্তারের পরামর্শে।",
    en: "Nothing on this platform is medical advice. For any diagnosis or treatment decision, always follow the advice of a registered physician.",
  },
  terms3: {
    bn: "রক্ত দেওয়ার আগে যোগ্যতা যাচাই করা দাতা ও প্রাপক উভয়েরই দায়িত্ব। নিবন্ধনে দেওয়া তথ্য সঠিক রাখুন; জরুরি অবস্থায় সবার আগে জাতীয় হেল্পলাইনে ৯৯৯-এ কল করুন।",
    en: "Both the donor and the patient are responsible for checking donation eligibility for themselves. Keep the information you register accurate, and in an emergency call the national helpline 999 first.",
  },
  terms4: {
    bn: "ভুল তথ্য নিবন্ধন করলে অ্যাকাউন্ট সীমিত বা বাতিল হতে পারে। আইন যতটুকু অনুমতি দেয়, পরিষেবা ব্যবহারজনিত ক্ষতির জন্য প্ল্যাটফর্মের দায় সীমিত।",
    en: "Registering false information may lead to restricted or closed access. To the extent the law allows, the platform's liability for harm arising from its use is limited.",
  },

  sectionPrivacy: { bn: "গোপনীয়তা", en: "Privacy" },
  privacy1: {
    bn: "আপনার জাতীয় পরিচয়পত্র (এনআইডি), মোবাইল নম্বর ও যোগাযোগের ঠিকানা আমাদের ডেটাবেসে নিরাপদে সংরক্ষিত থাকে — সারি-স্তরের নিরাপত্তা (RLS) দিয়ে সুরক্ষিত — এবং রক্তদাতা-প্রাপক মিল ও যোগাযোগ সহজ করতে ব্যবহৃত হয়।",
    en: "Your national ID (NID), mobile number, and contact address are kept securely in our database — protected by row-level security — and are used to make donor–recipient matching and communication possible.",
  },
  privacy2: {
    bn: "আপনার উপজেলা ও ঠিকানার তথ্য সংরক্ষিত থাকে এবং কাছের রক্তদাতা বা ডাক্তারের মিল খুঁজতে ব্যবহৃত হয়। তালিকায় দূরত্ব দেখানো হয় ব্যান্ড আকারে, যেমন ১–৩ কিমি।",
    en: "Your upazila and address are stored and used to match you with the nearest donor or doctor. Distance is shown as a band, such as 1–3 km.",
  },
  privacy3: {
    bn: "শুধু প্রয়োজনীয় প্রশাসক টিম অ্যাকাউন্ট-সম্পর্কিত তথ্য দেখতে পারে। আমরা আপনার তথ্য বিক্রি করি না এবং কোনো বিজ্ঞাপন নেটওয়ার্কের সঙ্গে ভাগ করি না।",
    en: "Only the small admin team can see account-level details. We do not sell your data and we never share it with ad networks.",
  },

  sectionRetention: { bn: "তথ্য কতদিন রাখা হয়", en: "Data retention" },
  retention1: {
    bn: "রক্তের অনুরোধ, রক্তদানের রেকর্ড ও যাচাইয়ের ইতিহাস অপরিবর্তনীয় — মুছে ফেলা যায় না, বদলানোও যায় না। কারণ: রক্তদানের সময়সীমা এবং অভিযোগের বিচার লিপিবদ্ধ না থাকলে সম্ভব নয়।",
    en: "Blood requests, donation records, and verification history are append-only — never deleted, never edited. This is what powers the donation cooldown and the complaint trail.",
  },
  retention2: {
    bn: "পরামর্শের বার্তা ও অভিযোগের নথি সংবেদনশীল; এগুলো কেবল সংশ্লিষ্ট ব্যক্তি ও প্রশাসকের কাছে থাকে। পরিসংখ্যানের জন্য কিছু তথ্য নামহীন রাখা হয়।",
    en: "Consultation messages and complaint records are sensitive and stay with the people involved and the admin team. Some data is kept anonymized for statistics.",
  },
  retention3: {
    bn: "অ্যাকাউন্ট বাতিল করলে শনাক্তযোগ্য ব্যক্তিগত তথ্য মুছে যায়, কিন্তু রক্তদান ও অনুরোধের ইতিহাস নামহীন থেকে যায়। সব তথ্য মুছে ফেলা সম্ভব নয় — এটাই আমাদের সৎ প্রতিশ্রুতি।",
    en: "Deleting your account removes identifying personal details, but donation and request history remains, stripped of your name. Not everything can be deleted — that is the honest part of the promise.",
  },

  sectionNid: { bn: "এনআইডি কীভাবে সংরক্ষণ করা হয়", en: "How your NID is handled" },
  nid1: {
    bn: "নিবন্ধনের সময় আপনার এনআইডি আমাদের ডেটাবেসে সংরক্ষিত হয় এবং পরিচয় যাচাইয়ে ব্যবহৃত হয়। এটি জমা থাকে, যাতে নিবন্ধন ও রক্তদানের রেকর্ড নির্ভরযোগ্য করা যায়।",
    en: "At registration your NID is stored in our database and used to verify identity. It is kept so registration and donation records stay trustworthy.",
  },
  nid2: {
    bn: "আপনার এনআইডি কোনো প্রোফাইল, কার্ড বা অনুসন্ধানে প্রদর্শিত হয় না — এটি যাচাইয়ের কাজে রাখা হয় এবং প্রয়োজন অনুযায়ী নিরাপদ নিয়মে ব্যবহার করা হয়।",
    en: "Your NID is not displayed on any profile, card, or search result — it is kept for verification and used only as needed, under the platform's security rules.",
  },
  nid3: {
    bn: "এনআইডিসহ সব ব্যক্তিগত তথ্য ডেটাবেসে সারি-স্তরের নিরাপত্তা (RLS) দিয়ে সুরক্ষিত — প্রতিটি সারিতে আছে নিজস্ব প্রবেশ-নিয়ন্ত্রণ। এই তথ্য নিবন্ধন, যাচাই, মিল-খোঁজ ও যোগাযোগের কাজে লাগে।",
    en: "All personal data, including your NID, is protected in the database by row-level security — each row has its own access controls. This data is what makes registration, verification, matching, and communication work.",
  },
  nidLink: { bn: "এই নিয়ম নিয়ে আরও পড়ুন: নিবন্ধন", en: "More on this: creating an account" },

  sectionContact: { bn: "যোগাযোগ ও দৃশ্যমানতা", en: "Contact and visibility" },
  contactLead: {
    bn: "আপনার ফোন নম্বর ও যোগাযোগের তথ্য সিস্টেমে সংরক্ষিত থাকে — মিল হওয়ার পর রক্তদাতা-প্রাপকের যোগাযোগ যাতে সহজ হয়।",
    en: "Your phone number and contact details are stored in the system so that a donor and a recipient can reach each other easily once a match is made.",
  },
  contact1: {
    bn: "অনুসন্ধানের তালিকায় ফোন নম্বর দেখানো হয় না। মিল স্থির হলে নম্বরটি সেই কাজে জড়িত ব্যক্তিদের কাছে প্রকাশ পায়।",
    en: "Phone numbers are not shown in the search list. Once a match is made, the number opens for the people involved in that request.",
  },
  contact2: {
    bn: "কে কবে আপনার নম্বর দেখতে পাবে তা সেটিংসে ঠিক করা হয় — যেমন 'রাজি হলে', 'শুধু প্রশাসক'। সেটিং যে-কোনো সময় বদলানো যায়, আর প্রকাশের ইতিহাসও সেখানেই দেখা যায়।",
    en: "Who may see your number is decided in Settings — for example \"on my acceptance\" or \"admin only\". That rule can be changed at any time, and your contact history is there too.",
  },
  contact3: {
    bn: "যে অনুরোধ বা পরামর্শের জন্য নম্বর প্রকাশিত হয়, তা সেই কাজেই ব্যবহৃত হওয়া উচিত। নিজের অনুরোধে অন্য কারও নম্বর বসিয়ে দেবেন না; প্রকাশিত যোগাযোগ তার উদ্দেশ্যের জন্যই রাখুন।",
    en: "A number shared for a request or consultation should serve that purpose. Do not put another person's number into your own request — use shared contact only for what it was shared for.",
  },
  viewUnlocks: { bn: "আমার প্রকাশের ইতিহাস", en: "My unlock history" },

  sectionCookies: { bn: "কুকিজ ও লোকাল স্টোরেজ", en: "Cookies and local storage" },
  cookies1: {
    bn: "আপনার ডিভাইসে রাখা হয় মাত্র দুটি পছন্দ: কোন ভাষায় পড়বেন এবং কোন থিমে দেখবেন। এগুলো localStorage-এ থাকে, কোনো সার্ভারে যায় না।",
    en: "Two preferences live on your own device: the language you read in and the theme you see. They are kept in localStorage and never sent to a server.",
  },
  cookies2: {
    bn: "সাইন-ইনে একটি নিয়মিত নিরাপদ সেশন টোকেন ব্যবহৃত হয়। এর বাইরে কোনো ট্র্যাকিং কুকি, বিজ্ঞাপনের ট্যাগ বা তৃতীয় পক্ষের স্ক্রিপ্ট নেই।",
    en: "Signing in sets a regular secure session token. Beyond that there are no tracking cookies, no ad tags, and no third-party scripts.",
  },
  cookies3: {
    bn: "এই পছন্দ দুটি শুধু আপনার সুবিধার — সেগুলো মুছে দিলে কোনো কাজ বন্ধ হয় না, শুধু ভাষা ও থিম আগের অবস্থায় ফিরে যায়।",
    en: "These preferences are for your convenience only — clearing them breaks nothing, it just resets your language and theme.",
  },

  sectionChanges: { bn: "নিয়ম পরিবর্তন", en: "Changes to these terms" },
  changes1: {
    bn: "গুরুত্বপূর্ণ কোনো পরিবর্তন হলে — কী বদলেছে, কবে থেকে কার্যকর — তা অ্যাপের ভেতরেই আগে থেকে পরিষ্কার ভাষায় জানানো হবে। দুর্বোধ্য করে কোনো পরিবর্তন করা হবে না।",
    en: "When something important changes — what changed and when it takes effect — we will tell you in the app, in plain language, before it applies. We never change these terms quietly.",
  },

  sectionContactUs: { bn: "যোগাযোগ", en: "Contact" },
  contactUs1: {
    bn: "গোপনীয়তা নিয়ে প্রশ্ন, তথ্য সংশোধন বা বাতিলের অনুরোধ জানাতে চিঠি লিখুন। আপনার সাড়া আমাদের কাছে জরুরি।",
    en: "For privacy questions, a correction, or a deletion request, write to us. Your matter matters to us.",
  },
  aboutUs: { bn: "আমাদের সম্পর্কে", en: "About us" },
  helpline: { bn: "জরুরি হেল্পলাইন: ৯৯৯", en: "Emergency helpline: 999" },
} as const satisfies Record<string, Line>;

type CopyKey = keyof typeof COPY;

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: Line;
  children: ReactNode;
}) {
  const { lang } = useAppShell();
  return (
    <section id={id} aria-labelledby={`${id}-h2`} className="scroll-mt-24">
      <h2 id={`${id}-h2`} data-legal-reveal className="text-2xl text-ink">
        {title[lang]}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Paragraph({ value }: { value: Line }) {
  const { lang } = useAppShell();
  // No explicit leading: the CSS body rule (1.6, 1.75 for Bengali) is the
  // line-height this page wants, and fighting it is how Bengali clips.
  return <p className="text-[15px] text-muted">{value[lang]}</p>;
}

/** A must-read line shown in the current language, with the other script held
 *  for screen readers so both languages remain on the element. */
function Emphasis({ value }: { value: Line }) {
  const { lang, isBn } = useAppShell();
  return (
    <p className="rounded-2xl border border-line bg-surface px-5 py-4 text-[15px] font-semibold text-ink">
      {value[lang]}
      {isBn && <span className="sr-only">{value.en}</span>}
    </p>
  );
}

const ANCHOR_ORDER: { key: CopyKey; id: string }[] = [
  { key: "sectionTerms", id: "terms" },
  { key: "sectionPrivacy", id: "privacy" },
  { key: "sectionRetention", id: "retention" },
  { key: "sectionNid", id: "nid" },
  { key: "sectionContact", id: "contact" },
  { key: "sectionCookies", id: "cookies" },
  { key: "sectionChanges", id: "changes" },
];

/* -------------------------------------------------------------------------- */
/* GSAP — headings and hero reveal. The reduced-motion bail-out means the       */
/* elements keep their natural (visible) state when the visitor prefers no      */
/* animation; GSAP supplies the from-state only while it is animating.          */
/* -------------------------------------------------------------------------- */

function useHeadingReveal() {
  const scope = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = scope.current;
      if (!el) return;
      const headings = el.querySelectorAll("[data-legal-reveal]");
      if (!headings.length) return;
      gsap.fromTo(
        headings,
        { y: 18, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: "top 82%" },
        }
      );
    },
    { scope }
  );
  return scope;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function Legal() {
  const { t, lang } = useAppShell();
  const heroRef = useRef<HTMLDivElement>(null);
  const scope = useHeadingReveal();

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = heroRef.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelector("[data-legal-hero]"),
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }
      );
    },
    { scope: heroRef }
  );

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-14 sm:pt-20">
        {/* Header — Attention */}
        <div ref={heroRef} data-legal-hero className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            {COPY.eyebrow[lang]}
          </p>
          <h1 className="mt-3 max-w-6xl text-[clamp(2rem,5vw,3rem)] text-ink">
            {COPY.title[lang]}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] text-muted">{COPY.lead[lang]}</p>
          <p className="mt-3 text-xs text-subtle">
            <time dateTime="2025-10-01">{COPY.effective[lang]}</time>
            <span aria-hidden="true"> · </span>
            <span>{COPY.lastUpdated[lang]}</span>
          </p>
        </div>

        {/* Anchor strip — Interest */}
        <nav aria-label={COPY.title[lang]} className="mx-auto mt-10 max-w-3xl flex flex-wrap gap-2">
          {ANCHOR_ORDER.map((a) => (
            <a
              key={a.id}
              href={`#${a.id}`}
              className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-muted hover:border-line-strong hover:text-ink transition-colors"
            >
              {COPY[a.key][lang]}
            </a>
          ))}
        </nav>
      </div>

      {/* Prose body — max-w-3xl column, generous line-height inherited from CSS */}
      <div ref={scope} className="mx-auto mt-14 max-w-7xl px-4 sm:px-6 pb-10">
        <div className="mx-auto max-w-3xl space-y-16">
          <LegalSection id="terms" title={COPY.sectionTerms}>
            <Paragraph value={COPY.terms1} />
            <Paragraph value={COPY.terms2} />
            <Emphasis value={COPY.terms3} />
            <Paragraph value={COPY.terms4} />
          </LegalSection>

          <LegalSection id="privacy" title={COPY.sectionPrivacy}>
            <Paragraph value={COPY.privacy1} />
            <Paragraph value={COPY.privacy2} />
            <Paragraph value={COPY.privacy3} />
          </LegalSection>

          <LegalSection id="retention" title={COPY.sectionRetention}>
            <Paragraph value={COPY.retention1} />
            <Paragraph value={COPY.retention2} />
            <Paragraph value={COPY.retention3} />
          </LegalSection>

          {/* NID handling — stored for verification under RLS, linked forward to the flow */}
          <LegalSection id="nid" title={COPY.sectionNid}>
            <Paragraph value={COPY.nid1} />
            <Paragraph value={COPY.nid2} />
            <Paragraph value={COPY.nid3} />
            <p>
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep hover:text-brand transition-colors"
              >
                <ShieldCheck className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                {COPY.nidLink[lang]}
              </Link>
            </p>
          </LegalSection>

          {/* Contact — stored so matched parties can connect; visibility set by the user in Settings */}
          <LegalSection id="contact" title={COPY.sectionContact}>
            <Emphasis value={COPY.contactLead} />
            <Paragraph value={COPY.contact1} />
            <Paragraph value={COPY.contact2} />
            <Paragraph value={COPY.contact3} />
            <p>
              <Link
                to="/settings"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep hover:text-brand transition-colors"
              >
                <Timer className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                {COPY.viewUnlocks[lang]}
              </Link>
            </p>
          </LegalSection>

          <LegalSection id="cookies" title={COPY.sectionCookies}>
            <Paragraph value={COPY.cookies1} />
            <Paragraph value={COPY.cookies2} />
            <Paragraph value={COPY.cookies3} />
          </LegalSection>

          <LegalSection id="changes" title={COPY.sectionChanges}>
            <Paragraph value={COPY.changes1} />
          </LegalSection>

          {/* Contact — Action */}
          <LegalSection id="contact-us" title={COPY.sectionContactUs}>
            <Paragraph value={COPY.contactUs1} />
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                to="/about"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:border-line-strong transition-colors"
              >
                {COPY.aboutUs[lang]}
              </Link>
              <Link
                to="/helpline"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-ink-brand px-5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                <HeartPulse className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                {COPY.helpline[lang]}
              </Link>
            </div>
          </LegalSection>
        </div>

        {/* The one blood-red caution, kept outside the prose rhythm on purpose. */}
        <div className="mx-auto mt-16 max-w-3xl">
          <p className="flex items-start gap-2.5 rounded-2xl border border-blood-soft bg-blood-soft/40 px-5 py-4 text-sm text-blood-deep">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span>{t("footer.notice")}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
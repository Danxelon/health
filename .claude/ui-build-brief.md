# Jibon Rokkha — page build brief (read this FIRST)

Project root: `H:\creativity\health`
Product: **Jibon Rokkha (জীবন রক্ষা)** — bilingual (Bengali default, English) blood-donation + telemedicine + health-articles platform for Bangladesh. `plan.md` is the spec, `concept.txt` is empty by design.

## Rules of engagement (parallel build)

- **Create exactly ONE file: the page path you are assigned.** Edit nothing else unless your task explicitly names a second file.
- **Do not edit** shared files: `src/lib/strings.ts`, `src/components/ui.tsx`, `src/state/app-shell.tsx`, `src/App.tsx`, `src/index.css`, `src/domain/*`, `src/api/*`, `src/lib/*`, `package.json`, `tsconfig.json`, `vite.config.ts`. Other agents are working in parallel.
- **No emoji. No meta-labels** ("SECTION 01", "QUESTION 05", "ABOUT US"). No comments or output containing emoji.
- TypeScript **strict**: no `any`, no unused imports/locals (`noUnusedLocals` fails the build), explicit null checks, `import type` for types. Import path alias `@/` → `src/`, and modules keep their real extension (`@/state/app-shell.tsx`).

## Stack

React 19 · Vite 8 · Tailwind CSS 4 (CSS-first `@theme` tokens in `src/index.css`) · react-router-dom 7 · lucide-react 1.53 · GSAP with `@gsap/react`.

Every page is a **lazy default export**: `export default function Name()` in its own file under `src/pages/`.

## Shell, language, copy

```tsx
import { useAppShell } from "@/state/app-shell.tsx";
const { t, lang, theme, setTheme, isBn } = useAppShell();
```

- `t("dot.path")` walks the `STRINGS` object in `src/lib/strings.ts`. **Read that file before writing copy.** A missing key renders as the literal key path on screen — so **never invent `t()` keys**.
- For new copy define a local `const COPY = { key: { bn: "…", en: "…" } }` and render `COPY.key[lang]`. Bengali must be real Bengali script, written not transliterated.
- When your page's keys already exist, use them: `common.*` (search, loading, retry, cancel, save, next, back, seeAll, filter, distance, km, andMore, demoMode, empty), `nav.*`, `errors.*` (generic, network, notFound, goHome), `home.*`, `donors.*`, `request.*`, `doctors.*`, `articles.*`, `settings.*`, `complain.*`, `auth.*`, `footer.*`.
- Counts rendered next to Bengali copy may use `toBengaliDigits(n)` / `formatCountBn(n)` from `@/domain/profile.ts`.

## Design tokens (Tailwind classes only — never raw hex)

| Role | Classes |
|---|---|
| Brand teal (primary voice) | `bg-brand` `text-brand` `border-brand` · deep: `bg-brand-deep` `text-brand-deep` · soft: `bg-brand-soft` |
| Maroon (institutional) | `bg-ink-brand` `text-ink-brand` `bg-ink-brand-soft` `text-ink-brand-soft` |
| Blood red — **reserved** for blood/urgency/destructive only | `bg-blood` `text-blood` `text-blood-deep` `border-blood` `bg-blood-soft` `border-blood-soft` |
| Surfaces | `bg-bg` `bg-surface` `bg-elevated` `border-line` `border-line-strong` |
| Text | `text-ink` (near-black) `text-muted` `text-subtle` |
| Semantic | `text-success bg-success-soft` · `text-warning bg-warning-soft` · `text-info bg-info-soft` |

Utility classes already defined: `.tnum` (tabular figures — use on every count, distance, fee, phone), `.display` (Cabinet Grotesk 800, −0.035em — large headings), `.grain`, `.aurora`, `.no-scrollbar`, `.reveal-init` (JS-off fallback so content is visible without GSAP).

Fonts: display **Cabinet Grotesk**, text **Satoshi**, Bengali **Noto Sans Bengali** (auto-applied via `[lang="bn"]`). **Never Inter.**

## UI primitives — `@/components/ui.tsx`

```tsx
<SectionHeader eyebrow? title body? action? />
<Badge tone? >children</Badge>   // tone: "brand" | "blood" | "success" | "warning" | "muted" | "ink-brand"
<DistanceChip km band />
<CardSkeleton className? />
<ErrorBanner message onRetry? />
```

## API layer (all async, all `DEMO_MODE`-aware)

| Module | Functions |
|---|---|
| `@/api/donors.ts` | `searchDonors(args)` → `SearchResults { donors: DonorCard[]; counts; groups; searchedAt }` |
| `@/api/emergencies.ts` | `fetchEmergencyFeed()` → `EmergencyFeedItem[]` |
| `@/api/doctors.ts` | `fetchDoctors(filters?)` → `DoctorCard[]`; filters `{ specialtySlug?, district_en?, availableTodayOnly?, freeOnly?, languages? }`; already sorted distance-then-rating |
| `@/api/articles.ts` | `fetchArticles({ tag? })` → `ArticleFeedItem[]`; `fetchArticle(slug)` → `{ item, bodyEn, bodyBn } \| null` |
| `@/api/requests.ts` | `createBloodRequest(input)` · `fetchRequestTracking(id)` → `{ request, counts{invited,accepted,declined,confirmed}, responders: RequestResponder[], next_step }` · `fetchMyRequests()` · `unlockDonorContact(requestId, donorId)` · `respondToRequest(id, "accepted"\|"declined")` · `confirmDonation(responseId, units)` · `cancelBloodRequest(id)` |
| `@/api/consultations.ts` | `requestConsultation({doctor_id, symptom_summary, scheduled_at})` · `fetchMyConsultations()` · `fetchConsultation(id)` → `{ consultation, messages, doctor } \| null` · `sendConsultationMessage(id, body)` · `respondConsultation(id, "accepted"\|"declined", scheduledAt?)` |
| `@/api/complaints.ts` | `fileComplaint({target_type, target_id, subject, description, severity: 1\|2\|3})` · `fetchMyComplaints()` · `COMPLAINT_SLA_HOURS = {1:24,2:72,3:168}` |

`import { DEMO_MODE } from "@/lib/supabase.ts"` — when true the backend is an in-memory dataset; the Layout already renders a global demo banner, so you only add a local note where honesty needs it.

Domain modules (pure, tested — **prefer them over hand-rolled logic**):
`@/domain/types.ts` (all interfaces/enums), `@/domain/blood.ts` (`acceptableDonorsFor`, `groupBadge`, `bloodGroupLabel`, `isRareGroup`), `@/domain/eligibility.ts` (`evaluateEligibility`, `eligibilitySummary`, `reasonMessage`, `AVAILABILITY_OPTIONS`, `COOLDOWN_DAYS`), `@/domain/requests.ts` (`URGENCY_META`, `STATUS_META`, `canTransition`, `evaluateFulfilment`, `escalationLadder`), `@/domain/matching.ts` (`ringLabel`, `distanceLabel`, `maxRingFor`), `@/domain/profile.ts` (`maskPhone`, `telHref`, `maskName`, `initialsOf`, `completeness`, `ageBand`, `toBengaliDigits`, `formatCountBn`).

Errors thrown by the API are `DomainError` from `@/domain/types.ts`, carrying `.code` and `.bilingual` → `{ en, bn }`. Render `err.bilingual[lang]`, never `String(err)`.

## Accessibility (non-negotiable — health app, stressed users, cheap Android phones)

- AA contrast on all text; buttons are `rounded-full h-11`/`h-12` (≥44px), primary `bg-brand text-white`, secondary `border border-line bg-surface text-ink`, always `cursor-pointer`.
- Loading → skeleton + `role="status" aria-live="polite"`. Errors → `role="alert"` in a `border border-blood-soft bg-blood-soft/60` panel with the bilingual message. Search results → `aria-live="polite"`.
- No colour-only meaning: red always pairs with an icon or a word.
- Icons: `lucide-react`, decorative ones get `aria-hidden="true"` and `strokeWidth={1.8}`.
- Legible at 320px with Bengali text; body line-height comes from CSS (1.6/1.75), don't fight it.

## gpt-taste rules (award-level UI — MANDATORY)

**1. Emit a `<design_plan>` HTML comment as the FIRST thing in your file**, before the code:

```
/**
 * <design_plan>
 * 1. RNG (seed = <your task name> char count % 101): 3 mock random.choice() lines
 *    picking hero/component/GSAP/font selections — obey them literally.
 * 2. AIDA check: which block serves Attention / Interest / Desire / Action.
 * 3. Container math: the max-w-* on any H1 + the clamp() that keeps it 2–3 lines.
 * 4. Bento density: grid columns × col/row spans summing to zero empty cells, grid-flow-dense on.
 * 5. Label sweep: no meta-labels, no emoji, button text contrast verified.
 * </design_plan>
 */
```

**2. Hero / H1 iron rule:** H1 must be `max-w-6xl`-wide with `text-[clamp(…)]` so it **never exceeds 2–3 lines**. No stamp/badge icons on headings, no pill-tags under heroes, no raw stats in heroes.

**3. Gapless bento:** every grid gets `grid-flow-dense`; spans must interlock with **zero empty cells** (prove it in the design_plan). 3–5 intentional cards beat 8 messy ones.

**4. Motion:** real GSAP via `import gsap from "gsap"; import { ScrollTrigger } from "gsap/ScrollTrigger"; import { useGSAP } from "@gsap/react"; gsap.registerPlugin(ScrollTrigger, useGSAP)`. Reveal targets start at `opacity:0` only when JS runs — put `.reveal-init` on them so the no-JS/reduced-motion fallback is visible. **Always bail out** with `if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;` inside `useGSAP`. Hover physics: `group-hover:scale-105 transition-transform duration-700 ease-out` inside `overflow-hidden`. Scrub-word-reveal or a pinned split where the section earns it.

**5. Layout:** page root `<div className="overflow-x-hidden w-full max-w-full">`. Huge vertical rhythm between sections (`mt-16 sm:mt-24` / `py-24 md:py-36`). Section headers via `SectionHeader`.

**6. Images:** `https://picsum.photos/seed/{keyword}/1920/1080`, treated with CSS filters so they don't read as stock — e.g. `opacity-90 contrast-110 grayscale-[20%]` plus `group-hover:scale-105 transition-transform duration-700`.

**7. Page shape:** real `<h1>` header block first (with a supporting `text-muted` line), `SectionHeader` for each subsection, and an **Action** block (high-contrast CTA) before the end.

## Acceptance for your file

- `npx tsc --noEmit` reports **no errors pointing at your file** (run it if you can; at minimum audit every import and prop).
- Every string renders in both Bengali and English. No `t()` key that isn't in `strings.ts`.
- No unused imports. No `any`. No emoji. No meta-labels.

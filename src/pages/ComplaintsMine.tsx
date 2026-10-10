/**
 * <design_plan>
 * 1. RNG (seed = "ComplaintsMine".length % 101 = 14):
 *    random.choice(["centre h1", "split h1"])        -> "centre h1" (the queue's
 *       one-line h1, `complain.mine` — no stamps, no hero pill tags)
 *    random.choice(["joined wall", "stacked cards"]) -> "joined wall" (GAPLESS
 *       hairline grid, zero empty cells for any ticket count)
 *    random.choice(["stagger rise", "no reveal"])    -> "stagger rise" (GSAP
 *       reveal, reduced-motion-safe); Font -> Cabinet Grotesk stack (never Inter)
 * 2. AIDA: Attention = h1 `complain.mine` + the surrounding `complain.subtitle`;
 *    Interest = the ticket queue, each card a status board; Desire = the SLA
 *    clock on each card (a deadline makes the waiting felt); Action = the
 *    `complain.submit` CTA in the head and again in the empty state.
 * 3. H1 math: max-w-6xl + text-[clamp(1.9rem,4.2vw,2.75rem)] -> always 1–2 lines
 *    even at 320px with Bengali script.
 * 4. Bento density: grid-cols-1 md:grid-cols-2 gap-px bg-line joined wall,
 *    grid-flow-dense; even counts pair into full rows and an odd tail gets
 *    md:col-span-2 on the last card — every row exactly full for any n (n=1: one
 *    full-width row; n=2: one pair; n=3: pair + full-width tail; …), zero voids.
 * 5. Label sweep: no meta-labels, no emoji; blood reserved for severity 1 and
 *    overdue clocks (never decorating a heading), warning for severity 2 and
 *    `open` status; button text white-on-brand at AA.
 * </design_plan>
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Inbox, Plus } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

import { useAppShell } from "@/state/app-shell.tsx";
import { fetchMyComplaints } from "@/api/complaints.ts";
import { Badge, CardSkeleton, ErrorBanner } from "@/components/ui.tsx";
import { DomainError, type Complaint } from "@/domain/types.ts";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Severity badge tones + labels. 1 is the most urgent (a 24 h SLA). */
const SEVERITY_META: Record<
  Complaint["severity"],
  { tone: "blood" | "warning" | "muted"; label: { bn: string; en: string } }
> = {
  1: { tone: "blood", label: { bn: "অতি জরুরি", en: "Critical" } },
  2: { tone: "warning", label: { bn: "মাঝারি", en: "Moderate" } },
  3: { tone: "muted", label: { bn: "সাধারণ", en: "Low" } },
};

/** Status badge tones + labels. `closed` is the post-review tail (dismissed). */
const STATUS_META: Record<
  Complaint["status"],
  { tone: "brand" | "success" | "warning" | "muted"; label: { bn: string; en: string } }
> = {
  open: { tone: "warning", label: { bn: "অমীমাংসিত", en: "Open" } },
  in_review: { tone: "brand", label: { bn: "পর্যালোচনাধীন", en: "In review" } },
  resolved: { tone: "success", label: { bn: "সমাধান হয়েছে", en: "Resolved" } },
  closed: { tone: "muted", label: { bn: "বন্ধ", en: "Closed" } },
};

/** Local copy — no `t()` key exists for a "last updated" line. */
const COPY = {
  updated: { bn: "সর্বশেষ হালনাগাদ", en: "Last updated" },
} as const;

/**
 * The SLA clock only applies to live complaints — an already-resolved or closed
 * ticket whose deadline has passed is history, not an overdue promise.
 */
function isOverdue(iso: string | null, status: Complaint["status"]): boolean {
  if (status !== "open" && status !== "in_review") return false;
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t <= Date.now();
}

function safeFormat(fmt: Intl.DateTimeFormat, iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : fmt.format(d);
}

function ComplaintCard({
  complaint,
  shortDate,
  dateTime,
  fillRow,
}: {
  complaint: Complaint;
  shortDate: Intl.DateTimeFormat;
  dateTime: Intl.DateTimeFormat;
  fillRow: boolean;
}) {
  const { t, lang } = useAppShell();
  const severity = SEVERITY_META[complaint.severity];
  const status = STATUS_META[complaint.status];
  const overdue = isOverdue(complaint.sla_due_at, complaint.status);

  return (
    <article
      data-complaint-card
      className={`reveal-init flex flex-col gap-4 bg-surface p-5 sm:p-6 ${
        fillRow ? "md:col-span-2" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
            {t("complain.ticket")}
          </p>
          <p className="tnum mt-0.5 text-lg font-bold text-ink">{complaint.ticket_no}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={severity.tone}>{severity.label[lang]}</Badge>
          <Badge tone={status.tone}>{status.label[lang]}</Badge>
        </div>
      </div>

      <h3 className="text-[15px] font-bold text-ink leading-snug">{complaint.subject}</h3>
      <p className="line-clamp-2 text-sm text-muted">{complaint.description}</p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p
          className={`flex items-center gap-1.5 text-xs font-medium ${
            overdue ? "text-blood" : "text-muted"
          }`}
        >
          {overdue && <Clock className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />}
          <span>{t("complain.slaDue")}</span>
          <span className="tnum">{safeFormat(shortDate, complaint.sla_due_at)}</span>
        </p>
        <p className="text-[11px] text-subtle">
          {COPY.updated[lang]} <span className="tnum">{safeFormat(dateTime, complaint.updated_at)}</span>
        </p>
      </div>
    </article>
  );
}

export default function ComplaintsMine() {
  const { t, lang } = useAppShell();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wallRef = useRef<HTMLDivElement>(null);

  const shortDate = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [lang]
  );

  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [lang]
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMyComplaints()
      .then((list) =>
        setComplaints([...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)))
      )
      .catch((err: unknown) => {
        if (err instanceof DomainError) setError(err.bilingual[lang]);
        else setError(err instanceof Error ? err.message : t("errors.generic"));
      })
      .finally(() => setLoading(false));
  }, [lang, t]);

  useEffect(() => {
    load();
  }, [load]);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const cards = wallRef.current?.querySelectorAll("[data-complaint-card]");
      if (!cards?.length) return;
      gsap.fromTo(
        cards,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.07,
          ease: "power2.out",
          scrollTrigger: { trigger: wallRef.current, start: "top 92%" },
        }
      );
    },
    { scope: wallRef, dependencies: [loading] }
  );

  return (
    <div className="overflow-x-hidden w-full max-w-full">
      <header className="mx-auto mt-10 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              {t("complain.title")}
            </p>
            <h1 className="display mt-3 max-w-6xl text-[clamp(1.9rem,4.2vw,2.75rem)] text-ink">
              {t("complain.mine")}
            </h1>
            <p className="mt-3 text-[15px] text-muted">{t("complain.subtitle")}</p>
          </div>
          <Link
            to="/complain"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {t("complain.submit")}
          </Link>
        </div>
      </header>

      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 pb-24">
        {loading && (
          <div className="grid gap-3 md:grid-cols-2" role="status" aria-live="polite">
            {[...Array(2)].map((_, i) => (
              <CardSkeleton key={i} className="h-44" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-2">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}

        {!loading && !error && complaints.length === 0 && (
          <div className="rounded-3xl border border-line bg-surface px-6 py-14 text-center">
            <Inbox className="mx-auto h-8 w-8 text-subtle" strokeWidth={1.5} aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold text-ink">{t("complain.mine")}</h2>
            <p className="mt-1 text-sm text-muted">{t("common.empty")}</p>
            <Link
              to="/complain"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {t("complain.submit")}
            </Link>
          </div>
        )}

        {!loading && !error && complaints.length > 0 && (
          <div
            ref={wallRef}
            className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-line bg-line grid-flow-dense md:grid-cols-2"
          >
            {complaints.map((c, i) => (
              <ComplaintCard
                key={c.id}
                complaint={c}
                shortDate={shortDate}
                dateTime={dateTime}
                fillRow={i === complaints.length - 1 && complaints.length % 2 === 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
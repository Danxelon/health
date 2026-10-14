/**
 * Small UI primitives shared across pages.
 *
 * These exist to keep one look (radius, weight, focus behaviour) and to give
 * every bilingual surface a place to say the same thing twice. No component
 * here knows about data; pages compose them.
 */

import type { ReactNode } from "react";

import { useAppShell } from "@/state/app-shell.tsx";
import { distanceLabel } from "@/domain/matching.ts";
import type { DistanceBand } from "@/domain/types.ts";

export function SectionHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl sm:text-3xl text-ink max-w-2xl">{title}</h2>
        {action}
      </div>
      {body && <p className="text-muted max-w-xl text-[15px]">{body}</p>}
    </div>
  );
}

export function Badge({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "blood" | "success" | "warning" | "muted" | "ink-brand";
}) {
  const tones = {
    brand: "bg-brand-soft text-brand-deep",
    blood: "bg-blood-soft text-blood-deep",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    muted: "bg-elevated text-muted",
    "ink-brand": "bg-ink-brand-soft text-ink-brand",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** A distance, shown as a band label with the km when known. */
export function DistanceChip({ km, band }: { km: number | null; band: DistanceBand }) {
  const { lang, tb } = useAppShell();
  const label = distanceLabel(km, band) ?? { en: "Distance unknown", bn: "দূরত্ব অজানা" };
  const { bn, en } = label;
  const text = lang === "bn" ? bn : en;
  return (
    <Badge tone="muted">
      <span aria-hidden="true">·</span>
      <span>{text}</span>
      <span className="sr-only">{tb(label)}</span>
    </Badge>
  );
}

/** A vertical loading block that matches the height of the cards it stands in for. */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl border border-line bg-surface ${className}`} aria-hidden="true">
      <div className="h-3 w-2/3 rounded bg-elevated m-4" />
      <div className="h-3 w-full rounded bg-elevated m-4 mt-1" />
      <div className="h-8 w-24 rounded-full bg-elevated m-4" />
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: ReactNode; onRetry?: () => void }) {
  const { t } = useAppShell();
  return (
    <div
      role="alert"
      className="rounded-2xl border border-blood-soft bg-blood-soft/60 px-5 py-4 flex flex-col gap-3"
    >
      <p className="text-sm text-blood-deep">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="self-start rounded-full border border-blood/40 px-4 py-1.5 text-xs font-semibold text-blood-deep hover:bg-blood-soft transition-colors cursor-pointer"
        >
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
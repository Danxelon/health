/**
 * RequestsMine — the requestor's own request list.
 *
 * Ordered newest-first, each row opens its tracking screen. The list is the
 * second half of the "my requests" promise: after you post, you need to see
 * movement. Expired rows state that loudly — never silently (`expired` status
 * text is part of the copy contract).
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Droplet, HeartPulse } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { fetchMyRequests } from "@/api/requests.ts";
import { Badge, SectionHeader } from "@/components/ui.tsx";
import { STATUS_META, URGENCY_META } from "@/domain/requests.ts";
import type { BloodRequest } from "@/domain/types.ts";
import { COMPONENT_LABELS } from "@/lib/strings.ts";

function statusTone(status: BloodRequest["status"]): "brand" | "blood" | "success" | "warning" | "muted" {
  // STATUS_META uses semantic tones; bad those onto the Badge palette.
  const meta = STATUS_META[status]?.tone ?? "muted";
  if (meta === "info") return "brand";
  if (meta === "danger") return "blood";
  return meta;
}

function statusLabel(lang: "bn" | "en", status: BloodRequest["status"]): string {
  return STATUS_META[status]?.[lang] ?? status;
}

export default function RequestsMine() {
  const { t, lang } = useAppShell();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyRequests()
      .then((list) => {
        // Newest first — the list is a status board, not a log.
        setRequests([...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("errors.generic")))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24">
      <SectionHeader
        eyebrow={t("request.myRequests")}
        title={t("request.myRequests")}
        body={t("request.whatNext")}
        action={
          <Link
            to="/requests/new"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep transition-colors"
          >
            <HeartPulse className="h-4 w-4" aria-hidden="true" />
            {t("nav.request")}
          </Link>
        }
      />

      {error && (
        <div className="mt-6 rounded-2xl border border-blood-soft bg-blood-soft/60 px-5 py-4" role="alert">
          <p className="text-sm text-blood-deep">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="mt-8 space-y-3" role="status" aria-live="polite">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl border border-line bg-surface" aria-hidden="true" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-line bg-surface p-12 text-center text-muted">
          <Droplet className="mx-auto h-8 w-8 text-subtle" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-3 font-semibold text-ink">{t("common.empty")}</p>
          <Link
            to="/requests/new"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep transition-colors"
          >
            {t("nav.request")}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {requests.map((r) => {
            const tone = statusTone(r.status);
            return (
              <li key={r.id}>
                <Link
                  to={`/requests/${r.id}`}
                  className="group flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-surface p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blood-soft text-blood font-bold tnum">
                    {r.blood_group_needed}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">
                      {r.hospital_name ?? r.blood_group_needed}
                      {r.units_needed > 1 && (
                        <span className="ml-1 text-xs font-normal text-muted">
                          · {r.units_needed} {t("request.unitsHint")}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {COMPONENT_LABELS[r.component][lang]} · {URGENCY_META[r.urgency][lang]}
                    </span>
                  </span>
                  <Badge tone={tone}>{statusLabel(lang, r.status)}</Badge>
                  <ArrowRight
                    className="h-4 w-4 text-muted group-hover:text-brand transition-colors"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
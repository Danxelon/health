/**
 * RequestsDetail — tracking + escalation timeline.
 *
 * The single most important screen in Phase 1. A frightened family member needs
 * to see: is anyone coming, what happens next, and who said yes. The ladder
 * comes from the domain `escalationLadder` (mirrored by the `next_escalation_step`
 * RPC server-side), responders are unlocked/cancelled only through RPCs, and the
 * fulfilled state is explicit — "we found the blood" is closing, not a guess.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { Badge, SectionHeader } from "@/components/ui.tsx";
import {
  cancelBloodRequest,
  fetchRequestTracking,
  unlockDonorContact,
  type RequestTracking,
  type UnlockResult,
} from "@/api/requests.ts";
import { escalationLadder } from "@/domain/requests.ts";
import type { ResponseState } from "@/domain/types.ts";
import { COMPONENT_LABELS, URGENCY_LABELS } from "@/lib/strings.ts";
import { toBengaliDigits } from "@/domain/profile.ts";

const STATE_LABELS: Record<ResponseState, { en: string; bn: string }> = {
  invited: { en: "Invited", bn: "জানানো হয়েছে" },
  accepted: { en: "On the way", bn: "আসছেন" },
  declined: { en: "Declined", bn: "না করতে পেরেছেন" },
  donated: { en: "Donated", bn: "রক্ত দিয়েছেন" },
  no_show: { en: "No show", bn: "আসেননি" },
  cancelled: { en: "Cancelled", bn: "বাতিল হয়েছে" },
};

const STATE_TONE: Record<ResponseState, "brand" | "blood" | "success" | "warning" | "muted"> = {
  invited: "muted",
  accepted: "brand",
  declined: "muted",
  donated: "success",
  no_show: "blood",
  cancelled: "muted",
};

export default function RequestsDetail() {
  const { t, lang } = useAppShell();
  const { id } = useParams<{ id: string }>();
  const [tracking, setTracking] = useState<RequestTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlockByDonor, setUnlockByDonor] = useState<Record<string, UnlockResult>>({});
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRequestTracking(id)
      .then((data) => {
        if (!cancelled) setTracking(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("errors.generic"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, refreshKey, t]);

  const handleUnlock = async (donorId: string) => {
    if (!id) return;
    setUnlocking(donorId);
    setError(null);
    try {
      const result = await unlockDonorContact(id, donorId);
      setUnlockByDonor((prev) => ({ ...prev, [donorId]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setUnlocking(null);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    setCancelling(true);
    setError(null);
    try {
      await cancelBloodRequest(id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24" role="status" aria-live="polite">
        <div className="h-10 w-1/3 animate-pulse rounded bg-elevated" />
        <div className="mt-6 h-40 animate-pulse rounded-3xl border border-line bg-surface" />
        <div className="mt-6 h-40 animate-pulse rounded-3xl border border-line bg-surface" />
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24">
        <div className="rounded-2xl border border-blood-soft bg-blood-soft/60 px-5 py-4" role="alert">
          <p className="text-sm text-blood-deep">{error ?? t("errors.notFound")}</p>
          <Link
            to="/requests/mine"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("request.myRequests")}
          </Link>
        </div>
      </div>
    );
  }

  const { request, counts, responders } = tracking;
  const ladder = escalationLadder(request.urgency, request.created_at);
  const isLive = request.status === "open" || request.status === "matching";
  const done = request.status === "fulfilled";

  const next = ladder.find((s) => !s.done) ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24">
      <Link
        to="/requests/mine"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep hover:text-brand transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("request.myRequests")}
      </Link>

      {/* Request header */}
      <div className="mt-4 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blood-soft text-blood display text-2xl tnum">
              {request.blood_group_needed}
            </span>
            <div>
              <h1 className="text-2xl text-ink">
                {request.hospital_name ?? request.blood_group_needed}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {COMPONENT_LABELS[request.component][lang]} · {URGENCY_LABELS[request.urgency][lang]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {done ? (
              <Badge tone="success">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("request.markFulfilled")}
              </Badge>
            ) : (
              <Badge tone={request.status === "expired" ? "blood" : "brand"}>
                {t("request.tracking")}
              </Badge>
            )}
          </div>
        </div>

        {/* Fulfilment progress */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-semibold text-muted">
            <span>
              {toBengaliDigits(request.units_confirmed)} / {toBengaliDigits(request.units_needed)}{" "}
              {t("request.unitsHint")}
            </span>
            <span>{done ? t("request.markFulfilled") : t("request.continues")}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuemin={0} aria-valuemax={request.units_needed} aria-valuenow={request.units_confirmed}>
            <div
              className={`h-full rounded-full ${done ? "bg-success" : "bg-brand"} transition-all duration-500`}
              style={{ width: `${Math.min(100, (request.units_confirmed / request.units_needed) * 100)}%` }}
            />
          </div>
        </div>

        {/* Next step sentence */}
        <div className="mt-6 flex items-start gap-2 rounded-2xl bg-elevated px-4 py-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <p className="text-sm text-muted">
            {next ? (lang === "bn" ? next.label_bn : next.label_en) : t("request.whatNext")}
          </p>
        </div>
      </div>

      {/* Escalation ladder */}
      <SectionHeader eyebrow={t("request.tracking")} title={t("request.whatNext")} body={t("request.expressNote")} />
      <ol className="mt-6 space-y-0">
        {ladder.map((step, i) => (
          <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
            {i < ladder.length - 1 && (
              <span
                className={`absolute left-[11px] top-6 h-full w-px ${step.done ? "bg-brand" : "bg-line"}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 tnum text-[10px] font-bold ${
                step.done
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-muted"
              }`}
            >
              {step.done ? <Check className="h-3 w-3" aria-hidden="true" /> : toBengaliDigits(i + 1)}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-sm font-semibold ${step.done ? "text-ink" : "text-muted"}`}>
                {lang === "bn" ? step.label_bn : step.label_en}
              </p>
              {step.radius_km !== null && (
                <p className="text-xs text-subtle">≈ {toBengaliDigits(step.radius_km)} km</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Responders */}
      <div className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl text-ink">{t("request.responders")}</h2>
          <span className="text-xs text-muted">
            {toBengaliDigits(counts.invited + counts.accepted + counts.declined)}{" "}
            {t("request.contacted")}
          </span>
        </div>

        {responders.length === 0 ? (
          <p className="mt-4 rounded-3xl border border-line bg-surface p-10 text-center text-sm text-muted">
            {t("common.empty")}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {responders.map((r) => {
              const unlocked = unlockByDonor[r.donor_id];
              return (
                <li key={r.response_id} className="rounded-3xl border border-line bg-surface p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-deep font-bold">
                      {r.display_name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-ink">{r.display_name}</p>
                        {r.blood_group && (
                          <span className="inline-flex items-center rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-bold text-brand-deep">
                            {r.blood_group}
                          </span>
                        )}
                      </div>
                      {(r.upazila_en || r.upazila_bn || r.district_en || r.district_bn) && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                          <span className="inline-flex items-center gap-1 text-ink/80 font-medium">
                            <MapPin className="h-3.5 w-3.5 text-brand shrink-0" aria-hidden="true" />
                            {lang === "bn"
                              ? [r.upazila_bn ?? r.upazila_en, r.district_bn ?? r.district_en].filter(Boolean).join(", ")
                              : [r.upazila_en ?? r.upazila_bn, r.district_en ?? r.district_bn].filter(Boolean).join(", ")}
                          </span>
                          {r.distance_km != null && (
                            <span className="text-subtle">
                              · {lang === "bn" ? `${toBengaliDigits(r.distance_km)} কিমি দূরে` : `${r.distance_km} km away`}
                            </span>
                          )}
                          {r.lat && r.lng && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[11px] font-bold text-brand hover:underline"
                              title={lang === "bn" ? "গুগল ম্যাপে অবস্থান দেখুন" : "View location on Google Maps"}
                            >
                              <Navigation className="h-3 w-3" aria-hidden="true" />
                              <span>{lang === "bn" ? "ম্যাপ" : "Map"}</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge tone={STATE_TONE[r.state]}>{STATE_LABELS[r.state][lang]}</Badge>

                    {isLive && (r.state === "accepted" || r.state === "invited") && (
                      <button
                        type="button"
                        disabled={unlocking === r.donor_id || Boolean(unlocked)}
                        onClick={() => handleUnlock(r.donor_id)}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-ink text-white px-4 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <Phone className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                        {unlocked
                          ? t("request.contacted")
                          : unlocking === r.donor_id
                            ? t("common.loading")
                            : t("request.call")}
                      </button>
                    )}
                  </div>

                  {/* Unlocked contact — shown once, and never skippable */}
                  {unlocked && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-success-soft px-4 py-3">
                      <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
                      <a
                        href={`tel:${unlocked.phone ?? ""}`}
                        className="font-semibold text-ink tnum hover:text-brand-deep"
                      >
                        {unlocked.phone ?? t("request.contacted")}
                      </a>
                      <span className="text-xs text-muted">{unlocked.courtesy_bn ?? unlocked.courtesy_en ?? ""}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Actions */}
      {isLive && (
        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-blood/40 px-5 text-sm font-semibold text-blood-deep hover:bg-blood-soft transition-colors cursor-pointer disabled:opacity-50"
          >
            {t("request.cancel")}
          </button>
        </div>
      )}
      {confirmCancel && (
        <div className="mt-3 rounded-2xl border border-blood-soft bg-blood-soft/60 px-5 py-4">
          <p className="text-sm text-blood-deep">{t("request.cancelConfirm")}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-full bg-blood px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {t("request.cancel")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <ScaleHint lang={lang} />
    </div>
  );
}

function ScaleHint({ lang }: { lang: "bn" | "en" }) {
  return (
    <p className="mt-10 flex items-start gap-2 text-xs text-subtle">
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {lang === "bn"
        ? "অবস্থান কখনো পূর্ণ ঠিকানা নয় — শুধু দূরত্বের ব্যান্ড দেখানো হয়।"
        : "Location is never an address — only a distance band."}
    </p>
  );
}
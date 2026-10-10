/**
 * RequestsNew — express + full request form.
 *
 * Two tiers: an express panel (group, hospital, urgency — go) and a detailed
 * form the same three answers plus component, units, needed-by, upazila,
 * reason and patient details. Submitted through `create_blood_request`, which
 * sets `expires_at` and starts the invite cascade; the tracking screen is the
 * landing place afterwards.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Droplet, HeartPulse } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { DISTANCE_BANDS, type BloodComponent, type BloodGroup } from "@/domain/types.ts";
import { COMPONENT_LABELS, URGENCY_LABELS } from "@/lib/strings.ts";
import { createBloodRequest } from "@/api/requests.ts";
import { BLOOD_GROUPS } from "@/domain/types.ts";
import { Badge } from "@/components/ui.tsx";
import { todayISO } from "@/domain/eligibility.ts";

export default function RequestsNew() {
  const { t, lang } = useAppShell();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"express" | "full">("express");

  // Shared core
  const [group, setGroup] = useState<BloodGroup | null>(null);
  const [urgency, setUrgency] = useState<"routine" | "urgent" | "critical" | null>(null);
  const [hospital, setHospital] = useState("");

  // Full-form extras
  const [component, setComponent] = useState<BloodComponent>("whole_blood");
  const [units, setUnits] = useState(1);
  const [neededBy, setNeededBy] = useState("");
  const [reason, setReason] = useState("");
  const [patientName, setPatientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => todayISO().slice(0, 10), []);

  const canSubmit =
    group !== null && urgency !== null && hospital.trim().length >= 3 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !urgency) return;
    setSubmitting(true);
    setError(null);
    try {
      const request = await createBloodRequest({
        blood_group_needed: group,
        component,
        units_needed: units,
        urgency,
        hospital_name: hospital.trim(),
        needed_by: neededBy || null,
        reason: reason.trim() || null,
        upazila_id: 111,
        patient_name: patientName.trim() || null,
        hospital_contact: null,
      });
      navigate(`/requests/${request.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl text-ink">{t("request.title")}</h1>

        {/* Mode switch */}
        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-1.5">
          <button
            type="button"
            onClick={() => setMode("express")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
              mode === "express" ? "bg-brand text-white" : "text-muted hover:text-ink"
            }`}
          >
            {t("request.express")}
          </button>
          <button
            type="button"
            onClick={() => setMode("full")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
              mode === "full" ? "bg-brand text-white" : "text-muted hover:text-ink"
            }`}
          >
            {t("request.full")}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-blood-soft bg-blood-soft/60 px-5 py-4" role="alert">
            <p className="text-sm text-blood-deep">{error}</p>
          </div>
        )}

        <form onSubmit={submit} className="mt-8 space-y-5">
          {/* Blood group — the key decision */}
          <fieldset>
            <legend className="text-sm font-semibold text-ink">{t("donors.patientGroup")}</legend>
            <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label={t("donors.patientGroup")}>
              {BLOOD_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g)}
                  className={`rounded-xl border px-2 py-3 text-sm font-bold tnum transition-colors cursor-pointer ${
                    group === g
                      ? "border-blood bg-blood-soft text-blood-deep"
                      : "border-line bg-surface text-ink hover:border-line-strong"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Urgency — also the engine that drives the cascade */}
          <fieldset>
            <legend className="text-sm font-semibold text-ink">{t("donors.urgency")}</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(["routine", "urgent", "critical"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer ${
                    urgency === u
                      ? u === "critical"
                        ? "border-blood bg-blood-soft"
                        : "border-brand bg-brand-soft"
                      : "border-line bg-surface hover:border-line-strong"
                  }`}
                >
                  <span
                    className={`text-sm font-bold ${
                      u === "critical" ? "text-blood-deep" : "text-ink"
                    }`}
                  >
                    {URGENCY_LABELS[u][lang]}
                  </span>
                  <span className="mt-1 block text-xs text-muted leading-relaxed">
                    {u === "critical"
                      ? URGENCY_LABELS.critical[lang] + " · 24h"
                      : u === "urgent"
                        ? URGENCY_LABELS.urgent[lang] + " · 48h"
                        : URGENCY_LABELS.routine[lang] + " · 7d"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Hospital */}
          <label className="block text-sm font-semibold text-ink">
            {t("request.hospital")}
            <input
              value={hospital}
              onChange={(e) => setHospital(e.target.value)}
              placeholder={t("request.hospitalPh")}
              className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
            />
          </label>

          {/* Full form extras */}
          {mode === "full" && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-ink">
                  {t("donors.component")}
                  <select
                    value={component}
                    onChange={(e) => setComponent(e.target.value as BloodComponent)}
                    className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
                  >
                    {(["whole_blood", "prbc", "platelets", "plasma"] as const).map((c) => (
                      <option key={c} value={c}>
                        {COMPONENT_LABELS[c][lang]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-semibold text-ink">
                  {t("request.units")}
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={units}
                      onChange={(e) => setUnits(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                      className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink tnum outline-none focus:border-brand"
                    />
                    <span className="shrink-0 text-xs text-muted">{t("request.unitsHint")}</span>
                  </div>
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-ink">
                  {t("request.neededBy")}
                  <input
                    type="date"
                    min={today}
                    value={neededBy}
                    onChange={(e) => setNeededBy(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
                  />
                </label>

                <label className="block text-sm font-semibold text-ink">
                  {t("request.patientName")}
                  <input
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
                  />
                </label>
              </div>

              <label className="block text-sm font-semibold text-ink">
                {t("request.reason")}
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("request.reasonPh")}
                  rows={2}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand resize-none"
                />
              </label>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white disabled:opacity-40 hover:bg-brand-deep transition-colors cursor-pointer"
            >
              <HeartPulse className="h-4 w-4" aria-hidden="true" />
              {submitting ? t("request.submitting") : t("request.submit")}
            </button>
          </div>
        </form>

        <p className="mt-6 flex items-start gap-2 text-xs text-muted">
          <Droplet className="mt-0.5 h-4 w-4 shrink-0 text-blood" aria-hidden="true" />
          {t("request.expressNote")}
        </p>
      </div>
    </div>
  );
}
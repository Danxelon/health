/**
 * RequestsNew — express + full request form.
 *
 * Two tiers: an express panel (group, hospital, urgency — go) and a detailed
 * form the same three answers plus component, units, needed-by, upazila,
 * reason and patient details. Submitted through `create_blood_request`, which
 * sets `expires_at` and starts the invite cascade; the tracking screen is the
 * landing place afterwards.
 */

import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Droplet, HeartPulse, MapPin, Search, X } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { useAuth } from "@/state/auth-context.tsx";
import { type BloodComponent, type BloodGroup } from "@/domain/types.ts";
import { COMPONENT_LABELS, URGENCY_LABELS } from "@/lib/strings.ts";
import { createBloodRequest } from "@/api/requests.ts";
import { BLOOD_GROUPS } from "@/domain/types.ts";
import { todayISO } from "@/domain/eligibility.ts";
import { DEMO_UPAZILAS } from "@/lib/demo-data.ts";

export default function RequestsNew() {
  const { t, lang } = useAppShell();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login?next=/requests/new", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  const [mode, setMode] = useState<"express" | "full">("express");

  // Shared core
  const [group, setGroup] = useState<BloodGroup | null>(null);
  const [urgency, setUrgency] = useState<"routine" | "urgent" | "critical" | null>(null);
  const [hospital, setHospital] = useState("");
  const [hospitalContact, setHospitalContact] = useState("");

  // Division & Upazila Geolocation Hierarchy
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedUpazilaId, setSelectedUpazilaId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Full-form extras
  const [component, setComponent] = useState<BloodComponent>("whole_blood");
  const [units, setUnits] = useState(1);
  const [neededBy, setNeededBy] = useState("");
  const [reason, setReason] = useState("");
  const [patientName, setPatientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => todayISO().slice(0, 10), []);

  // Unique divisions with bilingual labels
  const divisions = useMemo(() => {
    const map = new Map<string, { en: string; bn: string }>();
    DEMO_UPAZILAS.forEach((u) => {
      if (!map.has(u.division_en)) {
        map.set(u.division_en, { en: u.division_en, bn: u.division_bn });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.en.localeCompare(b.en));
  }, []);

  const selectedUpazila = useMemo(
    () => (selectedUpazilaId !== null ? DEMO_UPAZILAS.find((u) => u.id === selectedUpazilaId) : null),
    [selectedUpazilaId]
  );

  const filteredUpazilas = useMemo(() => {
    let list = selectedDivision
      ? DEMO_UPAZILAS.filter((u) => u.division_en === selectedDivision)
      : DEMO_UPAZILAS;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.name_en.toLowerCase().includes(q) ||
          u.name_bn.includes(q) ||
          u.district_en.toLowerCase().includes(q) ||
          u.district_bn.includes(q) ||
          u.division_en.toLowerCase().includes(q) ||
          u.division_bn.includes(q)
      );
    }
    return list;
  }, [selectedDivision, searchQuery]);

  // Ensure currently selected upazila is included in dropdown options even during active search
  const displayUpazilas = useMemo(() => {
    if (selectedUpazila && !filteredUpazilas.some((u) => u.id === selectedUpazila.id)) {
      return [selectedUpazila, ...filteredUpazilas];
    }
    return filteredUpazilas;
  }, [filteredUpazilas, selectedUpazila]);

  const canSubmit =
    group !== null &&
    urgency !== null &&
    hospital.trim().length >= 3 &&
    selectedUpazilaId !== null &&
    !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !urgency || !selectedUpazilaId) return;
    const upazila = DEMO_UPAZILAS.find((u) => u.id === selectedUpazilaId);
    if (!upazila) return;

    setSubmitting(true);
    setError(null);
    try {
      const request = await createBloodRequest({
        blood_group_needed: group,
        component,
        units_needed: units,
        urgency,
        hospital_name: hospital.trim(),
        hospital_contact: hospitalContact.trim() || null,
        needed_by: neededBy || null,
        reason: reason.trim() || null,
        upazila_id: selectedUpazilaId,
        lat: upazila.lat,
        lng: upazila.lng,
        division: upazila.division_en,
        patient_name: patientName.trim() || null,
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

          {/* Hospital Contact */}
          <label className="block text-sm font-semibold text-ink">
            {t("request.hospitalContact")}
            <input
              value={hospitalContact}
              onChange={(e) => setHospitalContact(e.target.value)}
              placeholder={t("request.hospitalContactPh")}
              className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
            />
          </label>

          {/* Division and Upazila Geolocation Selection */}
          <fieldset className="space-y-4 rounded-2xl border border-line bg-surface/50 p-4 sm:p-5">
            <legend className="text-sm font-semibold text-ink px-1">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-brand" />
                <span>{t("request.locationTitle")}</span>
              </span>
            </legend>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Division selector */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  {t("request.division")}
                </label>
                <select
                  value={selectedDivision}
                  onChange={(e) => {
                    const newDiv = e.target.value;
                    setSelectedDivision(newDiv);
                    if (selectedUpazila && selectedUpazila.division_en !== newDiv && newDiv !== "") {
                      setSelectedUpazilaId(null);
                    }
                  }}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand font-medium"
                >
                  <option value="">{t("request.selectDivision")}</option>
                  {divisions.map((d) => (
                    <option key={d.en} value={d.en}>
                      {lang === "bn" ? d.bn : d.en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upazila Quick Search */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  {t("request.searchUpazilaPh")}
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === "bn" ? "যেমন: সাভার, মিরপুর, সদর..." : "e.g. Savar, Mirpur, Sadar..."}
                    className="w-full rounded-xl border border-line bg-surface pl-9 pr-8 py-2.5 text-sm text-ink outline-none focus:border-brand font-medium placeholder:text-muted/60"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Upazila dropdown */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                {t("request.upazila")}
              </label>
              <select
                value={selectedUpazilaId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setSelectedUpazilaId(null);
                  } else {
                    const id = Number(val);
                    setSelectedUpazilaId(id);
                    const chosen = DEMO_UPAZILAS.find((u) => u.id === id);
                    if (chosen && !selectedDivision) {
                      setSelectedDivision(chosen.division_en);
                    }
                  }
                }}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand font-medium"
              >
                <option value="">{t("request.selectUpazila")}</option>
                {displayUpazilas.map((u) => (
                  <option key={u.id} value={u.id}>
                    {lang === "bn"
                      ? `${u.name_bn}, ${u.district_bn} (${u.division_bn})`
                      : `${u.name_en}, ${u.district_en} (${u.division_en})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Location Pill */}
            {selectedUpazila && (
              <div className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand-soft/40 px-3.5 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand shrink-0" />
                  <span className="font-semibold text-brand-deep">
                    {lang === "bn"
                      ? `${selectedUpazila.name_bn}, জেলা: ${selectedUpazila.district_bn}, বিভাগ: ${selectedUpazila.division_bn}`
                      : `${selectedUpazila.name_en}, Dist: ${selectedUpazila.district_en}, Div: ${selectedUpazila.division_en}`}
                  </span>
                  <span className="text-[11px] text-muted">
                    ({selectedUpazila.lat.toFixed(4)}, {selectedUpazila.lng.toFixed(4)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUpazilaId(null);
                    setSearchQuery("");
                  }}
                  className="text-xs text-muted hover:text-ink cursor-pointer underline"
                >
                  {t("request.changeLocation")}
                </button>
              </div>
            )}
          </fieldset>

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

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-white disabled:opacity-40 hover:bg-brand-deep transition-colors cursor-pointer"
            >
              <HeartPulse className="h-4 w-4" aria-hidden="true" />
              {submitting ? t("request.submitting") : t("request.submit")}
            </button>
            {!selectedUpazilaId && hospital.trim().length >= 3 && group && urgency && (
              <p className="text-center text-xs text-muted">
                {lang === "bn"
                  ? "অনুরোধ পাঠাতে অনুগ্রহ করে রোগীর উপজেলা নির্বাচন করুন।"
                  : "Please select the patient's upazila to post the request."}
              </p>
            )}
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
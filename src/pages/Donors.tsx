/**
 * Donors — search with rings, compatibility, eligibility, and ranking.
 *
 * The page shows a search form with optional filters, then displays compatible donors
 * in a grid with distance bands, availability badges, and action buttons.
 * Donors are ranked by proximity, availability, verified status, and reliability.
 * The page uses the search_nearby_donors RPC (demo or real) and the domain
 * matching functions for scoring and ranking.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Droplet, MapPin, Search } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { Badge, DistanceChip, SectionHeader } from "@/components/ui.tsx";
import { searchDonors, type SearchDonorsArgs, type SearchResults } from "@/api/donors.ts";
import { fetchDoctors } from "@/api/doctors.ts";
import type { BloodComponent, BloodGroup, DoctorCard, RequestUrgency } from "@/domain/types.ts";
import { COMPONENT_LABELS, URGENCY_LABELS } from "@/lib/strings.ts";

export default function Donors() {
  const { t, lang } = useAppShell();
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);

  const doSearch = async (args: SearchDonorsArgs) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchDonors(args);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    doSearch({
      recipientGroup: formData.get("recipientGroup") as BloodGroup,
      lat: formData.get("lat") ? parseFloat(formData.get("lat") as string) : null,
      lng: formData.get("lng") ? parseFloat(formData.get("lng") as string) : null,
      upazilaId: formData.get("upazilaId") ? Number(formData.get("upazilaId")) : null,
      urgency: formData.get("urgency") as RequestUrgency,
      component: formData.get("component") ? (formData.get("component") as BloodComponent) : null,
    });
  };

  useEffect(() => {
    fetchDoctors().then((d) => {
      setDoctors(d);
      setDoctorsLoading(false);
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24">
      <SectionHeader
        eyebrow={t("donors.title")}
        title={t("donors.title")}
        body={t("donors.subtitle")}
      />

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <label className="block text-sm font-semibold text-ink">
            {t("donors.patientGroup")}
            <select
              name="recipientGroup"
              required
              className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
            >
              <option value="">{lang === "bn" ? "চয়ন করুন" : "Choose"}</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                <option key={g} value={g}>
                  {lang === "bn" ? g.replace("+", " ধনাত্মক").replace("-", " ঋণাত্মক") : g}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-ink">
            {t("donors.urgency")}
            <select
              name="urgency"
              required
              className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
            >
              <option value="">{lang === "bn" ? "চয়ন করুন" : "Choose"}</option>
              {(["routine", "urgent", "critical"] as RequestUrgency[]).map((u) => (
                <option key={u} value={u}>
                  {URGENCY_LABELS[u][lang]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-ink">
            {t("donors.component")}
            <select
              name="component"
              className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
            >
              <option value="">{lang === "bn" ? "কোনোটি একটি" : "Any"}</option>
              {(["whole_blood", "prbc", "platelets", "plasma"] as BloodComponent[]).map((c) => (
                <option key={c} value={c}>
                  {COMPONENT_LABELS[c][lang]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white disabled:opacity-40 hover:bg-brand-deep transition-colors"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {loading ? t("common.loading") : t("common.search")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const form = document.querySelector("form");
                      if (form) {
                        (form.elements.namedItem("lat") as HTMLInputElement).value = String(
                          pos.coords.latitude
                        );
                        (form.elements.namedItem("lng") as HTMLInputElement).value = String(
                          pos.coords.longitude
                        );
                      }
                    },
                    () => {},
                    { enableHighAccuracy: true, timeout: 8000 }
                  );
                }
              }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:border-line-strong transition-colors"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t("donors.searchHere")}</span>
            </button>
          </div>
        </div>

        {/* Hidden lat/lng for geolocation */}
        <input type="hidden" name="lat" />
        <input type="hidden" name="lng" />
        <input type="hidden" name="upazilaId" />
      </form>

      {/* Results */}
      <div className="mt-12" role="status" aria-live="polite">
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label={t("common.loading")}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-3xl border border-line bg-surface p-6">
                <div className="h-10 w-10 rounded-full bg-elevated" />
                <div className="mt-4 h-4 w-24 rounded bg-elevated" />
                <div className="mt-2 h-3 w-16 rounded bg-elevated" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-blood-soft bg-blood-soft/60 px-5 py-4" role="alert">
            <p className="text-sm text-blood-deep">{error}</p>
          </div>
        )}

        {results && !loading && (
          <>
            <p className="text-sm text-muted mb-4">
              {t("donors.resultsFor")} {results.counts.total} · {t("donors.readyNow")} {results.counts.ready_now}
            </p>

            {results.donors.length === 0 ? (
              <div className="rounded-3xl border border-line bg-surface p-12 text-center text-muted">
                <p className="font-semibold text-ink mb-2">{t("donors.noneTitle")}</p>
                <p>{t("donors.noneBody")}</p>
                <div className="mt-6 flex gap-3 justify-center">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep"
                  >
                    {t("donors.widen")}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:border-line-strong"
                  >
                    {t("donors.createRequest")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {results.donors.map((d) => (
                  <div
                    key={d.donor_id}
                    className="group flex flex-col gap-4 p-6 rounded-3xl border border-line bg-surface hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blood/10 text-blood font-bold text-sm tnum"
                      >
                        {d.blood_group}
                      </span>
                      <span className="font-semibold text-ink">{d.display_name}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <DistanceChip km={d.distance_km} band={d.distance_band} />
                      <Badge tone={d.can_give_now ? "success" : "muted"}>
                        {d.can_give_now ? t("donors.readyNow") : t("donors.unavailable")}
                      </Badge>
                      {d.blood_group_verified && (
                        <Badge tone="brand">
                          ✓ {t("donors.respects")}
                        </Badge>
                      )}
                    </div>

                    {d.soft_warnings && d.soft_warnings.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {d.soft_warnings.map((w) => (
                          <Badge key={w} tone="warning">
                            {w}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto pt-2 border-t border-line">
                      <button
                        type="button"
                        className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep transition-colors"
                      >
                        <Droplet className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                        {t("request.express")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Capacity rail */}
      {!doctorsLoading && doctors.length > 0 && (
        <div className="mt-16">
          <SectionHeader
            eyebrow={t("doctors.verified")}
            title={t("doctors.title")}
            body={t("doctors.subtitle")}
            action={
              <Link
                to="/doctors"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-deep hover:text-brand transition-colors"
              >
                {t("common.seeAll")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.slice(0, 3).map((doctor) => (
              <li key={doctor.user_id}>
                <Link
                  to="/doctors"
                  className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep font-bold text-lg">
                    {doctor.display_name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{doctor.display_name}</span>
                    <span className="block truncate text-xs text-muted">
                      {doctor.degrees} ·{" "}
                      {lang === "bn" ? doctor.specialty_bn : doctor.specialty_en}
                    </span>
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted group-hover:text-brand transition-colors" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
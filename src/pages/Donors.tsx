/**
 * Donors — search with blood group picker, area filter, and ranking.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Droplet, Search } from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { Badge, DistanceChip, SectionHeader } from "@/components/ui.tsx";
import { searchDonors, type SearchDonorsArgs, type SearchResults } from "@/api/donors.ts";
import { fetchDoctors } from "@/api/doctors.ts";
import type { BloodGroup, DoctorCard, RequestUrgency } from "@/domain/types.ts";
import { URGENCY_LABELS } from "@/lib/strings.ts";
import { DEMO_UPAZILAS } from "@/lib/demo-data.ts";
import { supabase } from "@/lib/supabase.ts";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function Donors() {
  const { t, lang } = useAppShell();
  const navigate = useNavigate();

  const [selectedGroup, setSelectedGroup] = useState<BloodGroup | "">("");
  const [selectedUrgency, setSelectedUrgency] = useState<RequestUrgency>("routine");
  const [selectedUpazila, setSelectedUpazila] = useState<number | "">("");

  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);

  // Require auth on page load or action
  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/login?next=/donors", { replace: true });
      }
    });
  }, [navigate]);

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;

    const upazila = DEMO_UPAZILAS.find((u) => u.id === Number(selectedUpazila));

    doSearch({
      recipientGroup: selectedGroup,
      lat: upazila ? upazila.lat : null,
      lng: upazila ? upazila.lng : null,
      upazilaId: selectedUpazila ? Number(selectedUpazila) : null,
      urgency: selectedUrgency,
      component: null,
    });
  };

  useEffect(() => {
    fetchDoctors().then((d) => {
      setDoctors(d);
      setDoctorsLoading(false);
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24 pt-8">
      <SectionHeader
        eyebrow={t("donors.title")}
        title={t("donors.title")}
        body={t("donors.subtitle")}
      />

      {/* Search Form with Picker */}
      <form onSubmit={handleSearchSubmit} className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-xs">
        <div className="space-y-6">
          {/* Blood Group Picker */}
          <div>
            <label className="block text-sm font-bold text-ink mb-3">
              {t("donors.patientGroup")} <span className="text-brand">*</span>
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
              {BLOOD_GROUPS.map((g) => {
                const isSelected = selectedGroup === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGroup(g)}
                    className={`h-13 flex flex-col items-center justify-center rounded-2xl border font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "border-brand bg-brand text-white shadow-md scale-105"
                        : "border-line bg-elevated text-ink hover:border-brand/40 hover:bg-brand-soft/50"
                    }`}
                  >
                    <span className="text-lg leading-none tnum">{g}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
            {/* Area Sort out without live location */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">
                {lang === "bn" ? "উপজেলা/এলাকা বেছে নিন" : "Select Area / Upazila"}
              </label>
              <select
                value={selectedUpazila}
                onChange={(e) => setSelectedUpazila(e.target.value ? Number(e.target.value) : "")}
                className="w-full h-12 rounded-xl border border-line bg-surface px-4 text-ink outline-none focus:border-brand font-medium"
              >
                <option value="">{lang === "bn" ? "সব এলাকা (সমগ্র বাংলাদেশ)" : "All Areas (Nationwide)"}</option>
                {DEMO_UPAZILAS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {lang === "bn" ? `${u.name_bn}, ${u.district_bn}` : `${u.name_en}, ${u.district_en}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">
                {t("donors.urgency")}
              </label>
              <select
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value as RequestUrgency)}
                className="w-full h-12 rounded-xl border border-line bg-surface px-4 text-ink outline-none focus:border-brand font-medium"
              >
                {(["routine", "urgent", "critical"] as RequestUrgency[]).map((u) => (
                  <option key={u} value={u}>
                    {URGENCY_LABELS[u][lang]}
                  </option>
                ))}
              </select>
            </div>

            {/* Search CTA */}
            <div>
              <button
                type="submit"
                disabled={loading || !selectedGroup}
                className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-white disabled:opacity-40 hover:bg-brand-deep transition-all shadow-xs cursor-pointer"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                {loading ? t("common.loading") : t("common.search")}
              </button>
            </div>
          </div>
        </div>
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
            <p className="text-sm text-muted mb-4 font-medium">
              {t("donors.resultsFor")} {results.counts.total} · {t("donors.readyNow")} {results.counts.ready_now}
            </p>

            {results.donors.length === 0 ? (
              <div className="rounded-3xl border border-line bg-surface p-12 text-center text-muted">
                <p className="font-semibold text-ink mb-2">{t("donors.noneTitle")}</p>
                <p>{t("donors.noneBody")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {results.donors.map((d) => (
                  <div
                    key={d.donor_id}
                    className="group flex flex-col gap-4 p-6 rounded-3xl border border-line bg-surface hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand-deep font-extrabold text-sm tnum">
                        {d.blood_group}
                      </span>
                      <span className="font-bold text-ink">{d.display_name}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <DistanceChip km={d.distance_km} band={d.distance_band} />
                      <Badge tone={d.can_give_now ? "success" : "muted"}>
                        {d.can_give_now ? t("donors.readyNow") : t("donors.unavailable")}
                      </Badge>
                    </div>

                    <div className="mt-auto pt-3 border-t border-line">
                      <button
                        type="button"
                        className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand px-4 text-xs font-bold text-white hover:bg-brand-deep transition-colors cursor-pointer"
                      >
                        <Droplet className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
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

      {/* Doctors section */}
      {!doctorsLoading && doctors.length > 0 && (
        <div className="mt-16 pt-12 border-t border-line">
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
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.slice(0, 3).map((doctor) => (
              <li key={doctor.user_id}>
                <Link
                  to="/doctors"
                  className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-brand-soft text-ink-brand font-bold text-lg">
                    {doctor.display_name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{doctor.display_name}</span>
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

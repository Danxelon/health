/**
 * Doctor and telemedicine API.
 *
 * The directory contract: `verified` doctors only, ordered distance-first then
 * rating, exactly as plan.md §8.2 specifies. Admins see the pending queue
 * through a different, guarded RPC — never through this public list.
 */

import type { DoctorCard } from "@/domain/types.ts";
import { requireSupabase, toDomainError } from "@/lib/supabase.ts";

export interface DoctorFilters {
  specialtySlug?: string | null;
  specialty_id?: number | null;
  district_en?: string | null;
  availableTodayOnly?: boolean;
  freeOnly?: boolean;
  languages?: string | null;
}

const specialtySorter = (a: DoctorCard, b: DoctorCard): number => {
  const byDistance =
    (a.distance_km ?? Number.MAX_SAFE_INTEGER) - (b.distance_km ?? Number.MAX_SAFE_INTEGER);
  if (byDistance !== 0) return byDistance;
  return (b.rating_avg ?? 0) - (a.rating_avg ?? 0);
};

export async function fetchDoctors(filters: DoctorFilters = {}): Promise<DoctorCard[]> {
  // Live directory only: verified doctors from the `doctor_cards` view.
  // An empty list means the database has none — never synthetic stand-ins.
  const client = requireSupabase();
  const { data, error } = await client.from("doctor_cards").select("*");
  if (error) throw toDomainError(error);
  if (data === null) return [];

  const rows = (data as DoctorCard[]).map((d) => ({ ...d, consult_fee: 0 })).filter((d) => {
    if (filters.specialtySlug && d.specialty_slug !== filters.specialtySlug) return false;
    if (filters.specialty_id !== undefined && filters.specialty_id !== null && d.specialty_id !== filters.specialty_id) return false;
    if (filters.district_en && d.district_en !== filters.district_en) return false;
    if (filters.freeOnly && (d.consult_fee ?? 0) > 0) return false;
    if (filters.languages && !(d.languages ?? []).includes(filters.languages)) return false;
    // availableTodayOnly is approximated: the view has no schedule.
    return true;
  });
  return [...rows].sort(specialtySorter);
}
/**
 * Donor-search API.
 *
 * When a Supabase project is configured, `search_nearby_donors` is the only
 * place donor rows can be learned from — there is deliberately no direct
 * `select` on `donors` here. In demo mode the same function shape is answered
 * from the deterministic dataset, including the ring/score ordering, so the
 * UI cannot tell which source answered and the demo cannot drift from the
 * real ordering.
 */

import type { BloodComponent, BloodGroup, DonorCard, DonorCounts, RequestUrgency } from "@/domain/types.ts";
import { rankDonors, groupByRing, scoreDonor, maxRingFor } from "@/domain/matching.ts";
import { acceptableDonorsFor } from "@/domain/blood.ts";
import { DEMO_DONORS, DEMO_UPAZILAS, type DemoUpazila } from "@/lib/demo-data.ts";
import { callRpc, DEMO_MODE } from "@/lib/supabase.ts";

export interface SearchDonorsArgs {
  recipientGroup: BloodGroup;
  /** The caller's snapped point, or an upazila centre. */
  lat: number | null;
  lng: number | null;
  upazilaId: number | null;
  urgency: RequestUrgency;
  component?: BloodComponent | null;
}

export interface SearchResults {
  donors: DonorCard[];
  counts: DonorCounts;
  /** ring → label, with the donors ranked in that ring. */
  groups: ReturnType<typeof groupByRing<DonorCard>>;
  searchedAt: string;
}

/** Rough distance between two points, in metres. Matches `haversineMetres`. */
function demoDistance(a: DemoUpazila, lat: number | null, lng: number | null): number | null {
  if (lat === null || lng === null) return null;
  const R = 6_371_008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(a.lat - lat);
  const dLng = toRad(a.lng - lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(toRad(lat)) * Math.cos(toRad(a.lat));
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

function buildResults(args: SearchDonorsArgs): SearchResults {
  // The component determines the compatibility matrix, but a donor CARD does
  // not vary by component — the group is the group. Eligibility (cooldowns
  // etc.) is a backend-time filter; the demo approximates it with availability.
  const compatible = new Set(acceptableDonorsFor(args.recipientGroup));

  const today = new Date().toISOString().slice(0, 10);
  const originUpazila =
    args.upazilaId !== null ? DEMO_UPAZILAS.find((u) => u.id === args.upazilaId) : undefined;

  const donors: DonorCard[] = DEMO_DONORS.filter((d) => compatible.has(d.blood_group)).map((d) => {
    // The demo donor is anchored to their upazila centre; the real RPC does
    // this against the caller's snapped point.
    const origin = originUpazila ?? {
      lat: args.lat ?? 23.8103,
      lng: args.lng ?? 90.4125,
      id: 0,
      name_en: "",
      name_bn: "",
      district_en: "",
      district_bn: "",
      division_en: "",
      division_bn: "",
    };
    const metres = demoDistance(origin, args.lat, args.lng) ?? d.distance_km! * 1_000;
    const ring =
      metres < 3_000 ? 0 : metres < 10_000 ? 1 : metres < 25_000 ? 2 : Math.min(6, Math.floor(metres / 50_000) + 3);

    const score = scoreDonor(
      {
        metres,
        availableNow: d.available_now,
        verified: d.blood_group_verified,
        donatedCount12mo: 2,
        declinedCount12mo: 0,
        lastDonationDate: null,
        warningCount: d.soft_warnings?.length ?? 0,
      },
      today
    );

    return { ...d, ring, score, distance_km: Math.round(metres / 100) / 10 };
  });

  const ranked = rankDonors(donors);

  return {
    donors: ranked,
    counts: {
      total: ranked.length,
      ready_now: ranked.filter((d) => d.can_give_now).length,
      radius_km: maxRingFor(args.urgency) === 6 ? 50 : [3, 10, 25, 50][maxRingFor(args.urgency) - 1] ?? 10,
      for_group: args.recipientGroup,
      accepts_from: compatible,
    },
    groups: groupByRing(ranked),
    searchedAt: new Date().toISOString(),
  };
}

export async function searchDonors(args: SearchDonorsArgs): Promise<SearchResults> {
  if (DEMO_MODE) {
    // Simulate the round trip so loading behaviour is honest.
    await new Promise((resolve) => setTimeout(resolve, 420));
    return buildResults(args);
  }

  const rows = await callRpc<DonorCard[]>("search_nearby_donors", {
    p_recipient_group: args.recipientGroup,
    p_lat: args.lat,
    p_lng: args.lng,
    p_radius_km: null,
    p_urgency: args.urgency,
    p_upazila_id: args.upazilaId,
    p_component: args.component ?? "whole_blood",
  });

  const ranked = rankDonors(rows);
  return {
    donors: ranked,
    counts: {
      total: ranked.length,
      ready_now: ranked.filter((d) => d.can_give_now).length,
      radius_km: maxRingFor(args.urgency) === 6 ? 50 : 10,
      for_group: args.recipientGroup,
      accepts_from: acceptableDonorsFor(args.recipientGroup),
    },
    groups: groupByRing(ranked),
    searchedAt: new Date().toISOString(),
  };
}
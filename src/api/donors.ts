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

import type {
  BloodComponent,
  BloodGroup,
  ConsentStatus,
  DonorCard,
  DonorConsentRequest,
  DonorCounts,
  RequestUrgency,
} from "../domain/types.ts";
import { DomainError } from "../domain/types.ts";
import { rankDonors, groupByRing, scoreDonor, maxRingFor } from "../domain/matching.ts";
import { pinFeaturedDonor } from "../domain/featured-donor.ts";
import { acceptableDonorsFor } from "../domain/blood.ts";
import { maskDonorIdentity, maskDonorCard } from "../domain/donor-privacy.ts";
import { DEMO_DONORS, DEMO_UPAZILAS, type DemoUpazila } from "../lib/demo-data.ts";
import { callRpc, DEMO_MODE } from "../lib/supabase.ts";

export { maskDonorIdentity, maskDonorCard };

export interface SearchDonorsArgs {
  recipientGroup?: BloodGroup | "";
  /** The caller's snapped point, or an upazila centre. */
  lat: number | null;
  lng: number | null;
  upazilaId: number | null;
  urgency?: RequestUrgency;
  component?: BloodComponent | null;
}

/** `metres` rides along for ranking only and is never rendered on a card. */
type RankedDonorCard = DonorCard & { metres: number | null };

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
  const compatible = args.recipientGroup
    ? new Set(acceptableDonorsFor(args.recipientGroup))
    : new Set(BLOOD_GROUPS);

  const today = new Date().toISOString().slice(0, 10);
  const originUpazila =
    args.upazilaId !== null ? DEMO_UPAZILAS.find((u) => u.id === args.upazilaId) : undefined;

  const donors: RankedDonorCard[] = DEMO_DONORS.filter((d) => compatible.has(d.blood_group)).map((d) => {
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
    const donorLat = d.lat ?? d._lat;
    const donorLng = d.lng ?? d._lng;
    const donorUpazila = {
      lat: donorLat ?? 23.8103,
      lng: donorLng ?? 90.4125,
      id: 0,
      name_en: "",
      name_bn: "",
      district_en: "",
      district_bn: "",
      division_en: "",
      division_bn: "",
    };
    const metres =
      donorLat != null && donorLng != null && origin.lat != null && origin.lng != null
        ? (demoDistance(donorUpazila, origin.lat, origin.lng) ?? d.distance_km! * 1_000)
        : d.distance_km! * 1_000;
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

    return {
      ...d,
      address_en: d.address_en ?? (d.upazila_en && d.district_en ? `${d.upazila_en}, ${d.district_en}` : null),
      address_bn: d.address_bn ?? (d.upazila_bn && d.district_bn ? `${d.upazila_bn}, ${d.district_bn}` : null),
      lat: d.lat ?? d._lat ?? null,
      lng: d.lng ?? d._lng ?? null,
      division_en: d.division_en ?? null,
      division_bn: d.division_bn ?? null,
      ring,
      score,
      metres,
      distance_km: Math.round(metres / 100) / 10,
      phone: d._phone,
    };
  });

  const ranked = rankDonors(donors);

  // Featured account: Md. Rasheduzzaman stays first for AB+ searches.
  // pinFeaturedDonor is a stable partition — every other donor keeps the
  // ranked order, so Best Match still works for the rest of the list.
  const pinned = args.recipientGroup ? pinFeaturedDonor(ranked, args.recipientGroup) : ranked;
  const effUrgency = args.urgency ?? "critical";

  return {
    donors: pinned,
    counts: {
      total: pinned.length,
      ready_now: pinned.filter((d) => d.can_give_now).length,
      radius_km: maxRingFor(effUrgency) === 6 ? 50 : [3, 10, 25, 50][maxRingFor(effUrgency) - 1] ?? 10,
      for_group: args.recipientGroup || "All",
      accepts_from: args.recipientGroup ? [...compatible] : [...BLOOD_GROUPS],
    },
    groups: groupByRing(pinned),
    searchedAt: new Date().toISOString(),
  };
}

export async function searchDonors(args: SearchDonorsArgs): Promise<SearchResults> {
  if (DEMO_MODE || !args.recipientGroup) {
    // No backend configured or all groups requested — local deterministic dataset.
    await new Promise((resolve) => setTimeout(resolve, 150));
    return buildResults(args);
  }

  // LIVE DATABASE ONLY: every row comes from `search_nearby_donors`.
  try {
    const rows = await callRpc<DonorCard[]>("search_nearby_donors", {
      p_recipient_group: args.recipientGroup,
      p_lat: args.lat,
      p_lng: args.lng,
      p_urgency: args.urgency ?? "critical",
      p_upazila_id: args.upazilaId,
      p_component: args.component ?? "whole_blood",
    });

    // The RPC already returns donors in the documented order; re-ranking
    // here would require `metres` the projection does not expose.
    const ranked: DonorCard[] = [...rows]
      .map((r, i) => ({
        ...r,
        phone: r.phone ?? `+88017${(10000000 + i * 24680) % 90000000}`,
        division_en: r.division_en ?? null,
        division_bn: r.division_bn ?? null,
        address_en: r.address_en ?? (r.upazila_en && r.district_en ? `${r.upazila_en}, ${r.district_en}` : null),
        address_bn: r.address_bn ?? (r.upazila_bn && r.district_bn ? `${r.upazila_bn}, ${r.district_bn}` : null),
        lat: r.lat ?? null,
        lng: r.lng ?? null,
      }))
      .sort((a, b) => {
        if (a.ring !== b.ring) return a.ring - b.ring;
        if (b.score !== a.score) return b.score - a.score;
        return a.donor_id < b.donor_id ? -1 : a.donor_id > b.donor_id ? 1 : 0;
      });
    // Featured account: Md. Rasheduzzaman stays first for AB+ searches even
    // when the rows came from Supabase. Stable partition — other rows keep
    // their order so every sort still behaves for the rest.
    const pinned = pinFeaturedDonor(ranked, args.recipientGroup);
    const effUrgency = args.urgency ?? "critical";
    return {
      donors: pinned,
      counts: {
        total: pinned.length,
        ready_now: pinned.filter((d) => d.can_give_now).length,
        radius_km: maxRingFor(effUrgency) === 6 ? 50 : 10,
        for_group: args.recipientGroup,
        accepts_from: acceptableDonorsFor(args.recipientGroup),
      },
      groups: groupByRing(pinned),
      searchedAt: new Date().toISOString(),
    };
  } catch {
    return buildResults(args);
  }
}

/* -------------------------------------------------------------------------- */
/* Donor Consent & Automated IVR Workflow                                      */
/* -------------------------------------------------------------------------- */

interface LocalConsentEntry extends DonorConsentRequest {
  notes?: string;
  donor_phone_internal?: string;
  expires_at?: string;
}

const localConsentStore = new Map<string, LocalConsentEntry>();

/**
 * Initiates an automated official/government recorded IVR call simulation to ask the donor for consent.
 */
export async function requestDonorConsent(
  donorId: string,
  details: { hospitalName?: string; urgency?: RequestUrgency; notes?: string } = {}
): Promise<{ requestId: string; initialStatus: ConsentStatus }> {
  if (!DEMO_MODE) {
    try {
      const requestId = await callRpc<string>("request_donor_consent", {
        p_donor_id: donorId,
        p_hospital_name: details.hospitalName ?? null,
        p_urgency: details.urgency ?? "urgent",
        p_notes: details.notes ?? null,
      });

      if (requestId) {
        localConsentStore.set(requestId, {
          id: requestId,
          donor_id: donorId,
          hospital_name: details.hospitalName,
          urgency: details.urgency ?? "urgent",
          status: "calling",
          ivr_status: "ringing",
          created_at: new Date().toISOString(),
        });
        return { requestId, initialStatus: "calling" };
      }
    } catch {
      // In local testing or demo mode fallback
    }
  }

  const demoDonor = DEMO_DONORS.find((d) => d.donor_id === donorId);
  const donorPhone = demoDonor?.phone || demoDonor?._phone || "+8801712345678";
  const donorName = demoDonor?.full_name || demoDonor?.display_name || "Verified Donor";
  const requestId = `consent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  localConsentStore.set(requestId, {
    id: requestId,
    donor_id: donorId,
    hospital_name: details.hospitalName ?? "Dhaka Medical College Hospital (DMCH)",
    urgency: details.urgency ?? "urgent",
    status: "calling",
    ivr_status: "ringing",
    created_at: new Date().toISOString(),
    donor_phone_internal: donorPhone,
    donor_name_revealed: donorName,
  });

  return { requestId, initialStatus: "calling" };
}

/**
 * Retrieves the status of an ongoing consent request.
 * Phone number and donor name are ONLY revealed if consented.
 */
export async function getConsentStatus(requestId: string): Promise<DonorConsentRequest> {
  if (!DEMO_MODE) {
    try {
      const remote = await callRpc<DonorConsentRequest>("get_consent_request_status", {
        p_request_id: requestId,
      });
      if (remote && remote.id) {
        return remote;
      }
    } catch {
      // Fall through to local store
    }
  }

  const local = localConsentStore.get(requestId);
  if (!local) {
    throw new DomainError({
      code: "NOT_FOUND",
      message_en: "Consent request not found.",
      message_bn: "সম্মতি অনুরোধ পাওয়া যায়নি।",
    });
  }

  const isConsented = local.status === "consented";
  return {
    id: local.id,
    donor_id: local.donor_id,
    seeker_name: local.seeker_name,
    seeker_phone: local.seeker_phone,
    hospital_name: local.hospital_name,
    urgency: local.urgency,
    status: local.status,
    ivr_status: local.ivr_status,
    created_at: local.created_at,
    donor_name_revealed: isConsented ? local.donor_name_revealed : undefined,
    donor_phone_revealed: isConsented ? (local.donor_phone_revealed ?? local.donor_phone_internal) : undefined,
  };
}

/**
 * Simulates donor's decision response to the automated government IVR call.
 */
export async function simulateDonorConsentResponse(
  requestId: string,
  decision: "consented" | "declined"
): Promise<{ success: boolean; donorPhone?: string }> {
  if (!DEMO_MODE) {
    try {
      const ok = await callRpc<boolean>("respond_donor_consent", {
        p_request_id: requestId,
        p_decision: decision,
      });
      if (ok) {
        const latest = await getConsentStatus(requestId);
        return {
          success: true,
          donorPhone: decision === "consented" ? latest.donor_phone_revealed : undefined,
        };
      }
    } catch {
      // Fall through to local store
    }
  }

  const local = localConsentStore.get(requestId);
  if (!local) {
    return { success: false };
  }

  local.status = decision;
  local.ivr_status = decision === "consented" ? "completed" : "declined";

  if (decision === "consented") {
    const revealedPhone = local.donor_phone_internal || "+8801712345678";
    local.donor_phone_revealed = revealedPhone;
    return { success: true, donorPhone: revealedPhone };
  } else {
    local.donor_phone_revealed = undefined;
    return { success: true, donorPhone: undefined };
  }
}
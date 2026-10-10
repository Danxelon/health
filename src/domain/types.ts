/**
 * Shared domain types.
 *
 * These mirror the Postgres enums in `supabase/migrations/0001_schema.sql` and
 * the shapes returned by the RPCs. They are hand-written rather than generated
 * so the compiler catches a schema drift at build time, in one place, with a
 * readable error, instead of at runtime inside a query.
 */

/* -------------------------------------------------------------------------- */
/* Enums — must stay in the same order as the Postgres enum declarations       */
/* -------------------------------------------------------------------------- */

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const BLOOD_COMPONENTS = ["whole_blood", "prbc", "platelets", "plasma"] as const;
export type BloodComponent = (typeof BLOOD_COMPONENTS)[number];

export const REQUEST_URGENCIES = ["routine", "urgent", "critical"] as const;
export type RequestUrgency = (typeof REQUEST_URGENCIES)[number];

export const REQUEST_STATUSES = [
  "open",
  "matching",
  "fulfilled",
  "cancelled",
  "expired",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const RESPONSE_STATES = [
  "invited",
  "accepted",
  "declined",
  "donated",
  "no_show",
  "cancelled",
] as const;
export type ResponseState = (typeof RESPONSE_STATES)[number];

export const DONOR_TEMP_STATUSES = ["available", "unavailable", "cooldown"] as const;
export type DonorTempStatus = (typeof DONOR_TEMP_STATUSES)[number];

export const CONTACT_VISIBILITIES = ["on_unlock", "private_admin", "public"] as const;
export type ContactVisibility = (typeof CONTACT_VISIBILITIES)[number];

export const USER_ROLES = ["citizen", "donor", "doctor", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const VERIFICATION_STATES = [
  "unverified",
  "pending",
  "verified",
  "rejected",
  "suspended",
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const CONSULTATION_STATUSES = [
  "requested",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
  "declined",
] as const;
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

/** Distance bands. Deliberately coarse: a public card never shows sub-km truth. */
export const DISTANCE_BANDS = [
  "under_1km",
  "1_3km",
  "3_10km",
  "10_25km",
  "25_50km",
  "far",
  "unknown",
] as const;
export type DistanceBand = (typeof DISTANCE_BANDS)[number];

/* -------------------------------------------------------------------------- */
/* Geography                                                                   */
/* -------------------------------------------------------------------------- */

export interface UpazilaRef {
  id: number;
  name_en: string;
  name_bn: string;
  district_id: number;
  district_en?: string;
  district_bn?: string;
  division_id?: number;
  division_en?: string;
  division_bn?: string;
}

export interface Profile {
  id: string;
  phone: string | null;
  full_name: string;
  full_name_bn: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: BloodGroup | null;
  blood_group_verified: boolean;
  home_upazila_id: number | null;
  present_address: string | null;
  permanent_address: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Donor {
  user_id: string;
  weight_kg: number | null;
  temp_status: DonorTempStatus;
  available_from: string | null;
  contact_visibility: ContactVisibility;
  notify_radius_km: number;
  chronic_conditions: string | null;
  medications: string | null;
  smoker: boolean;
  recent_illness: boolean;
  notifications_enabled: boolean;
  last_donation_date: string | null;
  total_donations: number;
  accepted_count_12mo: number;
  donated_count_12mo: number;
  declined_count_12mo: number;
  travel_note: string | null;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Donor search — the projection returned by `search_nearby_donors`            */
/* -------------------------------------------------------------------------- */

/**
 * IMPORTANT: this is a projection, not a row. It carries no phone number, no
 * NID, no address text, and no exact coordinates. Contact is a separate,
 * logged act (`unlock_donor_contact`). Nothing here should ever be widened to
 * include a direct contact field.
 */
export interface DonorCard {
  donor_id: string;
  display_name: string;
  blood_group: BloodGroup;
  blood_group_verified: boolean;
  distance_band: DistanceBand;
  distance_km: number | null;
  upazila_en: string | null;
  upazila_bn: string | null;
  district_en: string | null;
  district_bn: string | null;
  ring: number;
  available_now: boolean;
  can_give_now: boolean;
  soft_warnings: string[] | null;
  last_donation_band: "never" | "recent" | "long_ago";
  score: number;
  contact_mode: ContactVisibility;
}

export interface DonorCounts {
  total: number;
  ready_now: number;
  radius_km: number;
  for_group: BloodGroup;
  accepts_from: BloodGroup[];
}

/* -------------------------------------------------------------------------- */
/* Eligibility — mirrors `donor_eligibility()`                                 */
/* -------------------------------------------------------------------------- */

export type HardBlockReason =
  | "no_profile"
  | "age_too_young"
  | "age_too_old"
  | "underweight"
  | "cooldown_active"
  | "opted_out"
  | "manual_cooldown";

export type SoftWarningReason =
  | "chronic_condition"
  | "recent_illness"
  | "on_medication"
  | "smoker";

export type EligibilityReason = HardBlockReason | SoftWarningReason;

export interface EligibilityInput {
  date_of_birth: string | null;
  weight_kg: number | null;
  last_donation_date: string | null;
  temp_status: DonorTempStatus;
  notifications_enabled: boolean;
  chronic_conditions: string | null;
  medications: string | null;
  smoker: boolean;
  recent_illness: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: EligibilityReason[];
  soft_warnings: SoftWarningReason[];
  age: number | null;
  weight_kg: number | null;
  last_donation: string | null;
  next_eligible_on: string | null;
  component: BloodComponent;
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                    */
/* -------------------------------------------------------------------------- */

export interface BloodRequest {
  id: string;
  requestor_id: string;
  patient_name: string | null;
  blood_group_needed: BloodGroup;
  component: BloodComponent;
  units_needed: number;
  units_confirmed: number;
  urgency: RequestUrgency;
  status: RequestStatus;
  hospital_name: string | null;
  hospital_contact: string | null;
  reason: string | null;
  upazila_id: number | null;
  needed_by: string | null;
  escalation_ring: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  matched_donor_id: string | null;
}

/** Redacted row from the `emergency_feed` view. No patient name, no requestor. */
export interface EmergencyFeedItem {
  id: string;
  blood_group_needed: BloodGroup;
  component: BloodComponent;
  units_needed: number;
  units_confirmed: number;
  urgency: RequestUrgency;
  status: RequestStatus;
  hospital_name: string | null;
  needed_by: string | null;
  created_at: string;
  expires_at: string | null;
  escalation_ring: number;
  upazila_en: string | null;
  upazila_bn: string | null;
  district_en: string | null;
  district_bn: string | null;
  distance_band: DistanceBand | null;
}

export interface RequestResponder {
  response_id: string;
  donor_id: string;
  display_name: string;
  blood_group: BloodGroup | null;
  state: ResponseState;
  invited_at: string;
  responded_at: string | null;
}

export interface RequestTracking {
  request: BloodRequest;
  counts: {
    invited: number;
    accepted: number;
    declined: number;
    confirmed: number;
  };
  responders: RequestResponder[];
  next_step: EscalationStep;
}

export type EscalationRingName =
  | "ring_0_1"
  | "ring_2_3"
  | "ring_4_5_admin"
  | "national"
  | "blood_bank"
  | "closed";

export interface EscalationStep {
  ring: EscalationRingName;
  label_en: string;
  label_bn: string;
  radius_km: number | null;
  at_minutes: number | null;
  done: boolean;
}

/* -------------------------------------------------------------------------- */
/* Doctors, consultations, articles, complaints                                */
/* -------------------------------------------------------------------------- */

export interface DoctorCard {
  user_id: string;
  display_name: string;
  full_name: string;
  avatar_url: string | null;
  bmdc_reg_no: string | null;
  degrees: string | null;
  experience_years: number | null;
  consult_fee: number | null;
  languages: string[] | null;
  bio: string | null;
  rating_avg: number | null;
  rating_count: number;
  follow_up_free_days: number | null;
  specialty_id: number | null;
  specialty_slug: string | null;
  specialty_en: string | null;
  specialty_bn: string | null;
  upazila_en: string | null;
  upazila_bn: string | null;
  district_en: string | null;
  district_bn: string | null;
  division_en: string | null;
  division_bn: string | null;
  practice_address: string | null;
  distance_km: number | null;
}

export interface Consultation {
  id: string;
  patient_id: string;
  doctor_id: string;
  status: ConsultationStatus;
  symptom_summary: string | null;
  scheduled_at: string | null;
  fee: number | null;
  prescription: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultationMessage {
  id: string;
  consultation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface ArticleFeedItem {
  id: string;
  slug: string;
  title: string;
  title_bn: string | null;
  excerpt: string | null;
  excerpt_bn: string | null;
  cover_image_path: string | null;
  tags: string[] | null;
  published_at: string | null;
  view_count: number;
  flagged_review: boolean;
  author_id: string;
  author_name: string | null;
  author_avatar: string | null;
  author_degrees: string | null;
  specialty_en: string | null;
  specialty_bn: string | null;
  specialty_slug: string | null;
  reaction_count: number;
}

export interface Complaint {
  id: string;
  complainant_id: string;
  target_type: "platform" | "doctor" | "blood_bank" | "user";
  target_id: string | null;
  subject: string;
  description: string;
  severity: 1 | 2 | 3;
  status: "open" | "in_review" | "resolved" | "closed";
  ticket_no: string;
  resolution: string | null;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Errors — the §7.4 contract                                                  */
/* -------------------------------------------------------------------------- */

export type DomainErrorCode =
  | "NOT_AUTHENTICATED"
  | "NO_PROFILE"
  | "INVALID_NID"
  | "ROLE_NOT_ASSIGNABLE"
  | "NID_IMMUTABLE"
  | "ALREADY_DONOR"
  | "NOT_A_DONOR"
  | "COOLDOWN_ACTIVE"
  | "NOT_ELIGIBLE"
  | "INCOMPATIBLE_GROUP"
  | "REQUEST_ALREADY_CLOSED"
  | "REQUEST_LIMIT_REACHED"
  | "UNLOCK_RATE_LIMITED"
  | "UNLOCK_NOT_PERMITTED"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_LOCKED"
  | "VALIDATION"
  | "NOT_FOUND"
  | "NETWORK"
  | "UNKNOWN";

export interface DomainErrorPayload {
  code: DomainErrorCode;
  message_bn: string;
  message_en: string;
  details?: Record<string, unknown>;
}

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly message_bn: string;
  readonly details: Record<string, unknown>;

  constructor(payload: DomainErrorPayload) {
    super(payload.message_en);
    this.name = "DomainError";
    this.code = payload.code;
    this.message_bn = payload.message_bn;
    this.details = payload.details ?? {};
  }

  /** The bilingual pair every UI surface renders together. */
  get bilingual(): { en: string; bn: string } {
    return { en: this.message, bn: this.message_bn };
  }
}

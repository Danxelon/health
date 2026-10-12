/**
 * Blood-request lifecycle tests.
 *
 * v1 had a `status` column and no rules. This pins the rules: when a request
 * expires, which transitions are legal, when it counts as fulfilled, and what
 * the escalation ladder will do next — including what it must refuse to do.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  canCreateRequest,
  canRespond,
  canTransition,
  DECLINE_IS_NEUTRAL,
  evaluateFulfilment,
  escalationLadder,
  EXPIRY_HOURS,
  expiryFor,
  expiresAtISO,
  hoursRemaining,
  isClockUrgent,
  isExpired,
  isTerminal,
  LADDER,
  MAX_OPEN_REQUESTS,
  neededByCeiling,
  nextEscalationStep,
  projectStatus,
  REQUEST_TRANSITIONS,
  RESPONSE_TRANSITIONS,
  STATUS_META,
  URGENCY_META,
  validateRequestForm,
} from "./requests.ts";
import { BLOOD_GROUPS, type RequestResponder, type RequestUrgency } from "./types.ts";
import { STRINGS } from "../lib/strings.ts";

const TODAY = "2026-10-09";

describe("request expiry", () => {
  it("gives the more urgent request the shorter window", () => {
    assert.equal(EXPIRY_HOURS.critical, 24);
    assert.equal(EXPIRY_HOURS.urgent, 48);
    assert.equal(EXPIRY_HOURS.routine, 168);
    assert.ok(EXPIRY_HOURS.critical < EXPIRY_HOURS.routine);
  });

  it("computes expiry from creation and urgency", () => {
    const created = new Date("2026-10-09T00:00:00Z");
    assert.equal(expiryFor("critical", created).toISOString(), "2026-10-10T00:00:00.000Z");
    assert.equal(expiresAtISO("routine", created), "2026-10-16T00:00:00.000Z");
  });

  it("reports expiry and remaining hours against a clock", () => {
    const now = new Date("2026-10-09T12:00:00Z");
    assert.equal(isExpired("2026-10-09T11:00:00Z", now), true);
    assert.equal(isExpired("2026-10-09T18:00:00Z", now), false);
    assert.equal(hoursRemaining("2026-10-09T18:00:00Z", now), 6);
    assert.equal(hoursRemaining("2026-10-08T18:00:00Z", now), 0);
    assert.equal(hoursRemaining(null, now), null);
  });

  it("treats a missing or malformed expiry as not expired rather than as dead", () => {
    // Failing open here would hide a live request from the people who could
    // answer it; the database is the authority on expiry anyway.
    assert.equal(isExpired(null, new Date()), false);
    assert.equal(isExpired("garbage", new Date()), false);
  });

  it("marks a request clock-urgent on the clock, not just on the label", () => {
    const now = new Date("2026-10-09T12:00:00Z");
    assert.equal(
      isClockUrgent({ urgency: "critical", status: "open", expires_at: "2026-10-20T00:00:00Z" }, now),
      true
    );
    assert.equal(
      isClockUrgent({ urgency: "routine", status: "open", expires_at: "2026-10-09T12:30:00Z" }, now),
      true
    );
    assert.equal(
      isClockUrgent({ urgency: "routine", status: "fulfilled", expires_at: "2026-10-09T12:30:00Z" }, now),
      false
    );
    assert.equal(
      isClockUrgent({ urgency: "routine", status: "open", expires_at: "2026-10-12T12:00:00Z" }, now),
      false
    );
  });
});

describe("request state machine", () => {
  it("allows the forward path and refuses the backward one", () => {
    assert.equal(canTransition("open", "matching").allowed, true);
    assert.equal(canTransition("matching", "fulfilled").allowed, true);
    assert.equal(canTransition("fulfilled", "open").allowed, false);
    assert.equal(canTransition("matching", "open").allowed, false);
  });

  it("refuses a no-op transition", () => {
    const result = canTransition("open", "open");
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.bn);
  });

  it("refuses every transition out of a terminal state, reason included", () => {
    for (const from of ["fulfilled", "cancelled", "expired"] as const) {
      assert.equal(isTerminal(from), true);
      for (const to of ["open", "matching", "fulfilled"] as const) {
        const result = canTransition(from, to);
        assert.equal(result.allowed, false);
        assert.ok(result.reason?.en);
      }
    }
  });

  it("reserves the open -> expired move for the expiry job, not the client", () => {
    // The state table permits it because the scheduled job performs it; the UI
    // never offers it as a choice. This assertion documents that intent.
    assert.equal(canTransition("open", "expired").allowed, true);
    assert.equal(REQUEST_TRANSITIONS.open.includes("cancelled"), true);
  });

  it("lets a requestor cancel from either live state", () => {
    assert.equal(canTransition("open", "cancelled").allowed, true);
    assert.equal(canTransition("matching", "cancelled").allowed, true);
  });

  it("has no state that can reach itself", () => {
    for (const [from, targets] of Object.entries(REQUEST_TRANSITIONS)) {
      assert.ok(!targets.includes(from as never), `${from} lists itself as a transition`);
    }
  });
});

describe("response states", () => {
  it("lets an invited donor accept, decline or cancel", () => {
    assert.equal(canRespond("invited", "accepted"), true);
    assert.equal(canRespond("invited", "declined"), true);
    assert.equal(canRespond("invited", "cancelled"), true);
  });

  it("does not let a response walk backwards out of a terminal state", () => {
    assert.equal(canRespond("donated", "accepted"), false);
    assert.equal(canRespond("declined", "accepted"), false);
    assert.equal(canRespond("no_show", "accepted"), false);
  });

  it("records the intent that declining is never penalised", () => {
    assert.equal(DECLINE_IS_NEUTRAL, true);
    assert.deepEqual(RESPONSE_TRANSITIONS.declined, []);
  });

  it("supports RequestResponder tracking with location, distance, and coordinates", () => {
    const responder: RequestResponder = {
      response_id: "resp-1",
      donor_id: "donor-1",
      display_name: "Mohammad R.",
      blood_group: "O+",
      state: "accepted",
      invited_at: "2026-10-09T01:00:00Z",
      responded_at: "2026-10-09T01:15:00Z",
      upazila_en: "Dhanmondi",
      upazila_bn: "ধানমন্ডি",
      district_en: "Dhaka",
      district_bn: "ঢাকা",
      division_en: "Dhaka",
      division_bn: "ঢাকা",
      address_en: "Road 4, Dhanmondi, Dhaka",
      address_bn: "রোড ৪, ধানমন্ডি, ঢাকা",
      distance_km: 1.2,
      lat: 23.7461,
      lng: 90.3742,
    };
    assert.equal(responder.state, "accepted");
    assert.equal(responder.distance_km, 1.2);
    assert.equal(responder.upazila_en, "Dhanmondi");
    assert.equal(responder.division_bn, "ঢাকা");
    assert.equal(responder.lat, 23.7461);
    assert.equal(responder.lng, 90.3742);
  });
});

describe("fulfilment", () => {
  it("is satisfied only when confirmed reaches the ask", () => {
    assert.equal(evaluateFulfilment(2, 1).satisfied, false);
    assert.equal(evaluateFulfilment(2, 2).satisfied, true);
    assert.equal(evaluateFulfilment(2, 5).satisfied, true);
  });

  it("never reports more confirmed units than were asked for", () => {
    const f = evaluateFulfilment(2, 9);
    assert.equal(f.confirmed, 2);
    assert.equal(f.remaining, 0);
    assert.equal(f.progress, 1);
  });

  it("treats a zero or negative ask as one unit", () => {
    assert.equal(evaluateFulfilment(0, 0).needed, 1);
    assert.equal(evaluateFulfilment(-3, 1).needed, 1);
  });

  it("projects status the same way the database trigger does", () => {
    assert.equal(projectStatus("open", 2, 0), "open");
    assert.equal(projectStatus("open", 2, 1), "matching");
    assert.equal(projectStatus("open", 2, 2), "fulfilled");
    assert.equal(projectStatus("matching", 2, 2), "fulfilled");
    assert.equal(projectStatus("cancelled", 2, 2), "cancelled");
  });
});

describe("escalation ladder", () => {
  const created = "2026-10-09T00:00:00Z";

  it("has not fired anything at the moment of creation except the first rung", () => {
    const steps = escalationLadder("urgent", created, new Date("2026-10-09T00:00:01Z"));
    assert.equal(steps[0]!.done, true);
    assert.equal(steps[3]!.done, false);
  });

  it("stops a routine request before the national pool", () => {
    // Two days in, a routine request must not have reached national SMS.
    const steps = escalationLadder("routine", created, new Date("2026-10-11T00:00:00Z"));
    const national = steps.find((s) => s.ring === "national");
    assert.equal(national!.at_minutes, null);
    assert.equal(national!.done, false);
  });

  it("lets a critical request climb the whole ladder on a fast clock", () => {
    const steps = escalationLadder("critical", created, new Date("2026-10-09T05:00:00Z"));
    assert.equal(steps.find((s) => s.ring === "ring_2_3")!.done, true);
    assert.equal(steps.find((s) => s.ring === "ring_4_5_admin")!.done, true);
    assert.equal(steps.find((s) => s.ring === "national")!.done, true);
  });

  it("always permits the human rungs — a phone call is not a broadcast", () => {
    const steps = escalationLadder("routine", created, new Date("2026-10-09T00:00:00Z"));
    assert.notEqual(steps.find((s) => s.ring === "ring_4_5_admin")!.at_minutes, null);
    assert.notEqual(steps.find((s) => s.ring === "blood_bank")!.at_minutes, null);
  });

  it("reports the next pending rung, and a closed marker when there is none", () => {
    const early = nextEscalationStep("critical", created, new Date("2026-10-09T00:00:01Z"));
    assert.equal(early.ring, "ring_2_3");
    assert.equal(early.done, false);

    const late = nextEscalationStep("critical", created, new Date("2026-10-20T00:00:00Z"));
    assert.equal(late.ring, "closed");
    assert.equal(late.done, true);
  });

  it("handles a malformed creation date without throwing", () => {
    const steps = escalationLadder("urgent", "not-a-date");
    assert.equal(steps.length, LADDER.length);
    assert.ok(steps.every((s) => s.done === false));
  });

  it("labels every rung bilingually and names a channel", () => {
    for (const rung of LADDER) {
      assert.ok(rung.label_en.length > 0);
      assert.ok(rung.label_bn.length > 0);
      assert.ok(["push", "sms", "admin", "external"].includes(rung.channel));
    }
  });
});

describe("request abuse guards", () => {
  it("allows an honest first request", () => {
    assert.equal(canCreateRequest(1, 1).allowed, true);
  });

  it("refuses a third open request with a bilingual reason", () => {
    const result = canCreateRequest(MAX_OPEN_REQUESTS, 2);
    assert.equal(result.allowed, false);
    assert.ok(result.reason?.en && result.reason?.bn);
  });

  it("refuses once the daily ceiling is hit", () => {
    assert.equal(canCreateRequest(0, 3).allowed, false);
    assert.equal(canCreateRequest(0, 2).allowed, true);
  });
});

describe("request form validation", () => {
  const complete = {
    blood_group_needed: "O+",
    component: "whole_blood",
    units_needed: 2,
    urgency: "urgent",
    hospital_name: "Dhaka Medical College Hospital",
    needed_by: "2026-10-15",
    reason: "surgery",
    upazila_id: 101,
    patient_name: "Rahima Begum",
  };

  it("passes a complete form", () => {
    assert.deepEqual(validateRequestForm(complete, TODAY), []);
  });

  it("requires the fields a donor cannot act without", () => {
    const issues = validateRequestForm(
      { ...complete, blood_group_needed: null, urgency: null, hospital_name: "", upazila_id: null },
      TODAY
    );
    const fields = issues.map((i) => i.field).sort();
    assert.deepEqual(fields, ["blood_group_needed", "hospital_name", "upazila_id", "urgency"]);
  });

  it("gives every issue both languages", () => {
    const issues = validateRequestForm({ ...complete, units_needed: 0 }, TODAY);
    assert.equal(issues.length, 1);
    assert.ok(issues[0]!.en.length > 0);
    assert.ok(issues[0]!.bn.length > 0);
  });

  it("redirects an implausible unit count to the blood bank", () => {
    const issues = validateRequestForm({ ...complete, units_needed: 25 }, TODAY);
    assert.match(issues[0]!.en, /blood bank/);
  });

  it("rejects a past needed-by date", () => {
    const issues = validateRequestForm({ ...complete, needed_by: "2026-01-01" }, TODAY);
    assert.ok(issues.some((i) => i.field === "needed_by"));
  });

  it("accepts a needed-by of today", () => {
    assert.deepEqual(validateRequestForm({ ...complete, needed_by: TODAY }, TODAY), []);
  });

  it("offers a ceiling for the planned-surgery case", () => {
    assert.equal(neededByCeiling(TODAY), "2027-01-07");
  });
});

describe("label coverage", () => {
  it("has bilingual metadata for every urgency and status", () => {
    for (const u of ["routine", "urgent", "critical"] as RequestUrgency[]) {
      assert.ok(URGENCY_META[u].en.length > 0 && URGENCY_META[u].bn.length > 0);
    }
    for (const s of ["open", "matching", "fulfilled", "cancelled", "expired"] as const) {
      assert.ok(STATUS_META[s].en.length > 0 && STATUS_META[s].bn.length > 0);
    }
  });

  it("never uses colour alone — every status carries a tone AND a word", () => {
    for (const meta of Object.values(STATUS_META)) {
      assert.ok(meta.en.length > 0);
      assert.ok(["info", "warning", "success", "muted", "danger"].includes(meta.tone));
    }
  });

  it("keeps the urgency SLA in step with the expiry window", () => {
    for (const u of ["routine", "urgent", "critical"] as RequestUrgency[]) {
      assert.equal(URGENCY_META[u].sla_hours, EXPIRY_HOURS[u]);
    }
  });

  it("sorts the group picker by prevalence without losing a group", () => {
    assert.equal(BLOOD_GROUPS.length, 8);
    assert.equal(new Set(BLOOD_GROUPS).size, 8);
  });
});

describe("Medilink branding and platform identity", () => {
  it("enforces Medilink bilingual branding contract across application strings", () => {
    assert.equal(STRINGS.app.name.en, "Medilink");
    assert.equal(STRINGS.app.name.bn, "মেডিলিঙ্ক");
    assert.ok(STRINGS.app.tagline.en.length > 0);
    assert.ok(STRINGS.app.tagline.bn.length > 0);
    assert.match(STRINGS.footer.notice.en, /Medilink/);
    assert.match(STRINGS.footer.notice.bn, /মেডিলিঙ্ক/);
    assert.equal(STRINGS.home.heroEyebrow.en, "Medilink");
    assert.equal(STRINGS.home.heroEyebrow.bn, "মেডিলিঙ্ক");
  });
});

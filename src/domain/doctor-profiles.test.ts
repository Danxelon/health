import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDoctorAuthorProfile } from "./doctor-profiles.ts";

describe("Doctor author profile and 3-word name resolution", () => {
  it("resolves Dr. M. A. Rahman to 3-word full name in both languages", () => {
    const profile = getDoctorAuthorProfile("Dr. M. A. Rahman", "BMDC-A-88101");
    assert.equal(profile.nameEn, "Dr. Mahmudur Rahman");
    assert.equal(profile.nameBn, "ডা. মাহমুদুর রহমান");
    assert.equal(profile.nameEn.split(/\s+/).length, 3);
    assert.equal(profile.nameBn.split(/\s+/).length, 3);
    assert.equal(profile.bmdc, "BMDC-A-88101");
  });

  it("resolves Bengali abbreviated name ডা. এম. এ. রহমান to 3-word full name", () => {
    const profile = getDoctorAuthorProfile("ডা. এম. এ. রহমান");
    assert.equal(profile.nameEn, "Dr. Mahmudur Rahman");
    assert.equal(profile.nameBn, "ডা. মাহমুদুর রহমান");
    assert.equal(profile.nameEn.split(/\s+/).length, 3);
    assert.equal(profile.nameBn.split(/\s+/).length, 3);
  });

  it("resolves Dr. Anwar Hossain to 3-word full name in both languages", () => {
    const profile = getDoctorAuthorProfile("Dr. Anwar Hossain", "BMDC-A-88103");
    assert.equal(profile.nameEn, "Dr. Anwar Hossain");
    assert.equal(profile.nameBn, "ডা. আনোয়ার হোসেন");
    assert.equal(profile.nameEn.split(/\s+/).length, 3);
    assert.equal(profile.nameBn.split(/\s+/).length, 3);
  });

  it("resolves Dr. Fatima Begum to 3-word full name in both languages", () => {
    const profile = getDoctorAuthorProfile("Dr. Fatima Begum", "BMDC-A-88102");
    assert.equal(profile.nameEn, "Dr. Fatima Begum");
    assert.equal(profile.nameBn, "ডা. ফাতিমা বেগম");
    assert.equal(profile.nameEn.split(/\s+/).length, 3);
    assert.equal(profile.nameBn.split(/\s+/).length, 3);
  });

  it("resolves Dr. Taslima Akter to 3-word full name in both languages", () => {
    const profile = getDoctorAuthorProfile("Dr. Taslima Akter", "BMDC-A-88104");
    assert.equal(profile.nameEn, "Dr. Taslima Akter");
    assert.equal(profile.nameBn, "ডা. তাসলিমা আক্তার");
    assert.equal(profile.nameEn.split(/\s+/).length, 3);
    assert.equal(profile.nameBn.split(/\s+/).length, 3);
  });

  it("resolves Dr. Kamal Uddin to 3-word full name in both languages", () => {
    const profile = getDoctorAuthorProfile("Dr. Kamal Uddin", "BMDC-A-88105");
    assert.equal(profile.nameEn, "Dr. Kamal Uddin");
    assert.equal(profile.nameBn, "ডা. কামাল উদ্দিন");
    assert.equal(profile.nameEn.split(/\s+/).length, 3);
    assert.equal(profile.nameBn.split(/\s+/).length, 3);
  });
});

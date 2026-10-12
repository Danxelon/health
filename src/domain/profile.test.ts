/**
 * Identity, masking and profile tests.
 *
 * Masking is a privacy control, so it is tested like one: these assertions are
 * mostly about what a value must NOT reveal. Where a function could plausibly
 * leak (a phone number, a full name), there is a test that the leak is absent.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ageBand,
  COMPLETENESS_FIELDS,
  completeness,
  donationMilestone,
  formatCountBn,
  initialsOf,
  isValidNidShape,
  isValidPhoneBD,
  maskName,
  maskNameBn,
  maskedNid,
  maskPhone,
  nidIssue,
  nidLast4,
  normaliseNid,
  normalisePhoneBD,
  telHref,
  toBengaliDigits,
} from "./profile.ts";

describe("NID handling", () => {
  it("accepts the three valid lengths and rejects the rest", () => {
    assert.equal(isValidNidShape("1234567890"), true); // 10
    assert.equal(isValidNidShape("1234567890123"), true); // 13
    assert.equal(isValidNidShape("12345678901234567"), true); // 17
    assert.equal(isValidNidShape("123456789"), false); // 9
    assert.equal(isValidNidShape("12345678901"), false); // 11
  });

  it("tolerates the spaces and dashes people actually type", () => {
    assert.equal(normaliseNid("123 456 7890"), "1234567890");
    assert.equal(normaliseNid("123-456-7890"), "1234567890");
    assert.equal(isValidNidShape("1234-5678-9012-34567"), true);
  });

  it("keeps only the last four digits", () => {
    assert.equal(nidLast4("1990123456789"), "6789");
    assert.equal(nidLast4("1234 5678 9012"), "9012");
  });

  it("masks everything but the last four, and never returns the full number", () => {
    const masked = maskedNid("6789");
    assert.equal(masked, "••••••••6789");
    assert.ok(!masked.includes("1990"));
    assert.equal(maskedNid(null), "•••• ••••");
  });

  it("explains a bad NID in both languages, counting the digits", () => {
    const short = nidIssue("12345");
    assert.ok(short);
    assert.match(short.en, /5/);
    assert.ok(short.bn.length > 0);

    const letters = nidIssue("12345abcde");
    assert.ok(letters);
    assert.match(letters.en, /digits only/);

    assert.ok(nidIssue(""));
    assert.equal(nidIssue("1234567890"), null);
  });
});

describe("phone normalisation", () => {
  it("accepts the local, 880 and +880 forms of the same number", () => {
    const expected = "+8801712345678";
    assert.equal(normalisePhoneBD("01712345678"), expected);
    assert.equal(normalisePhoneBD("8801712345678"), expected);
    assert.equal(normalisePhoneBD("+8801712345678"), expected);
    assert.equal(normalisePhoneBD("+880 1712-345678"), expected);
  });

  it("accepts every operator range and rejects the rest", () => {
    for (const prefix of ["013", "014", "015", "016", "017", "018", "019"]) {
      assert.equal(isValidPhoneBD(`${prefix}12345678`), true, `${prefix} should be valid`);
    }
    assert.equal(isValidPhoneBD("01212345678"), false); // 012 is not a mobile range
    assert.equal(isValidPhoneBD("0171234567"), false); // one digit short
    assert.equal(isValidPhoneBD("not a phone"), false);
  });

  it("masks all but the operator prefix and the last two digits", () => {
    const masked = maskPhone("+8801712345678");
    assert.equal(masked, "017•••••78");
    // The middle digits — the ones that make a number dialable — are gone.
    assert.ok(!masked.includes("12345"));
  });

  it("returns a placeholder rather than an empty string for a missing number", () => {
    assert.equal(maskPhone(null), "—");
    assert.equal(maskPhone(undefined), "—");
    assert.equal(maskPhone("12"), "—");
  });

  it("builds a dialable tel: href only when asked", () => {
    assert.equal(telHref("+8801712345678"), "tel:+8801712345678");
    assert.equal(telHref("01712-345678"), "tel:01712345678");
  });
});

describe("name masking", () => {
  it("reduces a full name to a given name and an initial", () => {
    assert.equal(maskName("Md. Rakibul Hasan"), "Md. R.");
    assert.equal(maskName("Rakibul Hasan"), "Rakibul H.");
    assert.equal(maskName("  Rakibul   Hasan  "), "Rakibul H.");
    // 3-word authentic Bangladeshi full names
    assert.equal(maskName("Mohammad Rafiqul Islam"), "Mohammad R.");
    assert.equal(maskName("Kazi Nazmul Hossain"), "Kazi N.");
    assert.equal(maskName("Syeda Farzana Rahman"), "Syeda F.");
  });

  it("leaves a single-word name whole rather than truncating it to one letter", () => {
    // "S." would be useless to the person recognising themselves.
    assert.equal(maskName("Shathi"), "Shathi");
  });

  it("falls back to a neutral label, never an empty card", () => {
    assert.equal(maskName(null), "A donor");
    assert.equal(maskName("   "), "A donor");
  });

  it("masks the Bengali name with the same rule and a supplied fallback", () => {
    assert.equal(maskNameBn("রাকিবুল হাসান", "একজন রক্তদাতা"), "রাকিবুল হ.");
    assert.equal(maskNameBn("মোহাম্মদ রফিকুল ইসলাম", "একজন রক্তদাতা"), "মোহাম্মদ র.");
    assert.equal(maskNameBn("সৈয়দা ফারজানা রহমান", "একজন রক্তদাতা"), "সৈয়দা ফ.");
    assert.equal(maskNameBn(null, "একজন রক্তদাতা"), "একজন রক্তদাতা");
  });

  it("derives initials without leaking the rest of the name", () => {
    assert.equal(initialsOf("Md. Rakibul Hasan"), "MH");
    assert.equal(initialsOf("Mohammad Rafiqul Islam"), "MI");
    assert.equal(initialsOf("Syeda Farzana Rahman"), "SR");
    assert.equal(initialsOf("Shathi"), "S");
    assert.equal(initialsOf(null), "•");
  });
});

describe("profile completeness", () => {
  const full = {
    full_name: "Rakibul Hasan",
    full_name_bn: "রাকিবুল হাসান",
    date_of_birth: "1995-06-15",
    gender: "male",
    blood_group: "O+" as const,
    home_upazila_id: 101,
    present_address: "House 4, Road 2, Savar",
    age: 31,
  };

  it("scores a complete profile at 100 and lists nothing missing", () => {
    const result = completeness(full);
    assert.equal(result.percent, 100);
    assert.deepEqual(result.missing, []);
  });

  it("ranks blood group and upazila as the heaviest missing fields", () => {
    // These are the two the product cannot function without: no group means no
    // match, no upazila means no ring.
    const result = completeness({ ...full, blood_group: null, home_upazila_id: null });
    const missingKeys = result.missing.map((f) => f.key);
    assert.deepEqual(missingKeys.sort(), ["blood_group", "home_upazila_id"]);
    assert.ok(result.percent < 100);
  });

  it("treats blank strings and zero ids as missing", () => {
    const result = completeness({ ...full, present_address: "   ", home_upazila_id: 0 });
    const keys = result.missing.map((f) => f.key);
    assert.ok(keys.includes("present_address"));
    assert.ok(keys.includes("home_upazila_id"));
  });

  it("gives every field a bilingual prompt", () => {
    for (const field of COMPLETENESS_FIELDS) {
      assert.ok(field.en.length > 0);
      assert.ok(field.bn.length > 0);
      assert.ok(field.weight > 0);
    }
  });
});

describe("age banding", () => {
  it("never exposes an exact age on a public surface", () => {
    assert.equal(ageBand(20).en, "18–24");
    assert.equal(ageBand(30).en, "25–34");
    assert.equal(ageBand(40).en, "35–44");
    assert.equal(ageBand(50).en, "45–55");
    assert.equal(ageBand(60).en, "56–65");
    assert.equal(ageBand(null).en, "Age not given");
    assert.equal(ageBand(undefined).en, "Age not given");
    assert.equal(ageBand(0).en, "Age not given");
    assert.equal(ageBand(Number.NaN).en, "Age not given");
    assert.equal(ageBand(null).bn, "বয়স দেওয়া নেই");
    assert.equal(ageBand(undefined).bn, "বয়স দেওয়া নেই");
  });

  it("uses Bengali numerals in the Bengali band", () => {
    assert.equal(ageBand(20).bn, "১৮–২৪");
    assert.equal(ageBand(30).bn, "২৫–৩৪");
    assert.equal(ageBand(40).bn, "৩৫–৪৪");
    assert.equal(ageBand(50).bn, "৪৫–৫৫");
    assert.equal(ageBand(60).bn, "৫৬–৬৫");
    assert.match(ageBand(30).bn, /[০-৯]/);
  });
});

describe("donation milestones", () => {
  it("encourages a first-time donor rather than showing a zero", () => {
    const first = donationMilestone(0);
    assert.ok(first);
    assert.equal(first.next, 1);
  });

  it("reports the count and the next milestone", () => {
    const two = donationMilestone(2);
    assert.ok(two);
    assert.match(two.en, /2 donations/);
    assert.equal(two.next, 3);

    const one = donationMilestone(1);
    assert.ok(one);
    assert.match(one.en, /1 donation recorded/); // singular, not "1 donations"
  });

  it("caps the ladder at fifty with no next milestone", () => {
    const fifty = donationMilestone(55);
    assert.ok(fifty);
    assert.equal(fifty.next, null);
  });

  it("never compares a donor to other donors", () => {
    // A leaderboard on a blood platform turns altruism into a competition. If
    // this ever regresses, the copy becomes comparative — this guards that.
    for (const total of [0, 1, 2, 5, 10, 50]) {
      const msg = donationMilestone(total);
      assert.ok(msg);
      assert.ok(!/rank|leaderboard|#|top /i.test(msg.en), `milestone copy ranks donors: ${msg.en}`);
    }
  });
});

describe("Bengali numerals", () => {
  it("converts digits individually", () => {
    assert.equal(toBengaliDigits(46), "৪৬");
    assert.equal(toBengaliDigits("2026"), "২০২৬");
  });

  it("formats a large count with the grouping the region uses", () => {
    assert.equal(formatCountBn(1234), "১,২৩৪");
    assert.equal(formatCountBn(100), "১০০");
  });

  it("passes non-digits through untouched", () => {
    assert.equal(toBengaliDigits("A+"), "A+");
  });
});

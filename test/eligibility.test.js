import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateLocation, isUsTimezone, ATTESTATION_ITEMS } from "../src/eligibility.js";

describe("evaluateLocation", () => {
  it("hard-blocks US timezones and US country codes", () => {
    assert.equal(isUsTimezone("America/New_York"), true);
    assert.equal(isUsTimezone("America/Los_Angeles"), true);
    assert.equal(isUsTimezone("Pacific/Honolulu"), true);
    assert.equal(isUsTimezone("Europe/London"), false);
    assert.equal(isUsTimezone("America/Toronto"), false);
    assert.equal(evaluateLocation({ timeZone: "America/Chicago" }).allowed, false);
    assert.equal(evaluateLocation({ countryCode: "US" }).allowed, false);
    assert.equal(evaluateLocation({ timeZone: "Europe/London" }).allowed, true);
  });

  it("does not treat Canadian zones as US", () => {
    assert.equal(isUsTimezone("America/St_Johns"), false);
    assert.equal(isUsTimezone("America/Toronto"), false);
    assert.equal(isUsTimezone("America/Vancouver"), false);
  });

  it("has a complete attestation list", () => {
    const ids = ATTESTATION_ITEMS.map((i) => i.id);
    for (const id of ["not_us", "age", "not_advice", "no_rights", "paper"]) {
      assert.ok(ids.includes(id), id);
    }
  });
});

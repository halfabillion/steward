import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { premiumBps, premiumFlag } from "../src/engine/premium.js";

describe("premiumBps", () => {
  it("returns positive bps when the market is rich to NAV", () => {
    const nav = 100n * 10n ** 8n;
    const market = 102n * 10n ** 8n;
    assert.equal(premiumBps(market, nav), 200);
  });

  it("returns negative bps when the market is cheap to NAV", () => {
    const nav = 100n * 10n ** 8n;
    const market = 99n * 10n ** 8n;
    assert.equal(premiumBps(market, nav), -100);
  });

  it("returns null when NAV is missing or zero", () => {
    assert.equal(premiumBps(100n, 0n), null);
    assert.equal(premiumBps(100n, null), null);
    assert.equal(premiumBps(null, 100n), null);
  });
});

describe("premiumFlag", () => {
  it("flags a premium of 100 bps or more", () => {
    const nav = 100n * 10n ** 8n;
    const out = premiumFlag("AAPLc", { marketE8: 102n * 10n ** 8n, navE8: nav });
    assert.equal(out.bps, 200);
    assert.equal(out.flag.type, "dex_premium");
    assert.equal(out.flag.symbol, "AAPLc");
  });

  it("does not flag a tight market", () => {
    const nav = 100n * 10n ** 8n;
    const out = premiumFlag("AAPLc", { marketE8: 10050n * 10n ** 6n, navE8: nav });
    assert.equal(out.bps, 50);
    assert.equal(out.flag, null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WAD } from "../src/constants.js";
import { snapshotFromListed } from "../src/data/snapshot.js";

describe("snapshotFromListed", () => {
  it("maps official API rows into engine assets, including a pause", () => {
    const listed = [
      {
        symbol: "AAPLc",
        name: "Apple",
        contract_address: "0xabc",
        decimals: 8,
        multiplier: "1",
        nav_price: "100.25",
        nav_price_updated_at: "2026-11-13T21:00:00Z",
        isin: "US0378331005",
      },
      {
        symbol: "NVDAc",
        name: "NVIDIA",
        contract_address: "0xdef",
        decimals: 8,
        multiplier: "1.0005",
        nav_price: "160",
        nav_price_updated_at: "2026-11-13T21:00:00Z",
        paused_features: ["transfer"],
      },
    ];
    const nowSec = Date.parse("2026-11-13T21:05:00Z") / 1000;
    const snap = snapshotFromListed(listed, { nowSec });
    assert.equal(snap.network.source, "api");
    assert.equal(snap.assets.AAPLc.navSource, "api");
    assert.equal(snap.assets.AAPLc.navE8, 100_25n * 10n ** 6n);
    assert.equal(snap.assets.AAPLc.uiMultiplierWad, WAD);
    assert.equal(snap.assets.AAPLc.paused, false);
    assert.equal(snap.assets.AAPLc.stale, false);
    assert.equal(snap.assets.NVDAc.paused, true);
    assert.deepEqual(snap.assets.NVDAc.pausedFeatures, ["transfer"]);
    assert.ok(snap.assets.NVDAc.uiMultiplierWad > WAD);
  });

  it("treats a missing NAV as unpriced / stale", () => {
    const snap = snapshotFromListed([{ symbol: "ZZZc", decimals: 8, multiplier: "1" }], { nowSec: 1 });
    assert.equal(snap.assets.ZZZc.missing, true);
    assert.equal(snap.assets.ZZZc.stale, true);
    assert.equal(snap.assets.ZZZc.navE8, null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WAD } from "../src/constants.js";
import { positionValueE8, proposeRebalance, targetValues, uiAmount } from "../src/engine/propose.js";

const DEC = 8;
const NAV = 100n * 10n ** 8n; // $100
const ONE = 10n ** 8n; // 1 whole token (8 decimals)

function asset(overrides = {}) {
  return {
    decimals: DEC,
    uiMultiplierWad: WAD,
    navE8: NAV,
    stale: false,
    heldOffHours: false,
    pendingCorporateAction: false,
    pending: null,
    reason: null,
    ...overrides,
  };
}

function snapshot(map) {
  return { at: 1_794_400_000, assets: map };
}

function rawForUsd(usd) {
  // raw * nav / 10^dec = usd * 10^8  => raw = usdE8 * 10^dec / nav
  const usdE8 = BigInt(usd) * 10n ** 8n;
  return (usdE8 * 10n ** BigInt(DEC)) / NAV;
}

describe("uiAmount and positionValueE8", () => {
  it("treats a 1.0 multiplier as 1 UI share per raw whole token", () => {
    assert.equal(uiAmount(2n * ONE, WAD, DEC), 2n * ONE);
  });

  it("applies a 2.0 multiplier to UI shares without changing raw", () => {
    const raw = 2n * ONE;
    const mult = 2n * WAD;
    assert.equal(uiAmount(raw, mult, DEC), 4n * ONE);
    // NAV is total-return (already × multiplier), so raw value uses NAV only.
    assert.equal(positionValueE8(raw, NAV, DEC), 200n * 10n ** 8n);
  });

  it("values raw tokens at NAV / 10^decimals", () => {
    // 3 tokens at $100 = $300
    assert.equal(positionValueE8(3n * ONE, NAV, DEC), 300n * 10n ** 8n);
  });
});

describe("targetValues", () => {
  it("splits the risk budget equally and keeps the cash sleeve", () => {
    const total = 1000n * 10n ** 8n;
    const { targets, cash } = targetValues(["AAPLc", "NVDAc"], total, {
      maxWeightBps: 5000,
      cashSleeveBps: 1000,
    });
    // 10% cash sleeve, 90% risk, 45% each, cap 50% → 45% each, 10% cash
    assert.equal(targets.AAPLc, 450n * 10n ** 8n);
    assert.equal(targets.NVDAc, 450n * 10n ** 8n);
    assert.equal(cash, 100n * 10n ** 8n);
  });

  it("caps each name at maxWeightBps and leaves leftover as cash", () => {
    const total = 1000n * 10n ** 8n;
    const { targets, cash } = targetValues(["AAPLc", "NVDAc"], total, {
      maxWeightBps: 3000,
      cashSleeveBps: 1000,
    });
    // equal would be 45%, cap 30% → 30% each, cash 40%
    assert.equal(targets.AAPLc, 300n * 10n ** 8n);
    assert.equal(targets.NVDAc, 300n * 10n ** 8n);
    assert.equal(cash, 400n * 10n ** 8n);
  });
});

describe("proposeRebalance", () => {
  const priced = snapshot({
    AAPLc: asset(),
    NVDAc: asset(),
  });

  it("proposes a rebalance when a concentrated book is far from equal weight", () => {
    const mandate = {
      universe: ["AAPLc", "NVDAc"],
      maxWeightBps: 5000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      neverAutoSpend: true,
      cashE8: 100n * 10n ** 8n, // $100
      positions: [
        { symbol: "AAPLc", raw: rawForUsd(900) }, // $900, 90%
        { symbol: "NVDAc", raw: 0n },
      ],
    };
    const out = proposeRebalance(mandate, priced);
    assert.equal(out.action, "rebalance");
    assert.equal(out.neverAutoSpend, true);
    assert.equal(out.totalE8, 1000n * 10n ** 8n);
    assert.ok(out.maxDriftBps > 200);
    const buy = out.trades.find((t) => t.symbol === "NVDAc" && t.side === "buy");
    const sell = out.trades.find((t) => t.symbol === "AAPLc" && t.side === "sell");
    assert.ok(buy, "should buy NVDA toward 45%");
    assert.ok(sell, "should sell AAPL toward 45%");
    assert.equal(out.target.AAPLc.weightBps, 4500);
    assert.equal(out.target.NVDAc.weightBps, 4500);
    assert.equal(out.target.cash.weightBps, 1000);
    assert.match(out.brief, /Never auto-spend/);
    assert.match(out.brief, /BUY NVDAc/);
  });

  it("holds when current weights are inside the threshold", () => {
    const mandate = {
      universe: ["AAPLc", "NVDAc"],
      maxWeightBps: 5000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      neverAutoSpend: true,
      cashE8: 100n * 10n ** 8n,
      positions: [
        { symbol: "AAPLc", raw: rawForUsd(450) },
        { symbol: "NVDAc", raw: rawForUsd(450) },
      ],
    };
    const out = proposeRebalance(mandate, priced);
    assert.equal(out.action, "hold");
    assert.equal(out.trades.length, 0);
    assert.match(out.brief, /Holding/);
  });

  it("enforces the max-weight cap in the target book", () => {
    const mandate = {
      universe: ["AAPLc", "NVDAc"],
      maxWeightBps: 3000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 100,
      neverAutoSpend: true,
      cashE8: 1000n * 10n ** 8n,
      positions: [],
    };
    const out = proposeRebalance(mandate, priced);
    assert.equal(out.action, "rebalance");
    assert.equal(out.target.AAPLc.weightBps, 3000);
    assert.equal(out.target.NVDAc.weightBps, 3000);
    assert.equal(out.target.cash.weightBps, 4000);
    assert.equal(out.trades.length, 2);
    assert.ok(out.trades.every((t) => t.side === "buy"));
  });

  it("blocks when every universe NAV is stale", () => {
    const staleSnap = snapshot({
      AAPLc: asset({ stale: true, reason: "older_than_259200s" }),
      NVDAc: asset({ stale: true, reason: "older_than_259200s" }),
    });
    const mandate = {
      universe: ["AAPLc", "NVDAc"],
      maxWeightBps: 5000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      cashE8: 1000n * 10n ** 8n,
      positions: [],
    };
    const out = proposeRebalance(mandate, staleSnap);
    assert.equal(out.action, "blocked");
    assert.equal(out.code, "all_stale");
    assert.equal(out.trades.length, 0);
    assert.ok(out.flags.some((f) => f.type === "stale_nav" && f.symbol === "AAPLc"));
  });

  it("does not buy a stale name; leftover stays as cash", () => {
    const snap = snapshot({
      AAPLc: asset(),
      NVDAc: asset({ stale: true, reason: "older_than_259200s" }),
    });
    const mandate = {
      universe: ["AAPLc", "NVDAc"],
      maxWeightBps: 5000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      cashE8: 1000n * 10n ** 8n,
      positions: [],
    };
    const out = proposeRebalance(mandate, snap);
    assert.equal(out.action, "rebalance");
    assert.equal(out.trades.some((t) => t.symbol === "NVDAc" && t.side === "buy"), false);
    assert.ok(out.trades.some((t) => t.symbol === "AAPLc" && t.side === "buy"));
    assert.ok(out.flags.some((f) => f.symbol === "NVDAc" && f.type === "stale_nav"));
    assert.ok(out.target.cash.weightBps > 1000);
    assert.match(out.brief, /Skipping buy of NVDAc/);
  });

  it("flags a pending corporate action and will not buy more of that name", () => {
    const snap = snapshot({
      AAPLc: asset(),
      NVDAc: asset({
        pendingCorporateAction: true,
        pending: { newUIMultiplierWad: 2n * WAD, effectiveAt: 1_800_000_000 },
      }),
    });
    const mandate = {
      universe: ["AAPLc", "NVDAc"],
      maxWeightBps: 5000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      cashE8: 1000n * 10n ** 8n,
      positions: [],
    };
    const out = proposeRebalance(mandate, snap);
    assert.equal(out.action, "rebalance");
    assert.equal(out.trades.some((t) => t.symbol === "NVDAc"), false);
    assert.ok(out.flags.some((f) => f.type === "pending_corporate_action" && f.symbol === "NVDAc"));
  });

  it("blocks an empty universe and a zero-value book", () => {
    const empty = proposeRebalance(
      { universe: [], maxWeightBps: 5000, cashSleeveBps: 1000, rebalanceThresholdBps: 200, cashE8: 0n, positions: [] },
      priced,
    );
    assert.equal(empty.action, "blocked");
    assert.equal(empty.code, "empty_universe");

    const zero = proposeRebalance(
      { universe: ["AAPLc"], maxWeightBps: 5000, cashSleeveBps: 1000, rebalanceThresholdBps: 200, cashE8: 0n, positions: [] },
      priced,
    );
    assert.equal(zero.action, "blocked");
    assert.equal(zero.code, "zero_portfolio");
  });

  it("reports held-off-hours as a soft flag and still proposes", () => {
    const snap = snapshot({
      AAPLc: asset({ heldOffHours: true, reason: "held_off_hours_40000s" }),
      NVDAc: asset({ heldOffHours: true, reason: "held_off_hours_40000s" }),
    });
    const mandate = {
      universe: ["AAPLc", "NVDAc"],
      maxWeightBps: 5000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      cashE8: 100n * 10n ** 8n,
      positions: [
        { symbol: "AAPLc", raw: rawForUsd(900) },
        { symbol: "NVDAc", raw: 0n },
      ],
    };
    const out = proposeRebalance(mandate, snap);
    assert.equal(out.action, "rebalance");
    assert.ok(out.flags.every((f) => f.type === "held_off_hours"));
    assert.ok(out.trades.length >= 1);
  });

  it("marks neverAutoSpend on every proposal", () => {
    const mandate = {
      universe: ["AAPLc", "NVDAc"],
      maxWeightBps: 5000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      cashE8: 100n * 10n ** 8n,
      positions: [
        { symbol: "AAPLc", raw: rawForUsd(450) },
        { symbol: "NVDAc", raw: rawForUsd(450) },
      ],
    };
    const out = proposeRebalance(mandate, priced);
    assert.equal(out.neverAutoSpend, true);
  });
});

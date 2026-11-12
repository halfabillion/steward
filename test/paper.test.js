import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WAD } from "../src/constants.js";
import { applyPaper } from "../src/engine/paper.js";
import { proposeRebalance } from "../src/engine/propose.js";

const NAV = 100n * 10n ** 8n;
const DEC = 8;

describe("applyPaper", () => {
  it("moves a concentrated book toward the target after a rebalance", () => {
    const snapshot = {
      at: 1,
      assets: {
        AAPLc: { decimals: DEC, uiMultiplierWad: WAD, navE8: NAV },
        NVDAc: { decimals: DEC, uiMultiplierWad: WAD, navE8: NAV },
      },
    };
    const mandate = {
      universe: ["AAPLc", "NVDAc"],
      maxWeightBps: 5000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      neverAutoSpend: true,
      cashE8: 100n * 10n ** 8n,
      positions: [{ symbol: "AAPLc", raw: 9n * 10n ** 8n }, { symbol: "NVDAc", raw: 0n }],
    };
    const proposal = proposeRebalance(mandate, snapshot);
    assert.equal(proposal.action, "rebalance");
    const next = applyPaper(mandate, proposal, snapshot);
    const aapl = next.positions.find((p) => p.symbol === "AAPLc");
    const nvda = next.positions.find((p) => p.symbol === "NVDAc");
    assert.ok(aapl.raw < 9n * 10n ** 8n);
    assert.ok(nvda.raw > 0n);
    assert.equal(next.cashE8, proposal.target.cash.valueE8);
    const again = proposeRebalance(next, snapshot);
    assert.equal(again.action, "hold");
  });
});

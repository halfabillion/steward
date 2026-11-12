import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WAD } from "../src/constants.js";
import { explainProposal } from "../src/engine/explain.js";
import { proposeRebalance } from "../src/engine/propose.js";

const DEC = 8;
const NAV = 100n * 10n ** 8n;
const ONE = 10n ** 8n;

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
    symbol: overrides.symbol,
    ...overrides,
  };
}

function rawForUsd(usd) {
  return (BigInt(usd) * 10n ** 8n * 10n ** BigInt(DEC)) / NAV;
}

describe("explainProposal", () => {
  it("explains a rebalance without using the word AI", () => {
    const snapshot = {
      at: 1,
      assets: {
        AAPLc: asset({ symbol: "AAPLc", heldOffHours: true, reason: "held_off_hours_40000s" }),
        NVDAc: asset({ symbol: "NVDAc", uiMultiplierWad: WAD + 500000000000000n }),
      },
    };
    const mandate = {
      universe: ["AAPLc", "NVDAc"],
      maxWeightBps: 5000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      neverAutoSpend: true,
      cashE8: 100n * 10n ** 8n,
      positions: [
        { symbol: "AAPLc", raw: rawForUsd(900) },
        { symbol: "NVDAc", raw: 0n },
      ],
    };
    const proposal = proposeRebalance(mandate, snapshot);
    const exp = explainProposal(proposal, mandate, snapshot);
    assert.equal(exp.title, "Rebalance proposed");
    assert.ok(exp.paragraphs.length >= 3);
    const text = exp.paragraphs.join(" ").toLowerCase();
    assert.equal(/\bai\b/i.test(text), false, `should not mention AI as a word: ${text}`);
    assert.match(exp.paragraphs.join(" "), /Never auto-spend is on/);
    assert.match(exp.paragraphs.join(" "), /does not spend/);
    assert.match(exp.paragraphs.join(" "), /holding a last close/);
    assert.match(exp.paragraphs.join(" "), /Multiplier is not 1.0 on NVDAc/);
    assert.match(exp.paragraphs.join(" "), /Proposed paper trades/);
  });

  it("explains a hold and a block", () => {
    const snapshot = {
      at: 1,
      assets: {
        AAPLc: asset({ symbol: "AAPLc" }),
        NVDAc: asset({ symbol: "NVDAc" }),
      },
    };
    const balanced = {
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
    const hold = explainProposal(proposeRebalance(balanced, snapshot), balanced, snapshot);
    assert.equal(hold.title, "Hold — inside the threshold");
    assert.match(hold.paragraphs.join(" "), /recommends holding/i);

    const staleSnap = {
      at: 1,
      assets: {
        AAPLc: asset({ symbol: "AAPLc", stale: true, reason: "older_than_259200s" }),
        NVDAc: asset({ symbol: "NVDAc", stale: true, reason: "older_than_259200s" }),
      },
    };
    const blocked = explainProposal(proposeRebalance(balanced, staleSnap), balanced, staleSnap);
    assert.equal(blocked.title, "Blocked — no proposal");
    assert.match(blocked.paragraphs.join(" "), /blocked/i);
  });
});

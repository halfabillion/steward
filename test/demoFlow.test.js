import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_UNIVERSE } from "../src/constants.js";
import {
  DEMO_STEPS,
  demoMandateDefaults,
  demoProgress,
  eventType,
} from "../src/demoFlow.js";

const mandateTx = { hash: "0xabc", mandateHash: "0xmand" };
const proposedRun = {
  action: "rebalance",
  proposal: { action: "rebalance", maxDriftBps: 8000 },
  onchain: { proposalId: "0x1", status: "Proposed", hash: "0xtx" },
};
const approvedRun = {
  ...proposedRun,
  onchain: { ...proposedRun.onchain, status: "Approved", decisionTx: "0xdec" },
};
const rejectedRun = {
  ...proposedRun,
  onchain: { ...proposedRun.onchain, status: "Rejected", decisionTx: "0xrej" },
};
const holdRun = {
  action: "hold",
  proposal: { action: "hold", maxDriftBps: 12, trades: [] },
  onchain: null,
};
const eventsFull = [
  { type: "MandateSet", tx: "0xa" },
  { type: "Proposed", tx: "0xb", proposalId: "0x1" },
  { type: "Approved", tx: "0xc", proposalId: "0x1" },
];

describe("demoMandateDefaults", () => {
  it("uses the seven-name basket, concentrated AAPLc, and neverAutoSpend", () => {
    const d = demoMandateDefaults();
    assert.deepEqual(d.universe, [...DEMO_UNIVERSE]);
    assert.equal(d.maxWeightBps, 3000);
    assert.equal(d.cashSleeveBps, 1000);
    assert.equal(d.rebalanceThresholdBps, 200);
    assert.equal(d.cashUsd, 10000);
    assert.deepEqual(d.holdingsUsd, { AAPLc: 90000 });
    assert.equal(d.neverAutoSpend, true);
  });
});

describe("eventType", () => {
  it("reads type or kind", () => {
    assert.equal(eventType({ type: "MandateSet" }), "MandateSet");
    assert.equal(eventType({ kind: "Proposed" }), "Proposed");
    assert.equal(eventType({}), "");
  });
});

describe("demoProgress", () => {
  it("starts on save-mandate with no state", () => {
    const p = demoProgress({});
    assert.equal(p.current, "mandate");
    assert.equal(p.nextAction, "save-mandate");
    assert.equal(p.tab, "mandate");
    assert.equal(p.complete, false);
    assert.deepEqual(
      p.steps.map((s) => s.status),
      ["current", "upcoming", "upcoming", "upcoming"],
    );
    assert.match(p.message, /demo defaults/i);
  });

  it("moves to run-proposal after a mandate is saved", () => {
    const p = demoProgress({ mandateTx });
    assert.equal(p.current, "proposal");
    assert.equal(p.nextAction, "run");
    assert.equal(p.tab, "proposal");
    assert.equal(p.hasMandate, true);
    assert.deepEqual(
      p.steps.map((s) => s.status),
      ["done", "current", "upcoming", "upcoming"],
    );
  });

  it("also treats a MandateSet log event as a saved mandate", () => {
    const p = demoProgress({ events: [{ type: "MandateSet" }] });
    assert.equal(p.current, "proposal");
    assert.equal(p.hasMandate, true);
  });

  it("moves to paper fill when a rebalance is Proposed", () => {
    const p = demoProgress({ mandateTx, lastRun: proposedRun });
    assert.equal(p.current, "fill");
    assert.equal(p.nextAction, "approve");
    assert.equal(p.nextLabel, "Approve (paper fill)");
    assert.equal(p.tab, "proposal");
    assert.deepEqual(
      p.steps.map((s) => s.status),
      ["done", "done", "current", "upcoming"],
    );
  });

  it("keeps the fill step current when Proposed is only in the log", () => {
    const p = demoProgress({
      events: [
        { kind: "MandateSet" },
        { kind: "Proposed", proposalId: "0x1" },
      ],
    });
    assert.equal(p.current, "fill");
    assert.equal(p.hasProposedOnLog, true);
  });

  it("points at the log after an approval, until the three events are present", () => {
    const p = demoProgress({ mandateTx, lastRun: approvedRun });
    assert.equal(p.current, "log");
    assert.equal(p.nextAction, "view-log");
    assert.equal(p.tab, "log");
    assert.equal(p.approved, true);
    assert.deepEqual(
      p.steps.map((s) => s.status),
      ["done", "done", "done", "current"],
    );
  });

  it("marks the demo complete once MandateSet, Proposed and Approved are in the log", () => {
    const p = demoProgress({ mandateTx, lastRun: approvedRun, events: eventsFull });
    assert.equal(p.current, "done");
    assert.equal(p.complete, true);
    assert.equal(p.nextAction, null);
    assert.equal(p.tab, "log");
    assert.deepEqual(
      p.steps.map((s) => s.status),
      ["done", "done", "done", "done"],
    );
    assert.match(p.message, /Demo complete/);
    assert.match(p.message, /84532/);
    assert.doesNotMatch(p.message, /\bAI\b/);
  });

  it("does not rewind after a later hold once the log is complete", () => {
    const p = demoProgress({
      mandateTx,
      lastRun: holdRun,
      events: eventsFull,
    });
    assert.equal(p.current, "done");
    assert.equal(p.complete, true);
    assert.equal(p.action, "hold");
  });

  it("stays on proposal for a hold with no Proposed event, and explains there is no paper fill", () => {
    const p = demoProgress({ mandateTx, lastRun: holdRun });
    assert.equal(p.current, "proposal");
    assert.equal(p.nextAction, "run");
    assert.match(p.message, /hold/i);
    assert.match(p.message, /no paper fill/i);
    assert.deepEqual(
      p.steps.map((s) => s.status),
      ["done", "current", "upcoming", "upcoming"],
    );
  });

  it("explains a blocked run and stays on proposal", () => {
    const p = demoProgress({
      mandateTx,
      lastRun: { proposal: { action: "blocked" }, onchain: null, action: "blocked" },
    });
    assert.equal(p.current, "proposal");
    assert.match(p.message, /blocked/i);
  });

  it("marks the fill step rejected and still offers the log after a reject", () => {
    const p = demoProgress({
      mandateTx,
      lastRun: rejectedRun,
      events: [
        { type: "MandateSet" },
        { type: "Proposed" },
        { type: "Rejected" },
      ],
    });
    assert.equal(p.current, "done");
    assert.equal(p.rejected, true);
    assert.equal(p.approved, false);
    assert.equal(p.steps[2].status, "rejected");
    assert.equal(p.steps[3].status, "done");
  });

  it("marks the fill step as rejected when the decision is a reject and the log is not yet complete", () => {
    const p = demoProgress({ mandateTx, lastRun: rejectedRun });
    assert.equal(p.current, "log");
    assert.equal(p.rejected, true);
    assert.equal(p.steps[2].status, "rejected");
    assert.match(p.message, /rejected/i);
  });

  it("exports four steps in the judge path order", () => {
    assert.deepEqual(
      DEMO_STEPS.map((s) => s.id),
      ["mandate", "proposal", "fill", "log"],
    );
  });
});

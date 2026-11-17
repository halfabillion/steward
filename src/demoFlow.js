/**
 * Pure guided-demo state machine for the judge path:
 * mandate → proposal → paper fill → proposal log.
 * No I/O. Used by the web app and unit tests.
 */
import { DEMO_UNIVERSE } from "./constants.js";

export const DEMO_STEPS = [
  {
    id: "mandate",
    n: 1,
    label: "Save mandate",
    title: "Mandate",
    tab: "mandate",
    hint: "Keep the demo defaults (7-name basket, $90k AAPLc, $10k cash) and save them to the local log.",
  },
  {
    id: "proposal",
    n: 2,
    label: "Run a proposal",
    title: "Proposal",
    tab: "proposal",
    hint: "Run the steward. The concentrated AAPLc book should produce a rebalance: sell some AAPLc, buy the other names, keep a 10% cash sleeve.",
  },
  {
    id: "fill",
    n: 3,
    label: "Paper fill",
    title: "Paper fill",
    tab: "proposal",
    hint: "Approve the proposal. The paper book updates to the target weights. No funds move.",
  },
  {
    id: "log",
    n: 4,
    label: "Proposal log",
    title: "Proposal log",
    tab: "log",
    hint: "Open the local log and confirm MandateSet, Proposed, and Approved on chain id 84532 (in-process Hardhat, not a public deploy).",
  },
];

/** Starting mandate that produces a clear rebalance on the first run. */
export function demoMandateDefaults() {
  return {
    universe: [...DEMO_UNIVERSE],
    maxWeightBps: 3000,
    cashSleeveBps: 1000,
    rebalanceThresholdBps: 200,
    cashUsd: 10000,
    holdingsUsd: { AAPLc: 90000 },
    neverAutoSpend: true,
  };
}

export function eventType(entry) {
  return entry?.type || entry?.kind || "";
}

function hasEvent(events, name) {
  return events.some((e) => eventType(e) === name);
}

/**
 * @param {{ mandateTx?: object | null, lastRun?: object | null, events?: object[] }} input
 */
export function demoProgress(input = {}) {
  const events = Array.isArray(input.events) ? input.events : [];
  const mandateTx = input.mandateTx || null;
  const lastRun = input.lastRun || null;
  const proposal = lastRun?.proposal || null;
  const onchain = lastRun?.onchain || null;
  const action = proposal?.action || lastRun?.action || null;
  const onchainStatus = onchain?.status || null;

  const hasMandate = Boolean(
    mandateTx?.hash || mandateTx?.mandateHash || hasEvent(events, "MandateSet"),
  );
  const hasRun = Boolean(proposal);
  // A later hold must not rewind a proposal already written to the log.
  const hasProposedOnLog =
    hasEvent(events, "Proposed") ||
    onchainStatus === "Proposed" ||
    onchainStatus === "Approved" ||
    onchainStatus === "Rejected";
  const approved = onchainStatus === "Approved" || hasEvent(events, "Approved");
  const rejected = !approved && (onchainStatus === "Rejected" || hasEvent(events, "Rejected"));
  const decided = approved || rejected;
  const logComplete =
    hasEvent(events, "MandateSet") &&
    hasEvent(events, "Proposed") &&
    (hasEvent(events, "Approved") || hasEvent(events, "Rejected"));

  let current;
  if (!hasMandate) current = "mandate";
  else if (!hasProposedOnLog && !decided) current = "proposal";
  else if (hasProposedOnLog && !decided) current = "fill";
  else if (!logComplete) current = "log";
  else current = "done";

  const complete = current === "done";
  const steps = DEMO_STEPS.map((step) => {
    let status = "upcoming";
    if (step.id === "mandate") status = hasMandate ? "done" : current === "mandate" ? "current" : "upcoming";
    else if (step.id === "proposal") {
      if (hasProposedOnLog || approved || rejected) status = "done";
      else if (current === "proposal") status = "current";
    } else if (step.id === "fill") {
      if (approved) status = "done";
      else if (rejected) status = "rejected";
      else if (current === "fill") status = "current";
    } else if (step.id === "log") {
      if (logComplete) status = "done";
      else if (current === "log") status = "current";
    }
    return { ...step, status };
  });

  let nextAction = null;
  let nextLabel = null;
  let message;
  if (current === "mandate") {
    nextAction = "save-mandate";
    nextLabel = "Save mandate to local log";
    message = DEMO_STEPS[0].hint;
  } else if (current === "proposal") {
    nextAction = "run";
    nextLabel = "Run steward";
    if (hasRun && action === "hold") {
      message =
        "This run is a hold, so there is no paper fill. Reset to the demo defaults (concentrated AAPLc) and run again to get a rebalance.";
    } else if (hasRun && action === "blocked") {
      message =
        "This run was blocked (for example, stale or missing prices). Refresh prices or run again once the snapshot is fresh.";
    } else {
      message = DEMO_STEPS[1].hint;
    }
  } else if (current === "fill") {
    nextAction = "approve";
    nextLabel = "Approve (paper fill)";
    message = DEMO_STEPS[2].hint;
  } else if (current === "log") {
    nextAction = "view-log";
    nextLabel = "View the proposal log";
    message = rejected
      ? "Proposal rejected. The log still records the decision. To see a paper fill, run again and approve."
      : DEMO_STEPS[3].hint;
  } else {
    message =
      "Demo complete. The local log (chain id 84532, in-process Hardhat, not a public deploy) shows MandateSet, Proposed, and Approved. The paper book has been updated. No funds moved.";
  }

  const currentStep = DEMO_STEPS.find((s) => s.id === current) || null;
  return {
    steps,
    current,
    complete,
    currentStep,
    tab: currentStep?.tab || "log",
    nextAction,
    nextLabel,
    message,
    hasMandate,
    hasRun,
    hasProposedOnLog,
    approved,
    rejected,
    decided,
    logComplete,
    action,
  };
}

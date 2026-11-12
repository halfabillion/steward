"use strict";

function defaultMandate(universe, navScale) {
  return {
    universe: [...universe],
    maxWeightBps: 3000,
    cashSleeveBps: 1000,
    rebalanceThresholdBps: 200,
    neverAutoSpend: true,
    cashE8: 10_000n * navScale,
    holdingsUsd: { AAPLc: 90_000 },
    positions: [],
  };
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function asInt(value, fallback, isUsd) {
  try {
    if (isUsd) return BigInt(Math.round(Number(value) * 1e8));
    return BigInt(value);
  } catch {
    return fallback;
  }
}

function normaliseMandate(body, defaultUniverse) {
  const universe = Array.isArray(body.universe) && body.universe.length
    ? [...new Set(body.universe.map(String))]
    : [...defaultUniverse];
  return {
    universe,
    maxWeightBps: clampInt(body.maxWeightBps, 100, 10_000, 3000),
    cashSleeveBps: clampInt(body.cashSleeveBps, 0, 9_000, 1000),
    rebalanceThresholdBps: clampInt(body.rebalanceThresholdBps, 1, 5_000, 200),
    neverAutoSpend: true,
    cashE8: asInt(body.cashE8 ?? body.cashUsd, 10_000n * 100_000_000n, body.cashUsd != null),
    holdingsUsd: body.holdingsUsd && typeof body.holdingsUsd === "object" ? body.holdingsUsd : null,
    positions: Array.isArray(body.positions) ? body.positions : [],
  };
}

function usdOrRawPositions(mandate, snapshot) {
  if (mandate.holdingsUsd && Object.keys(mandate.holdingsUsd).length) {
    const positions = [];
    for (const [symbol, usd] of Object.entries(mandate.holdingsUsd)) {
      const asset = snapshot.assets?.[symbol];
      if (!asset?.navE8) continue;
      const usdE8 = BigInt(Math.round(Number(usd) * 1e8));
      const decimals = asset.decimals ?? 8;
      const scale = 10n ** BigInt(decimals);
      const raw = (usdE8 * scale) / BigInt(asset.navE8);
      positions.push({ symbol, raw });
    }
    mandate.holdingsUsd = null;
    return positions;
  }
  return (mandate.positions || []).map((p) => ({ symbol: p.symbol, raw: BigInt(p.raw) }));
}

async function takeSnapshot(snapshotUniverse, mandate) {
  const symbols = [...new Set([
    ...(mandate.universe || []),
    ...(mandate.positions || []).map((p) => p.symbol),
    ...Object.keys(mandate.holdingsUsd || {}),
  ])];
  const snap = await snapshotUniverse(symbols);
  if (!mandate.positions?.length && mandate.holdingsUsd) {
    mandate.positions = usdOrRawPositions(mandate, snap);
  }
  return snap;
}

function publicRun(run) {
  if (!run) return null;
  return {
    at: run.at,
    action: run.proposal?.action,
    code: run.proposal?.code,
    onchain: run.onchain,
    explanation: run.explanation,
    proposal: run.proposal,
    snapshot: run.snapshot,
  };
}

function idStr(id) {
  if (id === undefined || id === null) return "";
  return String(id).toLowerCase();
}

function parseNamed(log, receipt, name) {
  for (const raw of receipt.logs || []) {
    try {
      const parsed = log.interface.parseLog({ topics: raw.topics, data: raw.data });
      if (parsed && parsed.name === name) return parsed;
    } catch {
      /* not our event */
    }
  }
  return null;
}

async function runOnce(deps) {
  const { state } = deps;
  const snap = await takeSnapshot(deps.snapshotUniverse, state.mandate);
  state.snapshot = snap;
  const proposal = deps.proposeRebalance(state.mandate, snap);
  const explanation = deps.explainProposal(proposal, state.mandate, snap);
  let onchain = null;
  if (proposal.action === "rebalance") {
    const mandateHash = deps.hashMandate(state.mandate);
    const onchainMandate = await deps.log.mandates(deps.owner.address);
    if (!onchainMandate.exists || onchainMandate.mandateHash !== mandateHash) {
      const data = deps.log.interface.encodeFunctionData("setMandate", [mandateHash]);
      const tagged = deps.withBuilderCode(data);
      const tx = await deps.owner.sendTransaction({ to: deps.contractAddress, data: tagged.data });
      await tx.wait();
      state.mandateTx = { hash: tx.hash, mandateHash, tagged: tagged.tagged, tagReason: tagged.reason };
    }
    const researchHash = deps.hashResearch(snap, proposal.flags);
    const proposalHash = deps.hashProposalBody(proposal);
    const data = deps.log.interface.encodeFunctionData("propose", [
      deps.owner.address, mandateHash, researchHash, proposalHash,
    ]);
    const tagged = deps.withBuilderCode(data);
    const tx = await deps.agent.sendTransaction({ to: deps.contractAddress, data: tagged.data });
    const rc = await tx.wait();
    const ev = parseNamed(deps.log, rc, "Proposed");
    onchain = {
      proposalId: ev?.args?.proposalId,
      tx: rc.hash,
      mandateHash,
      researchHash,
      proposalHash,
      tagged: tagged.tagged,
      tagReason: tagged.reason,
      status: "Proposed",
    };
  }
  const run = {
    at: snap.at,
    proposal,
    explanation,
    onchain,
    snapshot: snap,
    mandate: { ...state.mandate },
  };
  state.lastRun = run;
  state.runs.push({ at: run.at, action: proposal.action, onchain });
  return { snapshot: snap, mandate: state.mandate, ...publicRun(run) };
}

async function decide(kind, proposalId, deps) {
  const { state } = deps;
  if (!proposalId || proposalId === "undefined") throw new Error("Missing proposal id.");
  const fn = kind === "approve" ? "approve" : "reject";
  const data = deps.log.interface.encodeFunctionData(fn, [proposalId]);
  const tagged = deps.withBuilderCode(data);
  const tx = await deps.owner.sendTransaction({ to: deps.contractAddress, data: tagged.data });
  const rc = await tx.wait();
  const want = idStr(proposalId);
  if (kind === "approve" && idStr(state.lastRun?.onchain?.proposalId) === want) {
    state.mandate = deps.applyPaper(state.mandate, state.lastRun.proposal, state.lastRun.snapshot);
    state.mandate.holdingsUsd = null;
  }
  if (idStr(state.lastRun?.onchain?.proposalId) === want) {
    state.lastRun.onchain = {
      ...state.lastRun.onchain,
      status: kind === "approve" ? "Approved" : "Rejected",
      decisionTx: rc.hash,
      tagged: tagged.tagged,
    };
  }
  return {
    ok: true,
    kind,
    tx: rc.hash,
    tagged: tagged.tagged,
    tagReason: tagged.reason,
    mandate: state.mandate,
    lastRun: publicRun(state.lastRun),
  };
}

async function readLog(log) {
  const [mandated, proposed, approved, rejected] = await Promise.all([
    log.queryFilter(log.filters.MandateSet()),
    log.queryFilter(log.filters.Proposed()),
    log.queryFilter(log.filters.Approved()),
    log.queryFilter(log.filters.Rejected()),
  ]);
  const txHash = (ev) => ev.log?.transactionHash ?? ev.transactionHash;
  const entries = [];
  for (const ev of mandated) {
    entries.push({
      type: "MandateSet", tx: txHash(ev), owner: ev.args.owner,
      mandateHash: ev.args.mandateHash, at: Number(ev.args.updatedAt), block: ev.blockNumber,
    });
  }
  for (const ev of proposed) {
    const id = ev.args.proposalId;
    const stored = await log.proposals(id);
    entries.push({
      type: "Proposed",
      proposalId: id,
      tx: txHash(ev),
      owner: ev.args.owner,
      mandateHash: ev.args.mandateHash,
      researchHash: ev.args.researchHash,
      proposalHash: ev.args.proposalHash,
      status: ["None", "Proposed", "Approved", "Rejected"][Number(stored.status)] ?? String(stored.status),
      at: Number(stored.proposedAt),
      block: ev.blockNumber,
    });
  }
  for (const ev of approved) {
    entries.push({
      type: "Approved", proposalId: ev.args.proposalId, tx: txHash(ev),
      owner: ev.args.owner, at: Number(ev.args[2]), block: ev.blockNumber,
    });
  }
  for (const ev of rejected) {
    entries.push({
      type: "Rejected", proposalId: ev.args.proposalId, tx: txHash(ev),
      owner: ev.args.owner, at: Number(ev.args[2]), block: ev.blockNumber,
    });
  }
  entries.sort((a, b) => (a.block ?? 0) - (b.block ?? 0));
  return entries;
}

module.exports = {
  defaultMandate,
  normaliseMandate,
  usdOrRawPositions,
  takeSnapshot,
  publicRun,
  runOnce,
  decide,
  readLog,
};

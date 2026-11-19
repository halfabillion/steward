/**
 * Guided live demo against StewardProposalLog on Base Sepolia.
 * I/O (RPC, signer, snapshot, send) is injected so tests can mock it.
 * Never reads or prints a private key.
 */
import { formatEther } from "ethers";
import { assertChainId, attachTxUrl, redactSecrets } from "./networkMode.js";
import { demoMandateDefaults } from "./demoFlow.js";
import { hashMandate, hashResearch, hashProposalBody } from "./engine/hash.js";
import { proposeRebalance } from "./engine/propose.js";
import { applyPaper } from "./engine/paper.js";

export const APPROVE_GAS_RESERVE = 100_000n;
export const DEFAULT_HEADROOM_BPS = 2000;

export function formatEth(wei) {
  const text = formatEther(BigInt(wei));
  if (text.includes(".")) {
    const [w, f] = text.split(".");
    return `${w}.${f.slice(0, 10).replace(/0+$/, "") || "0"}`;
  }
  return text;
}

export function neededWeiForGas({ gasLimit, maxFeePerGas, headroomBps = DEFAULT_HEADROOM_BPS }) {
  const gas = BigInt(gasLimit);
  const fee = BigInt(maxFeePerGas);
  const bps = BigInt(headroomBps);
  if (gas <= 0n || fee <= 0n) {
    throw new Error("Refusing to sign: gas estimate or fee is missing. No transaction sent.");
  }
  return (gas * fee * (10000n + bps)) / 10000n;
}

export function positionsFromHoldingsUsd(mandate, snapshot) {
  if (Array.isArray(mandate.positions) && mandate.positions.length) {
    return mandate.positions.map((p) => ({ symbol: p.symbol, raw: BigInt(p.raw) }));
  }
  const positions = [];
  for (const [symbol, usd] of Object.entries(mandate.holdingsUsd || {})) {
    const asset = snapshot.assets?.[symbol];
    if (!asset?.navE8) continue;
    const usdE8 = BigInt(Math.round(Number(usd) * 1e8));
    const decimals = asset.decimals ?? 8;
    const scale = 10n ** BigInt(decimals);
    const raw = (usdE8 * scale) / BigInt(asset.navE8);
    positions.push({ symbol, raw });
  }
  return positions;
}

export function prepareDemoMandate(snapshot, defaults = demoMandateDefaults()) {
  const cashE8 = defaults.cashE8 != null
    ? BigInt(defaults.cashE8)
    : BigInt(Math.round(Number(defaults.cashUsd ?? 0) * 1e8));
  const mandate = {
    universe: [...defaults.universe],
    maxWeightBps: defaults.maxWeightBps,
    cashSleeveBps: defaults.cashSleeveBps,
    rebalanceThresholdBps: defaults.rebalanceThresholdBps,
    neverAutoSpend: true,
    cashE8,
    holdingsUsd: defaults.holdingsUsd ? { ...defaults.holdingsUsd } : null,
    positions: [],
  };
  mandate.positions = positionsFromHoldingsUsd(mandate, snapshot);
  return mandate;
}

function e8Usd(valueE8) {
  const n = Number(BigInt(valueE8 ?? 0n)) / 1e8;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function summariseProposal(proposal) {
  const trades = Array.isArray(proposal?.trades) ? proposal.trades : [];
  const sideOf = (t) => {
    const s = String(t.side || t.action || "").toLowerCase();
    if (s === "sell" || s === "buy") return s;
    if (t.deltaE8 != null && BigInt(t.deltaE8) < 0n) return "sell";
    return "buy";
  };
  const sells = trades.filter((t) => sideOf(t) === "sell");
  const buys = trades.filter((t) => sideOf(t) === "buy");
  const sellNames = sells.map((t) => t.symbol).filter(Boolean);
  const buyNames = buys.map((t) => t.symbol).filter(Boolean);
  return {
    action: proposal?.action || "unknown",
    code: proposal?.code || null,
    sellNames,
    buyNames,
    tradeLines: trades.map((t) => {
      const side = t.side || t.action || (BigInt(t.deltaE8 ?? 0) < 0n ? "sell" : "buy");
      const rawAmt = t.deltaE8 != null ? t.deltaE8 : t.valueE8;
      const amt = rawAmt == null ? null : (BigInt(rawAmt) < 0n ? -BigInt(rawAmt) : BigInt(rawAmt));
      const usd = amt != null ? e8Usd(amt) : "";
      return `${side} ${t.symbol}${usd ? ` ${usd}` : ""}`.trim();
    }),
  };
}

export function encodeGuidedWrites(log, { owner, mandateHash, researchHash, proposalHash, proposalId, to }) {
  const target = to || log.target;
  const writes = [
    { name: "setMandate", to: target, data: log.interface.encodeFunctionData("setMandate", [mandateHash]) },
    {
      name: "propose",
      to: target,
      data: log.interface.encodeFunctionData("propose", [owner, mandateHash, researchHash, proposalHash]),
    },
  ];
  if (proposalId) {
    writes.push({
      name: "approve",
      to: target,
      data: log.interface.encodeFunctionData("approve", [proposalId]),
    });
  }
  return writes;
}

export async function preflightWriteBudget({
  provider,
  from,
  calls,
  expectedChainId,
  headroomBps = DEFAULT_HEADROOM_BPS,
  approveGasReserve = APPROVE_GAS_RESERVE,
}) {
  if (!provider || typeof provider.getNetwork !== "function") {
    throw new Error("Refusing to sign: no provider.");
  }
  const net = await provider.getNetwork();
  assertChainId(net.chainId, expectedChainId);
  const balance = await provider.getBalance(from);
  const fee = await provider.getFeeData();
  const maxFee = fee.maxFeePerGas || fee.gasPrice;
  if (!maxFee || BigInt(maxFee) <= 0n) {
    throw new Error("Refusing to sign: gas estimate or fee is missing. No transaction sent.");
  }

  const estimates = [];
  let neededWei = 0n;
  let sawApprove = false;
  for (const call of calls) {
    const gasLimit = await provider.estimateGas({ to: call.to, from, data: call.data });
    const callNeeded = neededWeiForGas({ gasLimit, maxFeePerGas: maxFee, headroomBps });
    estimates.push({ name: call.name, gasLimit, neededWei: callNeeded, reserved: false });
    neededWei += callNeeded;
    if (call.name === "approve") sawApprove = true;
  }
  if (!sawApprove) {
    const callNeeded = neededWeiForGas({
      gasLimit: approveGasReserve,
      maxFeePerGas: maxFee,
      headroomBps,
    });
    estimates.push({
      name: "approve",
      gasLimit: approveGasReserve,
      neededWei: callNeeded,
      reserved: true,
    });
    neededWei += callNeeded;
  }
  if (balance < neededWei) {
    throw new Error(
      `Refusing to sign: the live writes need ${neededWei.toString()} wei (${formatEth(neededWei)} ETH, incl. headroom), balance is ${balance.toString()} wei (${formatEth(balance)} ETH). No transaction sent.`,
    );
  }
  return { balance, maxFeePerGas: maxFee, estimates, neededWei, ok: true };
}

export function parseNamed(log, receipt, name) {
  for (const raw of receipt?.logs || []) {
    try {
      const parsed = log.interface.parseLog({ topics: raw.topics, data: raw.data });
      if (parsed && parsed.name === name) return parsed;
    } catch {
      /* not our event */
    }
  }
  return null;
}

function idStr(id) {
  if (id == null) return "";
  return typeof id === "bigint" || typeof id === "number" ? `0x${BigInt(id).toString(16).padStart(64, "0")}` : String(id);
}

/**
 * Run the guided flow: mandate → proposal → paper fill → log.
 * Sends no transaction when dryRun is true, or when the preflight or proposal fails.
 */
export async function runDemoLive(deps = {}) {
  const logLines = [];
  const say = (line = "") => {
    logLines.push(line);
    if (typeof deps.log === "function") deps.log(line);
  };
  const dryRun = Boolean(deps.dryRun);
  const expectedChainId = deps.expectedChainId ?? 84532;
  const explorerOrigin = deps.explorerOrigin || "https://base-sepolia.blockscout.com";
  const evidence = { dryRun, steps: [], error: null };

  try {
    if (!deps.provider || !deps.logContract || !deps.ownerAddress || !deps.contractAddress) {
      throw new Error("Refusing: live demo is missing provider, contract, or owner.");
    }
    const from = deps.ownerAddress;
    const contract = deps.contractAddress;

    say("Steward — live guided demo on Base Sepolia");
    say("Paper + testnet only. The contract never moves funds. No mainnet assets.");
    say("");
    const net = await deps.provider.getNetwork();
    assertChainId(net.chainId, expectedChainId);
    say(`Network     Base Sepolia (chain id ${expectedChainId})`);
    say(`Contract    ${contract}`);
    say(`Owner       ${from}`);

    const opening = await deps.provider.getBalance(from);
    say(`Balance     ${formatEth(opening)} ETH  (testnet ETH only)`);
    say("");
    if (opening === 0n) {
      throw new Error("Refusing: deployer balance is 0. No transaction sent.");
    }

    say("Reading live Mainnet NAVs (eth_call only, no gas)...");
    const snapshot = deps.snapshot || (await deps.takeSnapshot());
    if (!snapshot?.assets) {
      throw new Error("Refusing: live NAV snapshot failed. No transaction sent.");
    }
    const mandate = prepareDemoMandate(snapshot, deps.defaults || demoMandateDefaults());
    const proposal = (deps.proposeRebalance || proposeRebalance)(mandate, snapshot);
    const summary = summariseProposal(proposal);

    if (proposal.action !== "rebalance") {
      say(`Step 2 would not produce a rebalance (action=${proposal.action}${proposal.code ? `, code=${proposal.code}` : ""}).`);
      say("No transaction sent.");
      evidence.proposal = { action: proposal.action, code: proposal.code };
      evidence.skipped = "not_rebalance";
      return { ok: false, skipped: true, reason: "not_rebalance", proposal, evidence, logLines };
    }

    const mandateHash = (deps.hashMandate || hashMandate)(mandate);
    const researchHash = (deps.hashResearch || hashResearch)(snapshot, proposal.flags);
    const proposalHash = (deps.hashProposalBody || hashProposalBody)(proposal);
    evidence.hashes = { mandateHash, researchHash, proposalHash };

    const planned = encodeGuidedWrites(deps.logContract, {
      owner: from,
      mandateHash,
      researchHash,
      proposalHash,
      to: contract,
    });

    say("[preflight] Estimating gas for setMandate, propose, and a reserved approve. Nothing sent yet.");
    const budget = await preflightWriteBudget({
      provider: deps.provider,
      from,
      calls: planned,
      expectedChainId,
      headroomBps: deps.headroomBps ?? DEFAULT_HEADROOM_BPS,
      approveGasReserve: deps.approveGasReserve ?? APPROVE_GAS_RESERVE,
    });
    evidence.budget = {
      balanceWei: budget.balance.toString(),
      neededWei: budget.neededWei.toString(),
      balanceEth: formatEth(budget.balance),
      neededEth: formatEth(budget.neededWei),
      estimates: budget.estimates.map((e) => ({
        name: e.name,
        gasLimit: e.gasLimit.toString(),
        neededWei: e.neededWei.toString(),
        reserved: e.reserved,
      })),
    };
    for (const e of budget.estimates) {
      const tag = e.reserved ? "reserved" : "estimate";
      say(`  ${e.name.padEnd(12)} gas ${e.gasLimit.toString()}  ${tag} ${formatEth(e.neededWei)} ETH`);
    }
    say(`  total need   ${formatEth(budget.neededWei)} ETH (incl. headroom). Balance ${formatEth(budget.balance)} ETH.`);
    say("  OK — balance covers all three writes. No faucet used.");
    say("");

    say("Step 1 — Mandate");
    say(`  Universe: ${mandate.universe.join(", ")}`);
    say(`  Caps: ${mandate.maxWeightBps / 100}% max weight, ${mandate.cashSleeveBps / 100}% cash sleeve, ${mandate.rebalanceThresholdBps} bps threshold`);
    say("  Paper book: $10,000 cash + $90,000 AAPLc");
    say(`  mandateHash  ${mandateHash}`);

    if (dryRun) {
      say("");
      say("DRY RUN — preflight passed. No transaction sent.");
      say("Step 2 would propose a rebalance:");
      for (const line of summary.tradeLines) say(`  ${line}`);
      say(`  researchHash ${researchHash}`);
      say(`  proposalHash ${proposalHash}`);
      evidence.dryRun = true;
      return { ok: true, dryRun: true, mandate, proposal, summary, evidence, logLines, budget };
    }

    if (typeof deps.sendTx !== "function") {
      throw new Error("Refusing: no sendTx hook. No transaction sent.");
    }

    say("  Sending setMandate...");
    const rc1 = await deps.sendTx(planned[0]);
    const mandateTx = rc1.hash || rc1.transactionHash;
    const mandateUrl = attachTxUrl(mandateTx, true, explorerOrigin);
    say(`  Mined        ${mandateTx}  block ${rc1.blockNumber}`);
    if (mandateUrl) say(`  Blockscout   ${mandateUrl}`);
    evidence.steps.push({ name: "setMandate", hash: mandateTx, block: Number(rc1.blockNumber), url: mandateUrl });
    say("");

    say("Step 2 — Proposal");
    say("  Live Mainnet NAVs were read with eth_call only (no gas).");
    say(`  Action: ${summary.action}${summary.code ? ` (${summary.code})` : ""}`);
    for (const line of summary.tradeLines) say(`  ${line}`);
    say(`  researchHash ${researchHash}`);
    say(`  proposalHash ${proposalHash}`);
    say("  Sending propose...");
    const rc2 = await deps.sendTx(planned[1]);
    const proposeTx = rc2.hash || rc2.transactionHash;
    const proposeUrl = attachTxUrl(proposeTx, true, explorerOrigin);
    const ev = parseNamed(deps.logContract, rc2, "Proposed");
    const proposalId = ev?.args?.proposalId != null ? idStr(ev.args.proposalId) : null;
    if (!proposalId) {
      throw new Error("Propose succeeded but the Proposed event was not parsed. Approve was not sent.");
    }
    say(`  Mined        ${proposeTx}  block ${rc2.blockNumber}`);
    say(`  proposalId   ${proposalId}`);
    if (proposeUrl) say(`  Blockscout   ${proposeUrl}`);
    evidence.steps.push({
      name: "propose",
      hash: proposeTx,
      block: Number(rc2.blockNumber),
      url: proposeUrl,
      proposalId,
    });
    say("");

    const approveWrite = encodeGuidedWrites(deps.logContract, {
      owner: from,
      mandateHash,
      researchHash,
      proposalHash,
      proposalId,
      to: contract,
    }).find((w) => w.name === "approve");

    say("Step 3 — Paper fill");
    say("  Estimating approve against the mined proposalId, then sending if the balance still covers it.");
    const approveBudget = await preflightWriteBudget({
      provider: deps.provider,
      from,
      calls: [approveWrite],
      expectedChainId,
      headroomBps: deps.headroomBps ?? DEFAULT_HEADROOM_BPS,
    });
    say(`  approve      gas ${approveBudget.estimates[0].gasLimit.toString()}  need ${formatEth(approveBudget.neededWei)} ETH`);
    say("  Sending approve...");
    const rc3 = await deps.sendTx(approveWrite);
    const approveTx = rc3.hash || rc3.transactionHash;
    const approveUrl = attachTxUrl(approveTx, true, explorerOrigin);
    say(`  Mined        ${approveTx}  block ${rc3.blockNumber}`);
    if (approveUrl) say(`  Blockscout   ${approveUrl}`);
    evidence.steps.push({ name: "approve", hash: approveTx, block: Number(rc3.blockNumber), url: approveUrl });

    const paper = (deps.applyPaper || applyPaper)(mandate, proposal, snapshot);
    say("  Paper book updated to the target weights. No funds moved.");
    say("");

    say("Step 4 — Proposal log");
    for (const step of evidence.steps) {
      say(`  ${step.name.padEnd(12)} ${step.hash}`);
      if (step.url) say(`               ${step.url}`);
    }
    const remaining = await deps.provider.getBalance(from);
    say(`  Remaining    ${formatEth(remaining)} ETH (testnet only)`);
    say("");
    say("Done. Contract is a proposal log only — it never moves funds.");

    evidence.remainingWei = remaining.toString();
    evidence.remainingEth = formatEth(remaining);
    evidence.proposalId = proposalId;
    evidence.summary = summary;

    return {
      ok: true,
      dryRun: false,
      mandate,
      proposal,
      paper,
      summary,
      evidence,
      logLines,
      budget,
      txs: {
        setMandate: mandateTx,
        propose: proposeTx,
        approve: approveTx,
        proposalId,
      },
    };
  } catch (err) {
    const message = redactSecrets(err && err.message ? err.message : err);
    evidence.error = message;
    say(`Error: ${message}`);
    return { ok: false, error: message, evidence, logLines };
  }
}

import { keccak256, toUtf8Bytes } from "ethers";
import { toJsonable } from "../serialize.js";

/** Stable JSON: sorted keys, BigInts as decimal strings. */
export function canonicalJson(value) {
  return JSON.stringify(sortKeys(toJsonable(value)));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}

export function keccakJson(value) {
  return keccak256(toUtf8Bytes(canonicalJson(value)));
}

export function hashMandate(mandate) {
  const body = {
    universe: mandate.universe,
    maxWeightBps: mandate.maxWeightBps,
    cashSleeveBps: mandate.cashSleeveBps,
    rebalanceThresholdBps: mandate.rebalanceThresholdBps,
    neverAutoSpend: mandate.neverAutoSpend !== false,
  };
  return keccakJson(body);
}

export function hashResearch(snapshot, flags) {
  return keccakJson({
    at: snapshot.at,
    assets: snapshot.assets,
    flags: flags ?? [],
  });
}

export function hashProposalBody(proposal) {
  return keccakJson({
    action: proposal.action,
    code: proposal.code,
    totalE8: proposal.totalE8,
    maxDriftBps: proposal.maxDriftBps,
    target: proposal.target,
    trades: proposal.trades,
  });
}

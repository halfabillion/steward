/**
 * Deterministic mandate → rebalance proposal.
 * Pure function: no I/O. Prices and multipliers come from a snapshot fixture
 * or from src/data/snapshot.js. Never executes a trade.
 */
import { BPS_DENOM, NAV_SCALE, WAD } from "../constants.js";

const DUST_E8 = 1_00_000_000n; // $1 at 8 decimals — ignore smaller deltas

export function uiAmount(raw, multiplierWad, decimals) {
  // UI shares, still in token decimals: raw * multiplier / WAD
  return (BigInt(raw) * BigInt(multiplierWad)) / WAD;
}

export function positionValueE8(raw, navE8, decimals) {
  const scale = 10n ** BigInt(decimals);
  return (BigInt(raw) * BigInt(navE8)) / scale;
}

function bps(part, whole) {
  if (whole === 0n) return 0n;
  return (part * BPS_DENOM) / whole;
}

/**
 * Equal-weight targets over the universe, each capped at maxWeightBps,
 * with at least cashSleeveBps left in cash. Leftover from caps stays as cash.
 */
export function targetValues(universe, totalE8, { maxWeightBps, cashSleeveBps }) {
  if (universe.length === 0 || totalE8 <= 0n) return { targets: {}, cash: totalE8 };
  const sleeve = (totalE8 * BigInt(cashSleeveBps)) / BPS_DENOM;
  const cap = (totalE8 * BigInt(maxWeightBps)) / BPS_DENOM;
  const riskBudget = totalE8 - sleeve;
  const n = BigInt(universe.length);
  let each = riskBudget / n;
  if (each > cap) each = cap;
  const targets = {};
  let allocated = 0n;
  for (const symbol of universe) {
    targets[symbol] = each;
    allocated += each;
  }
  return { targets, cash: totalE8 - allocated };
}

/**
 * @param {object} mandate
 * @param {string[]} mandate.universe
 * @param {number} mandate.maxWeightBps
 * @param {number} mandate.cashSleeveBps
 * @param {number} mandate.rebalanceThresholdBps
 * @param {boolean} [mandate.neverAutoSpend=true]
 * @param {bigint|number|string} mandate.cashE8  cash in 1e8 USD units
 * @param {{symbol:string, raw:bigint|number|string}[]} mandate.positions
 * @param {object} snapshot  { at, assets: { [symbol]: { navE8, uiMultiplierWad, decimals, stale, pendingCorporateAction, heldOffHours } } }
 */
export function proposeRebalance(mandate, snapshot, { nowSec } = {}) {
  const universe = [...new Set(mandate.universe)];
  const neverAutoSpend = mandate.neverAutoSpend !== false;
  const flags = [];
  const reasons = [];
  const at = nowSec ?? snapshot.at ?? Math.floor(Date.now() / 1000);

  if (!universe.length) {
    return blocked("empty_universe", { flags, reasons: ["Universe is empty."], neverAutoSpend });
  }

  const assets = snapshot.assets ?? {};
  const positions = mandate.positions ?? [];
  const cashE8 = BigInt(mandate.cashE8 ?? 0);

  // Price every held name and every universe name.
  const needed = new Set([...universe, ...positions.map((p) => p.symbol)]);
  const valued = {};
  let pricedValue = 0n;
  let unpriced = [];

  for (const symbol of needed) {
    const pos = positions.find((p) => p.symbol === symbol);
    const raw = BigInt(pos?.raw ?? 0);
    const asset = assets[symbol];
    if (!asset || asset.missing || asset.navE8 === undefined || asset.navE8 === null) {
      unpriced.push(symbol);
      flags.push({ symbol, type: "unpriced", detail: "No NAV in snapshot." });
      valued[symbol] = { raw, valueE8: 0n, priced: false, asset: asset ?? null };
      continue;
    }
    const decimals = asset.decimals ?? 8;
    const valueE8 = positionValueE8(raw, asset.navE8, decimals);
    const ui = uiAmount(raw, asset.uiMultiplierWad ?? WAD, decimals);
    valued[symbol] = { raw, valueE8, ui, priced: true, decimals, asset };
    pricedValue += valueE8;
    if (asset.stale) {
      flags.push({ symbol, type: "stale_nav", detail: asset.reason ?? "NAV is stale." });
    } else if (asset.heldOffHours) {
      flags.push({ symbol, type: "held_off_hours", detail: asset.reason ?? "Feed holding last close." });
    }
    if (asset.pendingCorporateAction) {
      flags.push({
        symbol,
        type: "pending_corporate_action",
        detail: `Pending uiMultiplier ${asset.pending?.newUIMultiplierWad} at ${asset.pending?.effectiveAt}`,
      });
    }
  }

  const totalE8 = pricedValue + cashE8;
  if (totalE8 <= 0n) {
    return blocked("zero_portfolio", { flags, reasons: ["Portfolio value is zero."], neverAutoSpend });
  }

  const staleUniverse = universe.filter((s) => assets[s]?.stale || assets[s]?.missing || !assets[s]);
  if (staleUniverse.length === universe.length) {
    reasons.push("Every name in the universe has a stale or missing NAV. Refusing to rebalance.");
    return {
      action: "blocked",
      code: "all_stale",
      reasons,
      flags,
      neverAutoSpend,
      totalE8,
      current: currentAlloc(valued, cashE8, totalE8, universe),
      target: null,
      trades: [],
      brief: brief("blocked", reasons, flags, [], neverAutoSpend, totalE8),
    };
  }

  const { targets, cash: targetCash } = targetValues(universe, totalE8, {
    maxWeightBps: mandate.maxWeightBps,
    cashSleeveBps: mandate.cashSleeveBps,
  });

  // Do not buy a name that is stale or has a pending corporate action.
  // Leftover target value stays as cash.
  for (const symbol of universe) {
    const asset = assets[symbol];
    const skipBuy = asset?.stale || asset?.pendingCorporateAction || !asset || asset.missing;
    if (skipBuy && (targets[symbol] ?? 0n) > (valued[symbol]?.valueE8 ?? 0n)) {
      const why = asset?.stale ? "stale NAV" : asset?.pendingCorporateAction ? "pending corporate action" : "unpriced";
      reasons.push(`Skipping buy of ${symbol}: ${why}.`);
      targets[symbol] = valued[symbol]?.valueE8 ?? 0n;
    }
  }
  let allocated = 0n;
  for (const symbol of universe) allocated += targets[symbol] ?? 0n;
  const finalTargetCash = totalE8 - allocated;

  const current = currentAlloc(valued, cashE8, totalE8, universe);
  const targetAlloc = {};
  for (const symbol of universe) {
    const v = targets[symbol] ?? 0n;
    targetAlloc[symbol] = { valueE8: v, weightBps: Number(bps(v, totalE8)) };
  }
  targetAlloc.cash = { valueE8: finalTargetCash, weightBps: Number(bps(finalTargetCash, totalE8)) };

  // Max drift vs target, in bps of total.
  let maxDriftBps = 0n;
  for (const symbol of universe) {
    const cur = valued[symbol]?.valueE8 ?? 0n;
    const tgt = targets[symbol] ?? 0n;
    const drift = cur >= tgt ? cur - tgt : tgt - cur;
    const d = bps(drift, totalE8);
    if (d > maxDriftBps) maxDriftBps = d;
  }
  const cashDrift = cashE8 >= finalTargetCash ? cashE8 - finalTargetCash : finalTargetCash - cashE8;
  const cashDriftBps = bps(cashDrift, totalE8);
  if (cashDriftBps > maxDriftBps) maxDriftBps = cashDriftBps;

  const threshold = BigInt(mandate.rebalanceThresholdBps);
  const trades = [];

  if (maxDriftBps < threshold) {
    reasons.push(
      `Max drift ${maxDriftBps} bps is inside the ${threshold} bps threshold. Holding.`,
    );
    return {
      action: "hold",
      code: "within_threshold",
      reasons,
      flags,
      neverAutoSpend,
      totalE8,
      maxDriftBps: Number(maxDriftBps),
      current,
      target: targetAlloc,
      trades: [],
      brief: brief("hold", reasons, flags, [], neverAutoSpend, totalE8),
    };
  }

  for (const symbol of universe) {
    const asset = assets[symbol];
    const cur = valued[symbol]?.valueE8 ?? 0n;
    const raw = valued[symbol]?.raw ?? 0n;
    const tgt = targets[symbol] ?? 0n;
    const signed = tgt - cur;
    const abs = signed >= 0n ? signed : -signed;
    if (abs < DUST_E8) continue;

    const side = signed > 0n ? "buy" : "sell";
    if (side === "buy" && (asset?.stale || asset?.pendingCorporateAction)) {
      reasons.push(`Skipping buy of ${symbol}: ${asset.stale ? "stale NAV" : "pending corporate action"}.`);
      continue;
    }
    if (!asset?.navE8) continue;
    const decimals = asset.decimals ?? 8;
    const scale = 10n ** BigInt(decimals);
    // whole-token raw units: usdE8 * 10^decimals / navE8
    const rawDelta = ( (signed > 0n ? signed : -signed) * scale ) / asset.navE8;
    if (rawDelta === 0n) continue;
    const uiDelta = uiAmount(rawDelta, asset.uiMultiplierWad ?? WAD, decimals);
    trades.push({
      symbol,
      side,
      raw: rawDelta,
      ui: uiDelta,
      valueE8: signed > 0n ? signed : -signed,
      fromValueE8: cur,
      toValueE8: tgt,
      fromRaw: raw,
    });
  }

  if (!trades.length) {
    reasons.push("Drift was above the threshold, but every trade was skipped or dust. Holding.");
    return {
      action: "hold",
      code: "no_tradable_delta",
      reasons,
      flags,
      neverAutoSpend,
      totalE8,
      maxDriftBps: Number(maxDriftBps),
      current,
      target: targetAlloc,
      trades: [],
      brief: brief("hold", reasons, flags, [], neverAutoSpend, totalE8),
    };
  }

  reasons.push(
    `Rebalance proposed: max drift ${maxDriftBps} bps exceeds the ${threshold} bps threshold.`,
  );
  reasons.push("Proposal only — Steward never auto-spends. A user must approve on-chain.");
  return {
    action: "rebalance",
    code: "drift",
    reasons,
    flags,
    neverAutoSpend,
    totalE8,
    maxDriftBps: Number(maxDriftBps),
    current,
    target: targetAlloc,
    trades,
    brief: brief("rebalance", reasons, flags, trades, neverAutoSpend, totalE8),
  };
}

function currentAlloc(valued, cashE8, totalE8, universe) {
  const out = {};
  for (const symbol of universe) {
    const v = valued[symbol]?.valueE8 ?? 0n;
    out[symbol] = {
      raw: valued[symbol]?.raw ?? 0n,
      ui: valued[symbol]?.ui ?? 0n,
      valueE8: v,
      weightBps: Number(bps(v, totalE8)),
    };
  }
  // Include held names not in the universe so a sell-out is visible in current,
  // but we only target universe names (off-universe holdings stay put this spike).
  out.cash = { valueE8: cashE8, weightBps: Number(bps(cashE8, totalE8)) };
  return out;
}

function blocked(code, { flags, reasons, neverAutoSpend, totalE8 = 0n }) {
  return {
    action: "blocked",
    code,
    reasons,
    flags,
    neverAutoSpend,
    totalE8,
    current: null,
    target: null,
    trades: [],
    brief: brief("blocked", reasons, flags, [], neverAutoSpend, totalE8),
  };
}

export function fmtUsd(e8) {
  const v0 = BigInt(e8);
  const neg = v0 < 0n;
  const v = neg ? -v0 : v0;
  const whole = v / NAV_SCALE;
  const cents = (v % NAV_SCALE).toString().padStart(8, "0").slice(0, 2);
  return `${neg ? "-" : ""}$${whole.toLocaleString("en-US")}.${cents}`;
}

function brief(action, reasons, flags, trades, neverAutoSpend, totalE8) {
  const lines = [];
  lines.push(`Steward proposal: ${action}. Portfolio ${fmtUsd(totalE8)}.`);
  for (const r of reasons) lines.push(r);
  for (const f of flags) lines.push(`Flag ${f.symbol}: ${f.type} — ${f.detail}`);
  for (const t of trades) {
    lines.push(`${t.side.toUpperCase()} ${t.symbol}: ${fmtUsd(t.valueE8)} (raw ${t.raw}).`);
  }
  if (neverAutoSpend) lines.push("Never auto-spend is on. This is a proposal, not an order.");
  return lines.join(" ");
}

export const __private = { bps, DUST_E8, fmtUsd };

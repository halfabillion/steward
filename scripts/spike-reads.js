/**
 * Live read-only probe: Tokenized Stocks API + Base Mainnet eth_call
 * (B20 multiplier / pending CA + Chainlink NAV). Then run the engine on a
 * synthetic book against live prices. No keys, no gas, no wallets.
 */
import { DEMO_UNIVERSE, NAV_SCALE } from "../src/constants.js";
import { listChains, listTokenizedStocks } from "../src/data/api.js";
import { snapshotUniverse } from "../src/data/snapshot.js";
import { proposeRebalance } from "../src/engine/propose.js";

function usd(e8) {
  if (e8 === null || e8 === undefined) return "—";
  const v = BigInt(e8);
  const whole = v / NAV_SCALE;
  const frac = (v % NAV_SCALE).toString().padStart(8, "0").replace(/0+$/, "");
  return frac ? `$${whole}.${frac}` : `$${whole}`;
}

function wadToDec(wad) {
  const w = BigInt(wad);
  const whole = w / 10n ** 18n;
  const frac = (w % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

const now = Math.floor(Date.now() / 1000);
console.log("Steward live spike (read-only)");
console.log("time", new Date(now * 1000).toISOString(), "UK/UTC");
console.log("");

const chains = await listChains();
console.log("API /chains:", JSON.stringify(chains.chains ?? chains, null, 2));

const all = await listTokenizedStocks({ pageSize: 100 });
console.log(`API listed ${all.length} tokenized stocks.`);

const snap = await snapshotUniverse(DEMO_UNIVERSE, { nowSec: now });
console.log(`Base RPC chainId=${snap.network.chainId} block=${snap.network.blockNumber}`);
console.log("");
console.log(
  "symbol".padEnd(8),
  "mult".padEnd(14),
  "API match".padEnd(10),
  "NAV".padEnd(14),
  "src".padEnd(10),
  "age".padEnd(10),
  "flags",
);
for (const symbol of DEMO_UNIVERSE) {
  const a = snap.assets[symbol];
  if (!a || a.missing) {
    console.log(symbol, "MISSING");
    continue;
  }
  const flags = [];
  if (a.pendingCorporateAction) flags.push("PENDING_CA");
  if (a.stale) flags.push("STALE");
  else if (a.heldOffHours) flags.push("HELD");
  if (a.navMatch === false) flags.push("NAV_MISMATCH");
  if (a.multiplierMatch === false) flags.push("MULT_MISMATCH");
  console.log(
    symbol.padEnd(8),
    wadToDec(a.uiMultiplierWad).slice(0, 13).padEnd(14),
    String(a.multiplierMatch).padEnd(10),
    usd(a.navE8).padEnd(14),
    String(a.navSource).padEnd(10),
    (a.ageSec === null ? "—" : `${Math.round(a.ageSec / 60)}m`).padEnd(10),
    flags.join(",") || "ok",
  );
}

// Synthetic concentrated book: 90% AAPL, 10% cash, against the live 7-name universe.
const aaplNav = snap.assets.AAPLc?.navE8;
if (!aaplNav) {
  console.log("\nNo AAPLc NAV; skip live proposal.");
  process.exit(0);
}
const cashE8 = 10_000n * NAV_SCALE; // $10,000 cash
const aaplValue = 90_000n * NAV_SCALE; // $90,000
const aaplRaw = (aaplValue * 10n ** 8n) / aaplNav;
const mandate = {
  universe: DEMO_UNIVERSE,
  maxWeightBps: 3000,
  cashSleeveBps: 1000,
  rebalanceThresholdBps: 200,
  neverAutoSpend: true,
  cashE8,
  positions: [{ symbol: "AAPLc", raw: aaplRaw }],
};
const proposal = proposeRebalance(mandate, snap, { nowSec: now });
console.log("\nLive engine (synthetic $90k AAPLc + $10k cash, max 30%, 10% sleeve):");
console.log("action:", proposal.action, "code:", proposal.code, "maxDriftBps:", proposal.maxDriftBps);
console.log("brief:", proposal.brief);
console.log("trades:");
for (const t of proposal.trades) {
  console.log(`  ${t.side} ${t.symbol} ${usd(t.valueE8)} raw=${t.raw} ui=${t.ui}`);
}
console.log("flags:", proposal.flags.length ? proposal.flags : "(none)");
console.log("\nDone. No transactions were sent.");

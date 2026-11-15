/**
 * Live, read-only smoke: official Tokenized Stocks API NAV vs deepest DEX pool
 * (DexScreener public API). No key, no wallet, no gas. Usage: node scripts/dex-smoke.js
 */
import { DEMO_UNIVERSE } from "../src/constants.js";
import { listTokenizedStocks } from "../src/data/api.js";
import { attachDexMarket } from "../src/data/dex.js";
import { snapshotFromListed } from "../src/data/snapshot.js";

const e8 = (v) => (v == null ? "—" : (Number(v) / 1e8).toFixed(4));
const listed = await listTokenizedStocks({ symbols: DEMO_UNIVERSE });
const snap = snapshotFromListed(listed);
await attachDexMarket(snap, { cache: new Map() });
console.log(`DEX read at ${new Date(snap.dexMarket.at * 1000).toISOString()} via ${snap.dexMarket.source}; min liquidity $${snap.dexMarket.minLiquidityUsd}`);
for (const sym of DEMO_UNIVERSE) {
  const a = snap.assets[sym];
  if (!a) { console.log(`${sym}\tnot in API`); continue; }
  const m = a.market || {};
  const navAt = a.navUpdatedAt ? new Date(a.navUpdatedAt * 1000).toISOString() : "—";
  console.log(m.ok
    ? `${sym}\tNAV ${e8(a.navE8)} (api, ${navAt})\tDEX ${e8(a.marketE8)} ${m.dexId}/${m.quoteSymbol} liq $${Math.round(m.liquidityUsd)} pair ${m.pairAddress}\tpremium ${a.premiumBps} bps`
    : `${sym}\tNAV ${e8(a.navE8)}\tno DEX market (${m.reason})`);
}

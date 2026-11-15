/**
 * Live smoke: official Tokenized Stocks API + DexScreener public API (both no key).
 * Skips cleanly when offline or when STEWARD_SKIP_LIVE_API=1. Read-only.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_UNIVERSE } from "../src/constants.js";
import { listTokenizedStocks } from "../src/data/api.js";
import { attachDexMarket } from "../src/data/dex.js";
import { snapshotFromListed } from "../src/data/snapshot.js";

async function online() {
  if (process.env.STEWARD_SKIP_LIVE_API === "1") return false;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 5000);
    const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/0xb200000000000000000000C2e324d24d7eEcd1fb", { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

describe("live DEX smoke", async () => {
  const live = await online();
  it("reads live DEX prices for the demo basket or reports 'no DEX market'", { skip: live ? false : "offline / DexScreener unreachable" }, async () => {
    let listed;
    try {
      listed = await listTokenizedStocks({ symbols: DEMO_UNIVERSE });
    } catch (err) {
      return; // Official API unreachable: nothing to compare against; not a failure of the reader.
    }
    const snap = snapshotFromListed(listed);
    await attachDexMarket(snap, { cache: new Map() });
    assert.ok(snap.dexMarket);
    for (const a of Object.values(snap.assets)) {
      assert.ok(a.market, a.symbol);
      if (a.market.ok) {
        assert.ok(a.marketE8 > 0n, a.symbol);
        assert.ok(a.market.liquidityUsd >= a.market.minLiquidityUsd, a.symbol);
        assert.ok(Math.abs(a.premiumBps) < 2000, `${a.symbol} ${a.premiumBps} bps`);
      } else {
        assert.equal(a.market.note, "no DEX market");
        assert.equal(a.premiumBps, null);
      }
    }
  });
});

/**
 * DEX premium reader. Uses a committed, unmodified live DexScreener response
 * (test/fixtures/dexscreener-basket.json, fetched Sun 15 Nov 2026 14:34 UTC)
 * through an injected fetch, so this suite is deterministic and offline.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_UNIVERSE, WAD } from "../src/constants.js";
import {
  attachDexMarket,
  perShareE8,
  pickDeepestPair,
  priceToE8,
  readDexMarket,
} from "../src/data/dex.js";
import { snapshotFromListed } from "../src/data/snapshot.js";
import { explainProposal } from "../src/engine/explain.js";
import { premiumBps, premiumFlag } from "../src/engine/premium.js";
import { proposeRebalance } from "../src/engine/propose.js";

const here = dirname(fileURLToPath(import.meta.url));
const DEX = JSON.parse(readFileSync(join(here, "fixtures", "dexscreener-basket.json"), "utf8"));
const API = JSON.parse(readFileSync(join(here, "fixtures", "api-universe.json"), "utf8"));
const ADDR = Object.fromEntries(API.tokens.map((t) => [t.symbol, t.contract_address]));

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** Fake fetch that serves the fixture by address and records concurrency. */
function fixtureFetch(overrides = {}) {
  const stats = { calls: 0, inFlight: 0, maxInFlight: 0, urls: [] };
  const byLower = Object.fromEntries(Object.entries(DEX.responses).map(([a, b]) => [a.toLowerCase(), b]));
  const impl = async (url) => {
    stats.calls += 1;
    stats.inFlight += 1;
    stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
    stats.urls.push(url);
    await new Promise((r) => setTimeout(r, 2));
    stats.inFlight -= 1;
    const addr = url.split("/").pop().toLowerCase();
    if (overrides[addr]) return overrides[addr]();
    const body = byLower[addr];
    return body ? jsonResponse(body) : jsonResponse({ schemaVersion: "1.0.0", pairs: null });
  };
  return { impl, stats };
}

function snapAtFixture() {
  const latest = Math.max(...API.tokens.map((t) => Date.parse(t.nav_price_updated_at)));
  return snapshotFromListed(API.tokens, { nowSec: Math.floor(latest / 1000) + 60 });
}

describe("DEX reader: pair selection", () => {
  it("parses plain decimal prices to 8 dp and rejects junk", () => {
    assert.equal(priceToE8("356.2102"), 35_621_020_000n);
    assert.equal(priceToE8("263.007648"), 26_300_764_800n);
    assert.equal(priceToE8("1e-8"), null);
    assert.equal(priceToE8(""), null);
    assert.equal(priceToE8("0"), null);
  });

  it("every demo-basket token has a real USD-stable pair in the live fixture", () => {
    for (const sym of DEMO_UNIVERSE) {
      const body = DEX.responses[ADDR[sym]];
      assert.ok(body, `fixture missing ${sym}`);
      const { pair } = pickDeepestPair(body, ADDR[sym]);
      assert.ok(pair, `${sym} should have a pair above the min liquidity`);
      assert.equal(pair.chainId, "base");
      assert.equal(pair.baseToken.address.toLowerCase(), ADDR[sym].toLowerCase());
      assert.equal(pair.quoteToken.symbol, "USDC");
    }
  });

  it("picks the deepest pool, not the first one DexScreener lists (AMZNc)", () => {
    const body = DEX.responses[ADDR.AMZNc];
    assert.equal(body.pairs[0].dexId, "uniswap"); // first listed is a shallow v4 pool
    const { pair, eligible } = pickDeepestPair(body, ADDR.AMZNc);
    assert.equal(pair.dexId, "aero");
    assert.ok(pair.liquidity.usd > 1_000_000);
    assert.ok(eligible >= 2);
  });

  it("ignores pairs where the stock token is the quote side or quoted in ETH", () => {
    const body = DEX.responses[ADDR.AAPLc];
    const { pair } = pickDeepestPair(body, ADDR.AAPLc);
    assert.equal(pair.baseToken.symbol, "AAPLc");
    assert.equal(pair.priceNative, "356.2102");
    // A meme pair with AAPLc as quote exists with >$200k liquidity; it must never win.
    assert.ok(body.pairs.some((p) => p.quoteToken.symbol === "AAPLc" && p.liquidity?.usd > 200_000));
  });

  it("applies the min-liquidity threshold and reports no pair cleanly", () => {
    const body = DEX.responses[ADDR.TSLAc];
    assert.equal(pickDeepestPair(body, ADDR.TSLAc, { minLiquidityUsd: 1e9 }).reason, "below_min_liquidity");
    assert.equal(pickDeepestPair({ pairs: null }, ADDR.TSLAc).reason, "no_pair");
    assert.equal(pickDeepestPair({ pairs: [] }, ADDR.TSLAc).pair, null);
  });
});

describe("DEX reader: fetch, cache and failure", () => {
  it("reads a price, then serves the second call from cache", async () => {
    const { impl, stats } = fixtureFetch();
    const cache = new Map();
    const a = await readDexMarket(ADDR.AAPLc, { fetchImpl: impl, cache });
    assert.equal(a.ok, true);
    assert.equal(a.marketE8, 35_621_020_000n);
    assert.equal(a.priceField, "priceNative");
    assert.equal(a.dexId, "aero");
    assert.equal(a.source, "dexscreener");
    const b = await readDexMarket(ADDR.AAPLc, { fetchImpl: impl, cache });
    assert.equal(b.cached, true);
    assert.equal(stats.calls, 1);
  });

  it("returns 'no DEX market' on HTTP 429 without caching it", async () => {
    const addr = ADDR.MSFTc.toLowerCase();
    const { impl, stats } = fixtureFetch({ [addr]: () => jsonResponse({}, 429) });
    const cache = new Map();
    const r = await readDexMarket(ADDR.MSFTc, { fetchImpl: impl, cache });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "http_429");
    assert.equal(r.note, "no DEX market");
    await readDexMarket(ADDR.MSFTc, { fetchImpl: impl, cache });
    assert.equal(stats.calls, 2);
  });

  it("times out instead of hanging, and survives a throwing fetch", async () => {
    const hang = (_url, { signal }) => new Promise((_res, rej) => {
      signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
    const t = await readDexMarket(ADDR.NVDAc, { fetchImpl: hang, timeoutMs: 20, cache: new Map() });
    assert.equal(t.ok, false);
    assert.equal(t.reason, "timeout");
    const boom = async () => { throw new Error("getaddrinfo ENOTFOUND"); };
    const e = await readDexMarket(ADDR.NVDAc, { fetchImpl: boom, cache: new Map() });
    assert.equal(e.reason, "fetch_error");
    assert.equal(e.marketE8, null);
  });
});

describe("DEX premium in the snapshot and engine", () => {
  it("attaches per-token market price and premium sequentially", async () => {
    const snap = snapAtFixture();
    const { impl, stats } = fixtureFetch();
    await attachDexMarket(snap, { fetchImpl: impl, cache: new Map(), nowMs: () => Date.parse("2026-11-15T14:34:36Z") });
    assert.equal(stats.maxInFlight, 1, "calls must be sequential");
    assert.equal(stats.calls, DEMO_UNIVERSE.length);
    assert.equal(snap.dexMarket.priced, DEMO_UNIVERSE.length);
    assert.equal(snap.dexMarket.source, "dexscreener");
    for (const sym of DEMO_UNIVERSE) {
      const a = snap.assets[sym];
      assert.equal(a.market.ok, true, sym);
      assert.equal(a.premiumBps, premiumBps(a.marketE8, a.navE8), sym);
      assert.ok(Math.abs(a.premiumBps) < 500, `${sym} premium ${a.premiumBps} looks implausible`);
    }
    // Real numbers: AAPLc aero/USDC 356.2102 vs API NAV 355.585 → +17 bps.
    assert.equal(snap.assets.AAPLc.marketE8, 35_621_020_000n);
    assert.equal(snap.assets.AAPLc.premiumBps, 17);
  });

  it("keeps per-token vs per-token consistent under a non-1.0 uiMultiplier (GOOGLc)", async () => {
    const snap = snapAtFixture();
    const { impl } = fixtureFetch();
    await attachDexMarket(snap, { fetchImpl: impl, cache: new Map() });
    const g = snap.assets.GOOGLc;
    assert.ok(g.uiMultiplierWad > WAD);
    assert.equal(g.market.perShareE8, (g.marketE8 * WAD) / g.uiMultiplierWad);
    // Per-share premium (both sides ÷ multiplier) equals the per-token premium.
    const navPerShare = perShareE8(g.navE8, g.uiMultiplierWad);
    const perShareBps = premiumBps(g.market.perShareE8, navPerShare);
    assert.ok(Math.abs(perShareBps - g.premiumBps) <= 1);
  });

  it("a missing market leaves the premium unflagged with a 'no DEX market' note", async () => {
    const snap = snapAtFixture();
    const tsla = ADDR.TSLAc.toLowerCase();
    const { impl } = fixtureFetch({ [tsla]: () => jsonResponse({ schemaVersion: "1.0.0", pairs: null }) });
    await attachDexMarket(snap, { fetchImpl: impl, cache: new Map() });
    const t = snap.assets.TSLAc;
    assert.equal(t.market.ok, false);
    assert.equal(t.market.note, "no DEX market");
    assert.equal(t.premiumBps, null);
    assert.equal(t.marketE8, undefined);
    assert.equal(premiumFlag("TSLAc", t), null);
    assert.equal(snap.dexMarket.priced, DEMO_UNIVERSE.length - 1);
  });

  it("a wide premium is flagged but never blocks the rebalance", async () => {
    const snap = snapAtFixture();
    const nvda = ADDR.NVDAc.toLowerCase();
    const wide = JSON.parse(JSON.stringify(DEX.responses[ADDR.NVDAc]));
    for (const p of wide.pairs) if (p.dexId === "aero" && p.quoteToken.symbol === "USDC") p.priceNative = "180.0000";
    const { impl } = fixtureFetch({ [nvda]: () => jsonResponse(wide) });
    await attachDexMarket(snap, { fetchImpl: impl, cache: new Map() });
    assert.ok(snap.assets.NVDAc.premiumBps > 100);
    const apple = snap.assets.AAPLc;
    const mandate = {
      universe: [...DEMO_UNIVERSE],
      maxWeightBps: 3000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      neverAutoSpend: true,
      cashE8: 10_000n * 10n ** 8n,
      positions: [{ symbol: "AAPLc", raw: (90_000n * 10n ** 8n * 10n ** 8n) / apple.navE8 }],
    };
    const proposal = proposeRebalance(mandate, snap);
    assert.equal(proposal.action, "rebalance");
    assert.ok(proposal.flags.some((f) => f.symbol === "NVDAc" && f.type === "dex_premium"));
    assert.ok(proposal.trades.some((t) => t.symbol === "NVDAc" && t.side === "buy"));
    const text = explainProposal(proposal, mandate, snap).paragraphs.join(" ");
    assert.match(text, /Secondary market versus official NAV \(dexscreener/);
    assert.match(text, /NVDAc \+\d+ bps on aero/);
    assert.match(text, /flag, not a block/);
  });

  it("the explanation names tokens with no DEX market", async () => {
    const snap = snapAtFixture();
    const { impl } = fixtureFetch({ [ADDR.METAc.toLowerCase()]: () => jsonResponse({}, 503) });
    await attachDexMarket(snap, { fetchImpl: impl, cache: new Map() });
    const mandate = {
      universe: [...DEMO_UNIVERSE], maxWeightBps: 3000, cashSleeveBps: 1000,
      rebalanceThresholdBps: 200, neverAutoSpend: true, cashE8: 100_000n * 10n ** 8n, positions: [],
    };
    const proposal = proposeRebalance(mandate, snap);
    const text = explainProposal(proposal, mandate, snap).paragraphs.join(" ");
    assert.match(text, /No DEX market for METAc/);
  });
});

/**
 * Local end-to-end: official Tokenized Stocks API (no key) → snapshot →
 * propose → explain → paper fill. Prefers a live API read; falls back to
 * the committed fixture so the suite stays green offline.
 * No wallet, no gas, no public chain.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_UNIVERSE } from "../src/constants.js";
import { listTokenizedStocks } from "../src/data/api.js";
import { snapshotFromListed } from "../src/data/snapshot.js";
import { explainProposal } from "../src/engine/explain.js";
import { applyPaper } from "../src/engine/paper.js";
import { proposeRebalance } from "../src/engine/propose.js";

const FIXTURE_PATH = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "api-universe.json");

async function loadListed() {
  if (process.env.STEWARD_SKIP_LIVE_API !== "1") {
    try {
      const listed = await listTokenizedStocks({ symbols: DEMO_UNIVERSE });
      const bySym = new Map(listed.map((t) => [t.symbol, t]));
      if (DEMO_UNIVERSE.every((s) => bySym.get(s)?.nav_price != null)) {
        return { source: "live-api", tokens: DEMO_UNIVERSE.map((s) => bySym.get(s)) };
      }
    } catch {
      // Fall through to the fixture.
    }
  }
  const body = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  return { source: "fixture", tokens: body.tokens };
}

function rawForUsd(usd, navE8, decimals = 8) {
  const usdE8 = BigInt(usd) * 10n ** 8n;
  const scale = 10n ** BigInt(decimals);
  return (usdE8 * scale) / BigInt(navE8);
}

describe("local API-to-paper loop", () => {
  it("proposes and paper-fills a rebalance from official API NAVs", async () => {
    const { source, tokens } = await loadListed();
    assert.equal(tokens.length, DEMO_UNIVERSE.length, `missing API rows (source=${source})`);

    // Pin "now" just after the newest NAV so a weekend session is not marked stale.
    const latest = Math.max(
      ...tokens.map((t) => Date.parse(t.nav_price_updated_at) || 0),
    );
    assert.ok(latest > 0, "API rows must include nav_price_updated_at");
    const nowSec = Math.floor(latest / 1000) + 60;
    const snap = snapshotFromListed(tokens, { nowSec });

    for (const symbol of DEMO_UNIVERSE) {
      const asset = snap.assets[symbol];
      assert.ok(asset, symbol);
      assert.equal(asset.missing, false, symbol);
      assert.ok(asset.navE8 > 0n, symbol);
      assert.equal(asset.navSource, "api");
      assert.equal(asset.stale, false, `${symbol} should not be stale at pinned now`);
    }

    const apple = snap.assets.AAPLc;
    const mandate = {
      universe: [...DEMO_UNIVERSE],
      maxWeightBps: 3000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      neverAutoSpend: true,
      cashE8: 10_000n * 10n ** 8n,
      positions: [{ symbol: "AAPLc", raw: rawForUsd(90_000, apple.navE8, apple.decimals) }],
    };

    const proposal = proposeRebalance(mandate, snap);
    assert.equal(proposal.action, "rebalance");
    assert.equal(proposal.neverAutoSpend, true);
    assert.ok(proposal.maxDriftBps > 200);
    assert.ok(proposal.trades.some((t) => t.symbol === "AAPLc" && t.side === "sell"));
    const buys = proposal.trades.filter((t) => t.side === "buy").map((t) => t.symbol);
    for (const symbol of DEMO_UNIVERSE.filter((s) => s !== "AAPLc")) {
      assert.ok(buys.includes(symbol), `should buy ${symbol}`);
    }
    // 7 names, 10% sleeve, 30% cap is not binding (equal weight ≈ 12.86%).
    assert.ok(proposal.target.cash.weightBps >= 990 && proposal.target.cash.weightBps <= 1010);

    const explained = explainProposal(proposal, mandate, snap);
    assert.equal(explained.title, "Rebalance proposed");
    const text = explained.paragraphs.join(" ");
    assert.match(text, /Tokenized Stocks API/);
    assert.doesNotMatch(text, /\bAI\b/i);
    assert.match(proposal.brief, /Never auto-spend/);

    const next = applyPaper(mandate, proposal, snap);
    const second = proposeRebalance(next, snap);
    assert.equal(second.action, "hold", `expected a hold after the paper fill (source=${source})`);
    assert.equal(second.trades.length, 0);
    assert.ok(second.maxDriftBps < 200);
  });
});

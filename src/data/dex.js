/**
 * Read-only secondary-market (DEX) price reader for Coinbase tokenized stocks on Base.
 *
 * Source: DexScreener public API (no key, no signup):
 *   GET https://api.dexscreener.com/latest/dex/tokens/<tokenAddress>
 *
 * Rules:
 * - Only pairs on chain "base" where the token is the BASE token (so priceNative /
 *   priceUsd are "quote per 1 whole token") and the quote is a USD stablecoin.
 * - Deepest pair by liquidity.usd wins; pairs below `minLiquidityUsd` are ignored.
 * - Price is per whole token (10^decimals raw units). Official NAV (Chainlink /
 *   API) is also per token: total-return = underlying share price × uiMultiplier.
 *   So the premium compares per-token with per-token; the uiMultiplier cancels.
 *   `perShareE8` divides it back out for display only.
 * - Sequential calls, a timeout per call, an in-memory TTL cache, and no throw:
 *   any failure yields `{ ok: false, note: "no DEX market" }`. The premium is a
 *   flag, never a block, so this reader can never stop a trade.
 */
import { WAD } from "../constants.js";
import { premiumBps } from "../engine/premium.js";

export const DEXSCREENER_TOKENS_URL = "https://api.dexscreener.com/latest/dex/tokens/";
export const DEX_SOURCE = "dexscreener";
export const DEFAULT_MIN_LIQUIDITY_USD = 25_000;
export const DEFAULT_DEX_TIMEOUT_MS = 8_000;
export const DEFAULT_DEX_CACHE_TTL_MS = 60_000;

/** USD stablecoins on Base Mainnet accepted as the quote token (lower-case). */
export const USD_STABLE_QUOTES = {
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": "USDbC",
};

const defaultCache = new Map();

/** Parse a plain decimal string ("356.2106") to an 8-decimal bigint. Rejects exponents / junk. */
export function priceToE8(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const v = BigInt(whole) * 10n ** 8n + BigInt((frac + "00000000").slice(0, 8));
  return v > 0n ? v : null;
}

/** Per-token price → per-share-equivalent price (divide out the B20 uiMultiplier). */
export function perShareE8(perTokenE8, uiMultiplierWad) {
  if (perTokenE8 == null || !uiMultiplierWad) return null;
  const m = BigInt(uiMultiplierWad);
  if (m <= 0n) return null;
  return (BigInt(perTokenE8) * WAD) / m;
}

/**
 * Choose the deepest eligible pair from a DexScreener /tokens response body.
 * @returns {{ pair: object|null, reason: string|null, eligible: number, considered: number }}
 */
export function pickDeepestPair(body, tokenAddress, {
  minLiquidityUsd = DEFAULT_MIN_LIQUIDITY_USD,
  chainId = "base",
  quotes = USD_STABLE_QUOTES,
} = {}) {
  const want = String(tokenAddress || "").toLowerCase();
  const pairs = Array.isArray(body?.pairs) ? body.pairs : [];
  const candidates = pairs.filter((p) =>
    p?.chainId === chainId
    && String(p?.baseToken?.address || "").toLowerCase() === want
    && Object.prototype.hasOwnProperty.call(quotes, String(p?.quoteToken?.address || "").toLowerCase())
    && priceToE8(p?.priceNative ?? p?.priceUsd) !== null);
  if (!candidates.length) {
    return { pair: null, reason: pairs.length ? "no_stable_pair" : "no_pair", eligible: 0, considered: pairs.length };
  }
  const liq = (p) => Number(p?.liquidity?.usd ?? 0) || 0;
  const deep = candidates.filter((p) => liq(p) >= minLiquidityUsd).sort((a, b) => liq(b) - liq(a));
  if (!deep.length) {
    return { pair: null, reason: "below_min_liquidity", eligible: 0, considered: pairs.length };
  }
  return { pair: deep[0], reason: null, eligible: deep.length, considered: pairs.length };
}

/** Map a chosen pair to a market record. `fetchedAt` is unix seconds. */
export function marketFromPair(pair, { fetchedAt, minLiquidityUsd = DEFAULT_MIN_LIQUIDITY_USD } = {}) {
  // Quote is a USD stable, so priceNative (quote per token, more decimals) is the
  // price in USD at 1 stable = 1 USD. Fall back to priceUsd.
  const fromNative = priceToE8(pair.priceNative);
  const marketE8 = fromNative ?? priceToE8(pair.priceUsd);
  return {
    ok: true,
    source: DEX_SOURCE,
    marketE8,
    priceField: fromNative !== null ? "priceNative" : "priceUsd",
    dexId: pair.dexId ?? null,
    labels: pair.labels ?? [],
    pairAddress: pair.pairAddress ?? null,
    url: pair.url ?? null,
    quoteSymbol: pair.quoteToken?.symbol ?? null,
    liquidityUsd: Number(pair.liquidity?.usd ?? 0),
    volume24hUsd: Number(pair.volume?.h24 ?? 0),
    minLiquidityUsd,
    fetchedAt,
    note: null,
  };
}

function noMarket(reason, fetchedAt, extra = {}) {
  return { ok: false, source: DEX_SOURCE, marketE8: null, reason, note: "no DEX market", fetchedAt, ...extra };
}

/**
 * Read the deepest-liquidity USD-stable DEX price for one token. Never throws.
 */
export async function readDexMarket(tokenAddress, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_DEX_TIMEOUT_MS,
  minLiquidityUsd = DEFAULT_MIN_LIQUIDITY_USD,
  cache = defaultCache,
  cacheTtlMs = DEFAULT_DEX_CACHE_TTL_MS,
  nowMs = () => Date.now(),
  baseUrl = DEXSCREENER_TOKENS_URL,
} = {}) {
  const key = `${String(tokenAddress).toLowerCase()}|${minLiquidityUsd}`;
  const t0 = nowMs();
  const hit = cache?.get(key);
  if (hit && t0 - hit.atMs < cacheTtlMs) return { ...hit.value, cached: true };

  const fetchedAt = Math.floor(t0 / 1000);
  if (!tokenAddress || !/^0x[0-9a-fA-F]{40}$/.test(String(tokenAddress))) {
    return noMarket("bad_address", fetchedAt);
  }
  let result;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl}${tokenAddress}`, {
      headers: { accept: "application/json", "user-agent": "steward/0.2 (read-only)" },
      signal: controller.signal,
    });
    if (!res.ok) {
      result = noMarket(`http_${res.status}`, fetchedAt);
    } else {
      const body = await res.json();
      const picked = pickDeepestPair(body, tokenAddress, { minLiquidityUsd });
      result = picked.pair
        ? { ...marketFromPair(picked.pair, { fetchedAt, minLiquidityUsd }), eligiblePairs: picked.eligible }
        : noMarket(picked.reason, fetchedAt, { pairsSeen: picked.considered });
    }
  } catch (err) {
    const aborted = err?.name === "AbortError";
    result = noMarket(aborted ? "timeout" : "fetch_error", fetchedAt, {
      error: aborted ? `timeout after ${timeoutMs} ms` : String(err?.message || err),
    });
  } finally {
    clearTimeout(timer);
  }
  // Cache successes and clean "no market" answers; do not cache transport errors.
  if (cache && (result.ok || /^(no_pair|no_stable_pair|below_min_liquidity)$/.test(result.reason))) {
    cache.set(key, { atMs: t0, value: result });
  }
  return { ...result, cached: false };
}

/**
 * Attach DEX market price + premium versus official NAV to each snapshot asset,
 * sequentially. Returns the same snapshot object (mutated). Never throws.
 */
export async function attachDexMarket(snapshot, opts = {}) {
  if (!snapshot?.assets) return snapshot;
  const { delayMs = 0, ...readOpts } = opts;
  const minLiquidityUsd = readOpts.minLiquidityUsd ?? DEFAULT_MIN_LIQUIDITY_USD;
  let priced = 0;
  let total = 0;
  for (const [symbol, asset] of Object.entries(snapshot.assets)) {
    if (!asset || !asset.contract) continue;
    total += 1;
    let market;
    try {
      market = await readDexMarket(asset.contract, readOpts);
    } catch (err) {
      market = noMarket("fetch_error", Math.floor(Date.now() / 1000), { error: String(err?.message || err) });
    }
    if (market.ok && market.marketE8 != null) {
      asset.marketE8 = market.marketE8;
      asset.premiumBps = premiumBps(market.marketE8, asset.navE8);
      market.perShareE8 = perShareE8(market.marketE8, asset.uiMultiplierWad);
      market.navHeldOffHours = Boolean(asset.heldOffHours || asset.stale);
      if (asset.premiumBps !== null) priced += 1;
    } else {
      delete asset.marketE8;
      asset.premiumBps = null;
    }
    asset.market = { symbol, ...market };
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  snapshot.dexMarket = {
    source: DEX_SOURCE,
    url: DEXSCREENER_TOKENS_URL,
    at: Math.floor((readOpts.nowMs ? readOpts.nowMs() : Date.now()) / 1000),
    minLiquidityUsd,
    priced,
    total,
  };
  return snapshot;
}

export function clearDexCache() {
  defaultCache.clear();
}

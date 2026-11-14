/**
 * Secondary-market premium versus official total-return NAV, in bps.
 * Positive = trading rich to NAV; negative = trading cheap. Pure function.
 */
export const PREMIUM_FLAG_BPS = 100;

export function premiumBps(marketE8, navE8) {
  if (marketE8 === undefined || marketE8 === null || navE8 === undefined || navE8 === null) {
    return null;
  }
  const market = BigInt(marketE8);
  const nav = BigInt(navE8);
  if (nav <= 0n) return null;
  return Number(((market - nav) * 10_000n) / nav);
}

/**
 * Flag a wide premium or discount when a market price is present.
 * Does not block a trade on its own; the engine only reports it.
 */
export function premiumFlag(symbol, asset, { warnBps = PREMIUM_FLAG_BPS } = {}) {
  const bps = asset?.premiumBps != null
    ? Number(asset.premiumBps)
    : premiumBps(asset?.marketE8, asset?.navE8);
  if (bps === null || bps === undefined || !Number.isFinite(bps)) return null;
  if (Math.abs(bps) < warnBps) return { bps, flag: null };
  return {
    bps,
    flag: {
      symbol,
      type: bps >= 0 ? "dex_premium" : "dex_discount",
      detail: `${bps} bps versus official NAV.`,
    },
  };
}

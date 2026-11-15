import {
  BASE_MAINNET_RPC,
  HELD_AFTER_SEC,
  STALE_AFTER_SEC,
} from "../constants.js";
import { apiTimestampSec, listTokenizedStocks, multiplierToWad, navToE8 } from "./api.js";
import { feedForSymbol, readB20, readChainlink, readNetwork } from "./onchain.js";
import { attachDexMarket } from "./dex.js";

export function pausedFromApi(row) {
  const features = Array.isArray(row?.paused_features) ? [...row.paused_features] : [];
  return { pausedFeatures: features, paused: features.length > 0 };
}

function freshness(updatedAt, nowSec, { staleAfterSec = STALE_AFTER_SEC, heldAfterSec = HELD_AFTER_SEC } = {}) {
  if (!updatedAt) {
    return { ageSec: null, stale: true, heldOffHours: false, reason: "missing_timestamp" };
  }
  const ageSec = nowSec - updatedAt;
  if (ageSec > staleAfterSec) {
    return { ageSec, stale: true, heldOffHours: true, reason: `older_than_${staleAfterSec}s` };
  }
  if (ageSec > heldAfterSec) {
    return { ageSec, stale: false, heldOffHours: true, reason: `held_off_hours_${ageSec}s` };
  }
  return { ageSec, stale: false, heldOffHours: false, reason: null };
}

/**
 * Merge official API discovery with on-chain B20 + Chainlink reads.
 * Reads are eth_call only. If a symbol has no documented feed, NAV falls back to the API.
 */
export async function snapshotUniverse(symbols, {
  rpcUrl = BASE_MAINNET_RPC,
  nowSec = Math.floor(Date.now() / 1000),
  staleAfterSec = STALE_AFTER_SEC,
  heldAfterSec = HELD_AFTER_SEC,
  dexMarket = false,
} = {}) {
  const [network, listed] = await Promise.all([
    readNetwork(rpcUrl),
    listTokenizedStocks({ symbols }),
  ]);
  const bySym = new Map(listed.map((t) => [t.symbol, t]));

  const assets = {};
  // Sequential on-chain reads to be kind to the public RPC (no parallel burst).
  for (const symbol of symbols) {
    const row = bySym.get(symbol);
    if (!row) {
      assets[symbol] = { symbol, missing: true, flags: ["not_in_api"] };
      continue;
    }
    const b20 = await readB20(row.contract_address, rpcUrl, nowSec);
    const feed = feedForSymbol(symbol);
    let chainlink = null;
    if (feed) {
      chainlink = await readChainlink(feed, rpcUrl);
    }
    const apiNavE8 = navToE8(row.nav_price);
    const apiNavAt = apiTimestampSec(row.nav_price_updated_at);
    const apiMultWad = multiplierToWad(row.multiplier);

    const navE8 = chainlink ? chainlink.answer : apiNavE8;
    const navUpdatedAt = chainlink ? chainlink.updatedAt : apiNavAt;
    const navSource = chainlink ? "chainlink" : "api";
    const fresh = freshness(navUpdatedAt, nowSec, { staleAfterSec, heldAfterSec });

    // API multiplier is a JSON number (~15 significant digits). On-chain is the
    // exact WAD. Treat sub-ppb differences as a match; on-chain wins for math.
    const multiplierMatch = b20.uiMultiplierWad === apiMultWad
      || absDiff(b20.uiMultiplierWad, apiMultWad) <= 10n ** 6n

    const navMatch = chainlink && apiNavE8 !== null
      ? chainlink.answer === apiNavE8
      : null;

    assets[symbol] = {
      symbol,
      name: b20.name || row.name,
      contract: row.contract_address,
      isin: row.isin,
      decimals: b20.decimals,
      uiMultiplierWad: b20.uiMultiplierWad,
      apiMultiplierWad: apiMultWad,
      multiplierMatch,
      pendingCorporateAction: b20.pendingCorporateAction,
      pending: b20.pending,
      navE8,
      navUpdatedAt,
      navSource,
      apiNavE8,
      apiNavUpdatedAt: apiNavAt,
      navMatch,
      chainlink,
      ...fresh,
      firstMintDate: row.first_mint_date ?? null,
      totalSupply: row.total_supply ?? null,
      ...pausedFromApi(row),
    };
  }

  const snap = { at: nowSec, network, assets };
  // Optional, read-only DEX premium. Off by default so tests stay deterministic.
  // Never throws and never blocks: a failed read leaves the premium unflagged.
  if (dexMarket) await attachDexMarket(snap, dexMarket === true ? {} : dexMarket);
  return snap;
}

function absDiff(a, b) {
  return a >= b ? a - b : b - a;
}

export { freshness };

/**
 * Build a snapshot from official API list rows only (no RPC).
 * Used for offline / API-only end-to-end tests and as a fallback when
 * a public Mainnet RPC is unavailable. On-chain uiMultiplier and
 * pending corporate actions are not available on this path.
 */
export function snapshotFromListed(listed, {
  nowSec = Math.floor(Date.now() / 1000),
  staleAfterSec = STALE_AFTER_SEC,
  heldAfterSec = HELD_AFTER_SEC,
} = {}) {
  const assets = {};
  for (const row of listed ?? []) {
    const symbol = row.symbol;
    if (!symbol) continue;
    const apiNavE8 = navToE8(row.nav_price);
    const apiNavAt = apiTimestampSec(row.nav_price_updated_at);
    const apiMultWad = multiplierToWad(row.multiplier);
    const missingNav = apiNavE8 === null;
    const fresh = missingNav
      ? { ageSec: null, stale: true, heldOffHours: false, reason: "missing_nav" }
      : freshness(apiNavAt, nowSec, { staleAfterSec, heldAfterSec });
    assets[symbol] = {
      symbol,
      name: row.name ?? symbol,
      contract: row.contract_address ?? null,
      isin: row.isin ?? row.adgm_isin ?? null,
      decimals: Number(row.decimals ?? 8),
      uiMultiplierWad: apiMultWad,
      apiMultiplierWad: apiMultWad,
      multiplierMatch: true,
      pendingCorporateAction: false,
      pending: null,
      navE8: apiNavE8,
      navUpdatedAt: apiNavAt,
      navSource: "api",
      apiNavE8,
      apiNavUpdatedAt: apiNavAt,
      navMatch: null,
      chainlink: null,
      missing: missingNav,
      firstMintDate: row.first_mint_date ?? null,
      totalSupply: row.total_supply ?? null,
      ...pausedFromApi(row),
      ...fresh,
    };
  }
  return { at: nowSec, network: { source: "api" }, assets };
}

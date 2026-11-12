import { TOKENIZED_STOCKS_API } from "../constants.js";

async function getJson(url) {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "steward-spike/0.1" },
  });
  if (!res.ok) {
    throw new Error(`Tokenized Stocks API HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

/**
 * Paginate GET /v1/tokenized-stocks. No API key.
 * Optional `symbols` (e.g. ["AAPLc"]) filters after fetch.
 */
export async function listTokenizedStocks({ symbols, pageSize = 100, maxPages = 20 } = {}) {
  const wanted = symbols ? new Set(symbols.map((s) => s.toUpperCase())) : null;
  const tokens = [];
  let pageToken;
  for (let i = 0; i < maxPages; i++) {
    const params = new URLSearchParams({ page_size: String(pageSize) });
    if (pageToken) params.set("page_token", pageToken);
    const body = await getJson(`${TOKENIZED_STOCKS_API}?${params}`);
    const page = body.tokens ?? [];
    for (const t of page) {
      if (!wanted || wanted.has(String(t.symbol).toUpperCase())) tokens.push(t);
    }
    pageToken = body.next_page_token;
    if (!pageToken) break;
    if (wanted && tokens.length === wanted.size) break;
  }
  return tokens;
}

export async function listChains() {
  return getJson(`${TOKENIZED_STOCKS_API}/chains`);
}

export async function getMetadata(ticker) {
  return getJson(`${TOKENIZED_STOCKS_API}/metadata/${encodeURIComponent(ticker)}`);
}

/** Parse API nav_price (number or string) to 8-decimal bigint. */
export function navToE8(navPrice) {
  if (navPrice === undefined || navPrice === null || navPrice === "") return null;
  const s = String(navPrice);
  const [whole, frac = ""] = s.split(".");
  const frac8 = (frac + "00000000").slice(0, 8);
  return BigInt(whole) * 10n ** 8n + BigInt(frac8);
}

/** Parse API multiplier (decimal string) to WAD (1e18). */
export function multiplierToWad(multiplier) {
  if (multiplier === undefined || multiplier === null) return 10n ** 18n;
  const s = String(multiplier);
  const [whole, frac = ""] = s.split(".");
  const frac18 = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(frac18);
}

export function apiTimestampSec(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

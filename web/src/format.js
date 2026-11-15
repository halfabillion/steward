export function usd(e8) {
  if (e8 === undefined || e8 === null || e8 === "") return "—";
  let v = BigInt(e8);
  const neg = v < 0n;
  if (neg) v = -v;
  const whole = v / 100_000_000n;
  let frac = (v % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  if (frac.length > 2) frac = frac.slice(0, 2).replace(/0+$/, "") ? (v % 100_000_000n).toString().padStart(8, "0").slice(0, 2) : frac;
  const cents = (v % 100_000_000n).toString().padStart(8, "0").slice(0, 2);
  return `${neg ? "-" : ""}$${Number(whole).toLocaleString("en-US")}.${cents}`;
}

export function wad(w) {
  if (w === undefined || w === null || w === "") return "—";
  const v = BigInt(w);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.slice(0, 6)}` : `${whole}`;
}

export function pctBps(bps) {
  if (bps === undefined || bps === null) return "—";
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

export function shortAddr(a) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function shortHash(h) {
  if (!h) return "—";
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

export function age(sec) {
  if (sec === undefined || sec === null) return "—";
  const s = Number(sec);
  if (s < 90) return `${Math.max(0, Math.round(s))}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

export function when(sec) {
  if (!sec) return "—";
  return new Date(Number(sec) * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

export function shares(raw, decimals = 8) {
  if (raw === undefined || raw === null || raw === "") return "—";
  const v = BigInt(raw);
  const d = Number(decimals);
  const scale = 10n ** BigInt(d);
  const whole = v / scale;
  const frac = (v % scale).toString().padStart(d, "0").replace(/0+$/, "").slice(0, 4);
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function signedBps(bps) {
  if (bps === undefined || bps === null) return "—";
  const n = Number(bps);
  return `${n > 0 ? "+" : ""}${n} bps`;
}

/** "aero USDC · $546k liq · 14:34 UTC" for a DEX market record. */
export function dexNote(m) {
  if (!m) return "";
  const liq = Number(m.liquidityUsd || 0);
  const liqTxt = liq >= 1e6 ? `$${(liq / 1e6).toFixed(1)}m` : `$${Math.round(liq / 1e3)}k`;
  const t = m.fetchedAt ? new Date(Number(m.fetchedAt) * 1000).toISOString().slice(11, 16) + " UTC" : "";
  return [`${m.dexId || "dex"} ${m.quoteSymbol || ""}`.trim(), `${liqTxt} liq`, t].filter(Boolean).join(" · ");
}

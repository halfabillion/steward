/**
 * Rule-based explanation of a Steward proposal. No model, no paid API.
 * Language: "steward" / "agent" / "automated" — never "AI".
 */
import { fmtUsd } from "./propose.js";

function pct(bps) {
  if (bps === undefined || bps === null) return "—";
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

function wadFmt(wad) {
  if (wad === undefined || wad === null) return "—";
  const w = BigInt(wad);
  const whole = w / 10n ** 18n;
  const frac = (w % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.slice(0, 8)}` : `${whole}`;
}

/**
 * @returns {{ title: string, paragraphs: string[], reasons: string[], flags: object[], brief: string }}
 */
export function explainProposal(proposal, mandate, snapshot) {
  const paragraphs = [];
  const n = mandate.universe?.length ?? 0;
  const max = (mandate.maxWeightBps / 100).toFixed(0);
  const sleeve = (mandate.cashSleeveBps / 100).toFixed(0);
  const th = mandate.rebalanceThresholdBps;

  paragraphs.push(
    `Your mandate is to equal-weight a ${n}-name basket of Coinbase tokenized stocks, with no name above ${max}% and at least ${sleeve}% held as cash. The steward proposes a rebalance only when drift exceeds ${th} bps. Never auto-spend is ${mandate.neverAutoSpend === false ? "off" : "on"}.`,
  );

  const observed = observe(snapshot, proposal);
  if (observed) paragraphs.push(observed);

  if (proposal.action === "rebalance") {
    const parts = [];
    parts.push(
      `The book is valued at ${fmtUsd(BigInt(proposal.totalE8))}. Maximum drift from target is ${proposal.maxDriftBps} bps, which is above the ${th} bps threshold, so the steward proposes a rebalance.`,
    );
    const highlights = weightHighlights(proposal);
    if (highlights) parts.push(highlights);
    if (proposal.trades?.length) {
      const list = proposal.trades
        .map((t) => `${t.side} ${t.symbol} for ${fmtUsd(BigInt(t.valueE8))}`)
        .join("; ");
      parts.push(`Proposed paper trades: ${list}.`);
    }
    paragraphs.push(parts.join(" "));
  } else if (proposal.action === "hold") {
    paragraphs.push(
      `The book is valued at ${fmtUsd(BigInt(proposal.totalE8 || 0n))}. Maximum drift is ${proposal.maxDriftBps ?? 0} bps, inside the ${th} bps threshold (or no tradable delta remained). The steward recommends holding. No trades are proposed.`,
    );
  } else {
    paragraphs.push(
      `The steward is blocked (${proposal.code}). ${ (proposal.reasons || []).join(" ") } It will not propose trades until this is resolved.`,
    );
  }

  paragraphs.push(
    "This is a proposal only. Approving records your decision on the local 84532 log. It does not spend, trade, or move funds. If you approve, paper positions in this session are updated to the target; you can reject and leave the book unchanged.",
  );

  const title =
    proposal.action === "rebalance"
      ? "Rebalance proposed"
      : proposal.action === "hold"
        ? "Hold — inside the threshold"
        : "Blocked — no proposal";

  return {
    title,
    paragraphs,
    reasons: proposal.reasons ?? [],
    flags: proposal.flags ?? [],
    brief: proposal.brief ?? "",
  };
}

function observe(snapshot, proposal) {
  if (!snapshot?.assets) return null;
  const names = Object.values(snapshot.assets).filter((a) => a && !a.missing);
  if (!names.length) return "The steward could not price any name in the universe.";
  const bits = [];
  bits.push(
    `It priced ${names.length} name${names.length === 1 ? "" : "s"} from official Base Mainnet reads: Chainlink total-return NAV where a feed exists, otherwise the Tokenized Stocks API, and the on-chain B20 uiMultiplier for share-equivalent units.`,
  );
  const pending = names.filter((a) => a.pendingCorporateAction);
  const stale = names.filter((a) => a.stale);
  const held = names.filter((a) => a.heldOffHours && !a.stale);
  const adjusted = names.filter((a) => a.uiMultiplierWad && BigInt(a.uiMultiplierWad) !== 10n ** 18n);
  if (adjusted.length) {
    bits.push(
      `Multiplier is not 1.0 on ${adjusted.map((a) => `${a.symbol} (${wadFmt(a.uiMultiplierWad)})`).join(", ")} — typically a reinvested dividend or other corporate action already reflected in the B20 multiplier.`,
    );
  }
  if (pending.length) {
    bits.push(
      `Pending corporate action on ${pending.map((a) => a.symbol).join(", ")}: the steward will not buy more of ${pending.length === 1 ? "that name" : "those names"} until the scheduled multiplier takes effect.`,
    );
  }
  if (stale.length) {
    bits.push(`Stale NAV on ${stale.map((a) => a.symbol).join(", ")} — those names are not bought.`);
  }
  if (held.length) {
    bits.push(
      `Feeds for ${held.map((a) => a.symbol).join(", ")} are holding a last close (off-hours is normal for these 24/5 equity feeds). That is a flag, not a block.`,
    );
  }
  const paused = names.filter((a) => a.paused);
  if (paused.length) {
    bits.push(
      `Paused features on ${paused.map((a) => a.symbol).join(", ")}: the steward will not trade ${paused.length === 1 ? "that name" : "those names"} until the pause lifts.`,
    );
  }
  const wide = names.filter((a) => {
    const bps = a.premiumBps != null ? Number(a.premiumBps) : null;
    if (bps === null || !Number.isFinite(bps)) {
      if (a.marketE8 == null || a.navE8 == null) return false;
      const nav = BigInt(a.navE8);
      if (nav <= 0n) return false;
      return absBps(a.marketE8, nav) >= 100;
    }
    return Math.abs(bps) >= 100;
  });
  if (wide.length) {
    bits.push(
      `Secondary-market price is at least 100 bps away from official NAV on ${wide.map((a) => a.symbol).join(", ")}. This is a flag, not a block.`,
    );
  }
  void proposal;
  return bits.join(" ");
}

function weightHighlights(proposal) {
  const cur = proposal.current;
  const tgt = proposal.target;
  if (!cur || !tgt) return "";
  const held = [];
  const empty = [];
  for (const [symbol, c] of Object.entries(cur)) {
    if (symbol === "cash") continue;
    const t = tgt[symbol];
    if (!t) continue;
    const drift = Math.abs((c.weightBps ?? 0) - (t.weightBps ?? 0));
    if (drift < 100) continue;
    if ((c.weightBps ?? 0) > 50) {
      held.push(`${symbol} is at ${pct(c.weightBps)} against a target of ${pct(t.weightBps)}`);
    } else {
      empty.push(symbol);
    }
  }
  const rows = [...held];
  if (empty.length) {
    rows.push(
      empty.length === 1
        ? `${empty[0]} is unallocated against its equal-weight target`
        : `${empty.join(", ")} are unallocated against equal-weight targets`,
    );
  }
  if (cur.cash && tgt.cash) {
    rows.push(`cash is at ${pct(cur.cash.weightBps)} against a target of ${pct(tgt.cash.weightBps)}`);
  }
  return rows.length ? rows.join("; ") + "." : "";
}

export { pct, wadFmt };

function absBps(marketE8, nav) {
  const market = BigInt(marketE8);
  const diff = market >= nav ? market - nav : nav - market;
  return Number((diff * 10_000n) / nav);
}

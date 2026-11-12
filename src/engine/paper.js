import { asBigInt } from "../serialize.js";

/**
 * After an approval, update the session paper book to the proposed targets.
 * Does not touch any chain. Raw units are implied by target USD and current NAV.
 */
export function applyPaper(mandate, proposal, snapshot) {
  if (proposal.action !== "rebalance" || !proposal.target) return mandate;
  const positions = [];
  for (const symbol of mandate.universe) {
    const t = proposal.target[symbol];
    const asset = snapshot.assets?.[symbol];
    const valueE8 = asBigInt(t?.valueE8, 0n);
    if (!t || !asset?.navE8 || valueE8 === 0n) {
      continue;
    }
    const decimals = asset.decimals ?? 8;
    const scale = 10n ** BigInt(decimals);
    const raw = (valueE8 * scale) / asBigInt(asset.navE8);
    if (raw === 0n) continue;
    positions.push({ symbol, raw });
  }
  return {
    ...mandate,
    cashE8: asBigInt(proposal.target.cash?.valueE8, 0n),
    positions,
  };
}

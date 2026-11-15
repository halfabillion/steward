import { age, dexNote, pctBps, shares, signedBps, usd, wad } from "../format.js";

export default function Portfolio({ snapshot, mandate, lastRun, onRefresh, onRun, busy }) {
  const assets = snapshot?.assets || {};
  const current = lastRun?.proposal?.current;
  const rows = (mandate?.universe || Object.keys(assets)).map((sym) => {
    const a = assets[sym] || {};
    const pos = (mandate?.positions || []).find((p) => p.symbol === sym);
    const alloc = current?.[sym];
    return { sym, a, pos, alloc };
  });
  return (
    <section>
      <h2 className="section">Portfolio &amp; NAV</h2>
      <p className="sub">
        Live Mainnet reads: Chainlink total-return NAV and on-chain B20 multipliers.
        The book itself is paper, held in this session.
        {snapshot?.dexMarket
          ? ` DEX vs NAV: ${snapshot.dexMarket.source} public API (no key), deepest USD-stable pool ≥ $${Number(snapshot.dexMarket.minLiquidityUsd).toLocaleString("en-US")} liquidity, read ${new Date(snapshot.dexMarket.at * 1000).toISOString().slice(11, 16)} UTC. A flag, never a block.`
          : " DEX premium not read for this snapshot."}
      </p>
      <div className="row">
        <button className="btn ghost" disabled={busy} onClick={onRefresh}>
          {busy === "snap" ? "Reading Mainnet…" : "Refresh prices"}
        </button>
        <button className="btn" disabled={busy} onClick={onRun}>
          {busy === "run" ? "Running steward…" : "Run steward"}
        </button>
        {busy && (
          <span className="busy">
            <span className="spin" /> {busy === "snap" ? "Public RPC, sequential reads, no gas." : "Pricing, proposing, logging."}
          </span>
        )}
        {snapshot?.at && (
          <span className="hint">Snapshot {new Date(snapshot.at * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC</span>
        )}
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Multiplier</th>
              <th>NAV</th>
              <th>Source</th>
              <th>Age</th>
              <th>Status</th>
              <th className="r">DEX vs NAV</th>
              <th className="r">UI shares</th>
              <th className="r">Value</th>
              <th className="r">Weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sym, a, pos, alloc }) => (
              <tr key={sym}>
                <td>
                  <div className="mono">{sym}</div>
                  <div className="hint">{a.name || "—"}</div>
                </td>
                <td className="num">
                  {a.uiMultiplierWad ? wad(a.uiMultiplierWad) : "—"}
                  {a.pendingCorporateAction && (
                    <div className="flag pending_corporate_action">pending CA</div>
                  )}
                </td>
                <td className="num">{a.navE8 ? usd(a.navE8) : "—"}</td>
                <td className="hint">{a.navSource || "—"}</td>
                <td className="num">{age(a.ageSec)}</td>
                <td>
                  {a.stale && <span className="flag stale">stale</span>}
                  {a.heldOffHours && !a.stale && <span className="flag held_off_hours">held off-hours</span>}
                  {!a.stale && !a.heldOffHours && !a.missing && <span className="hint">fresh</span>}
                  {a.missing && <span className="flag unpriced">missing</span>}
                </td>
                <td className="r">
                  {a.market?.ok && a.premiumBps != null ? (
                    <>
                      <div className={`num${Math.abs(Number(a.premiumBps)) >= 100 ? " flag dex_premium" : ""}`}>
                        {signedBps(a.premiumBps)}
                      </div>
                      <div className="hint">{usd(a.marketE8)} · {dexNote(a.market)}</div>
                    </>
                  ) : a.market ? (
                    <span className="hint" title={a.market.reason || ""}>no DEX market</span>
                  ) : (
                    <span className="hint">—</span>
                  )}
                </td>
                <td className="num r">{alloc?.ui != null ? shares(alloc.ui, a.decimals) : pos ? shares(pos.raw, a.decimals) : "—"}</td>
                <td className="num r">{alloc ? usd(alloc.valueE8) : "—"}</td>
                <td className="r">
                  {alloc ? (
                    <>
                      <div className="bar" title={pctBps(alloc.weightBps)}>
                        <span style={{ width: `${Math.min(100, (alloc.weightBps || 0) / 100)}%` }} />
                      </div>
                      <div className="num">{pctBps(alloc.weightBps)}</div>
                    </>
                  ) : (
                    <span className="hint">run the steward</span>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={7}>Cash</td>
              <td className="num r">—</td>
              <td className="num r">{current?.cash ? usd(current.cash.valueE8) : mandate?.cashE8 ? usd(mandate.cashE8) : "—"}</td>
              <td className="num r">{current?.cash ? pctBps(current.cash.weightBps) : "—"}</td>
            </tr>
          </tbody>
        </table>
        {lastRun?.proposal?.totalE8 && (
          <p className="hint" style={{ margin: "14px 0 0" }}>
            Book {usd(lastRun.proposal.totalE8)}
            {lastRun.proposal.maxDriftBps != null ? ` · max drift ${lastRun.proposal.maxDriftBps} bps` : ""}
          </p>
        )}
      </div>
    </section>
  );
}

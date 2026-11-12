import { usd } from "../format.js";

const ALL = ["AAPLc", "AMZNc", "GOOGLc", "METAc", "MSFTc", "MSTRc", "NVDAc", "SNDKc", "SPCXc", "TSLAc"];

export default function Mandate({ form, setForm, onSave, busy, mandateTx, snapshot }) {
  const toggle = (sym) => {
    setForm((f) => {
      const has = f.universe.includes(sym);
      return { ...f, universe: has ? f.universe.filter((s) => s !== sym) : [...f.universe, sym] };
    });
  };
  const setHold = (sym, usdVal) => {
    setForm((f) => ({ ...f, holdingsUsd: { ...f.holdingsUsd, [sym]: usdVal } }));
  };
  return (
    <section>
      <h2 className="section">Mandate</h2>
      <p className="sub">
        The steward equal-weights the names you pick, respects the cap and cash sleeve, and
        only proposes a rebalance when drift exceeds your threshold. Never auto-spend is locked on.
      </p>
      <div className="card">
        <h3>Universe</h3>
        <div className="universe">
          {ALL.map((sym) => (
            <label key={sym}>
              <input type="checkbox" checked={form.universe.includes(sym)} onChange={() => toggle(sym)} />
              {sym}
            </label>
          ))}
        </div>
        <div className="fields">
          <label>
            Max weight %
            <input
              type="number"
              min="1"
              max="100"
              value={(form.maxWeightBps / 100).toString()}
              onChange={(e) => setForm((f) => ({ ...f, maxWeightBps: Math.round(Number(e.target.value) * 100) }))}
            />
          </label>
          <label>
            Cash sleeve %
            <input
              type="number"
              min="0"
              max="90"
              value={(form.cashSleeveBps / 100).toString()}
              onChange={(e) => setForm((f) => ({ ...f, cashSleeveBps: Math.round(Number(e.target.value) * 100) }))}
            />
          </label>
          <label>
            Threshold (bps)
            <input
              type="number"
              min="1"
              max="5000"
              value={form.rebalanceThresholdBps}
              onChange={(e) => setForm((f) => ({ ...f, rebalanceThresholdBps: Number(e.target.value) }))}
            />
          </label>
          <label>
            Cash (USD)
            <input
              type="number"
              min="0"
              value={form.cashUsd}
              onChange={(e) => setForm((f) => ({ ...f, cashUsd: e.target.value }))}
            />
          </label>
        </div>
        <h3>Starting paper holdings (USD)</h3>
        {form.universe.map((sym) => (
          <div className="hold-row" key={sym}>
            <span className="mono">{sym}</span>
            <input
              type="number"
              min="0"
              value={form.holdingsUsd[sym] ?? 0}
              onChange={(e) => setHold(sym, e.target.value)}
            />
            <span className="hint">{snapshot?.assets?.[sym] ? "priced" : "needs a price refresh"}</span>
          </div>
        ))}
        <div className="row" style={{ marginTop: 18, marginBottom: 0 }}>
          <button className="btn" disabled={busy} onClick={onSave}>
            {busy === "mandate" ? "Saving…" : "Save mandate to local log"}
          </button>
          {mandateTx && (
            <span className="hint mono">
              hash {mandateTx.mandateHash?.slice(0, 10)}… · tx {mandateTx.hash?.slice(0, 10)}… ·{" "}
              {mandateTx.tagged ? "Builder Code on" : "Builder Code not issued"}
            </span>
          )}
        </div>
        {form.positions?.length ? (
          <p className="hint" style={{ marginTop: 14 }}>
            Current paper raw units are set from the last save or approval.
            {form.positions.map((p) => ` ${p.symbol} raw ${p.raw}`).join(" ·")}
            {form.cashE8 ? ` · cash ${usd(form.cashE8)}` : ""}
          </p>
        ) : null}
        <p className="hint" style={{ marginTop: 10 }}>Never auto-spend is on and cannot be turned off in this build.</p>
      </div>
    </section>
  );
}

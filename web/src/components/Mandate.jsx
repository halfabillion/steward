import { usd } from "../format.js";

const ALL = ["AAPLc", "AMZNc", "GOOGLc", "METAc", "MSFTc", "MSTRc", "NVDAc", "SNDKc", "SPCXc", "TSLAc"];

export default function Mandate({ form, setForm, onSave, onResetDefaults, busy, mandateTx, snapshot }) {
  const toggle = (sym) => {
    setForm((f) => {
      const has = f.universe.includes(sym);
      return { ...f, universe: has ? f.universe.filter((s) => s !== sym) : [...f.universe, sym] };
    });
  };
  const setHold = (sym, usdVal) => {
    setForm((f) => ({ ...f, holdingsUsd: { ...f.holdingsUsd, [sym]: usdVal } }));
  };
  const emptyUniverse = !form.universe?.length;
  return (
    <section data-testid="mandate-panel">
      <h2 className="section">Step 1 — Mandate</h2>
      <p className="sub">
        Demo defaults are ready: a 7-name equal-weight basket, 30% cap, 10% cash sleeve,
        200 bps rebalance threshold, $10,000 cash and $90,000 in AAPLc. That concentrated
        book is what produces a clear first rebalance. Never auto-spend is locked on.
      </p>
      <div className="card">
        <h3>Universe</h3>
        <div className="universe">
          {ALL.map((sym) => (
            <label key={sym}>
              <input
                type="checkbox"
                data-testid={`universe-${sym}`}
                checked={form.universe.includes(sym)}
                onChange={() => toggle(sym)}
              />
              {sym}
            </label>
          ))}
        </div>
        {emptyUniverse && (
          <p className="empty-warn" role="status">
            Pick at least one name. Or reset to the demo defaults.
          </p>
        )}
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
            <span className="field-hint">Default 30. Caps any single name.</span>
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
            <span className="field-hint">Default 10. Held as cash, not invested.</span>
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
            <span className="field-hint">Default 200. Only propose when drift exceeds this.</span>
          </label>
          <label>
            Cash (USD)
            <input
              type="number"
              min="0"
              value={form.cashUsd}
              onChange={(e) => setForm((f) => ({ ...f, cashUsd: e.target.value }))}
            />
            <span className="field-hint">Default 10,000. Starting paper cash.</span>
          </label>
        </div>
        <h3>Starting paper holdings (USD)</h3>
        {form.universe.length === 0 ? (
          <p className="empty">No names selected, so there are no holdings to set.</p>
        ) : (
          form.universe.map((sym) => (
            <div className="hold-row" key={sym}>
              <span className="mono">{sym}</span>
              <input
                type="number"
                min="0"
                data-testid={`holding-${sym}`}
                value={form.holdingsUsd[sym] ?? 0}
                onChange={(e) => setHold(sym, e.target.value)}
              />
              <span className="hint">{snapshot?.assets?.[sym] ? "priced" : "will be priced when you run"}</span>
            </div>
          ))
        )}
        <div className="row" style={{ marginTop: 18, marginBottom: 0 }}>
          <button
            className="btn"
            data-testid="save-mandate"
            disabled={Boolean(busy) || emptyUniverse}
            onClick={onSave}
          >
            {busy === "mandate" ? "Saving…" : "Save mandate to local log"}
          </button>
          <button
            className="btn ghost"
            type="button"
            data-testid="reset-demo-defaults"
            disabled={Boolean(busy)}
            onClick={onResetDefaults}
          >
            Reset to demo defaults
          </button>
          {mandateTx && (
            <span className="hint mono" data-testid="mandate-saved">
              Saved · hash {mandateTx.mandateHash?.slice(0, 10)}… · tx {mandateTx.hash?.slice(0, 10)}… ·{" "}
              {mandateTx.tagged ? "Builder Code on" : "Builder Code not issued"}
            </span>
          )}
        </div>
        {mandateTx && (
          <div className="ok-banner" data-testid="mandate-next">
            Mandate is on the local log. Next: run the steward to produce a proposal.
          </div>
        )}
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

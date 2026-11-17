import { pctBps, shortHash, usd } from "../format.js";
import TxLink from "./TxLink.jsx";

export default function Proposal({
  lastRun,
  hasMandate,
  onApprove,
  onReject,
  onRun,
  onSchedule,
  onStop,
  onViewLog,
  schedule,
  intervalSec,
  setIntervalSec,
  maxRuns,
  setMaxRuns,
  busy,
  live,
}) {
  const p = lastRun?.proposal;
  const onchain = lastRun?.onchain;
  const explanation = lastRun?.explanation;
  const paragraphs = explanation?.paragraphs || p?.explanation || [];
  const action = p?.action || lastRun?.action || "none";
  const proposalId = onchain?.proposalId;
  const status = onchain?.status;
  const decided = status === "Approved" || status === "Rejected";

  if (!p) {
    return (
      <section data-testid="proposal-panel">
        <h2 className="section">Step 2 — Proposal</h2>
        <p className="sub">Run the steward to price the paper book and produce a proposal with reasons.</p>
        {!hasMandate ? (
          <div className="empty" data-testid="proposal-need-mandate">
            <strong>Save a mandate first.</strong>
            <p>
              Step 1 writes the mandate to the local log. Until that is saved, the steward
              has nothing new to propose against.
            </p>
          </div>
        ) : (
          <div className="empty" data-testid="proposal-ready-to-run">
            <strong>Mandate saved. Ready to run.</strong>
            <p>
              With the demo defaults this should propose a rebalance: sell some AAPLc,
              buy the other six names, and keep a 10% cash sleeve. The run also reads
              live Mainnet NAVs (read-only, no gas) and writes a Proposed event on the
              local chain (id 84532).
            </p>
            <button className="btn" data-testid="run-steward" disabled={Boolean(busy)} onClick={onRun}>
              {busy === "run" ? "Running steward…" : "Run steward"}
            </button>
            {busy === "run" && (
              <span className="busy">
                <span className="spin" /> Pricing the book, proposing, and logging.
              </span>
            )}
          </div>
        )}
        <Scheduler
          onSchedule={live ? undefined : onSchedule}
          onStop={onStop}
          schedule={schedule}
          intervalSec={intervalSec}
          setIntervalSec={setIntervalSec}
          maxRuns={maxRuns}
          setMaxRuns={setMaxRuns}
          busy={busy}
        />
      </section>
    );
  }

  return (
    <section data-testid="proposal-panel">
      <h2 className="section">
        {action === "rebalance" && (status === "Proposed" || status === "Approved" || status === "Rejected")
          ? "Step 3 — Paper fill"
          : "Step 2 — Proposal"}
      </h2>
      <p className="sub">
        Review the research brief and reasons, then approve or reject. Approval records on the
        {live ? " Base Sepolia log" : " local log"} and, for a rebalance, updates the paper book. No funds move.
      </p>
      <div className={`banner ${action}`} data-testid="proposal-banner">
        <div>
          <strong>{action}</strong>
          <div className="hint">
            {explanation?.title ? `${explanation.title} · ` : ""}
            {p.code ? `${p.code} · ` : ""}
            {proposalId ? `id ${shortHash(proposalId)} · ` : "not yet on the log · "}
            body {shortHash(onchain?.proposalHash)}
            {onchain?.tagged ? " · Builder Code tagged" : " · Builder Code not issued"}
            {onchain?.tx ? <> · tx <TxLink hash={onchain.tx} url={onchain.txUrl} live={live} testid="propose-tx-link" /></> : ""}
            {onchain?.decisionTx ? <> · decision <TxLink hash={onchain.decisionTx} url={onchain.decisionTxUrl} live={live} testid="decision-tx-link" /></> : ""}
          </div>
        </div>
        {p.maxDriftBps != null && <div className="num">max drift {p.maxDriftBps} bps</div>}
      </div>

      {status === "Approved" && (
        <div className="ok-banner" data-testid="fill-complete">
          Paper fill recorded. The paper book now matches the target weights. No funds moved.
          Next: open the proposal log and confirm MandateSet, Proposed, and Approved.
          <div className="row" style={{ margin: "12px 0 0" }}>
            <button className="btn" type="button" data-testid="view-log-from-fill" onClick={onViewLog}>
              View the proposal log
            </button>
          </div>
        </div>
      )}
      {status === "Rejected" && (
        <div className="empty-warn" data-testid="fill-rejected">
          {live
            ? "Proposal rejected. The decision is on Base Sepolia, but the paper book was not updated. To see a paper fill, run again and approve."
            : "Proposal rejected. The decision is on the local log, but the paper book was not updated. To see a paper fill, run again and approve."}
        </div>
      )}

      <div className="grid-2">
        <div className="card explain">
          <h3>Why</h3>
          {paragraphs.length ? (
            paragraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))
          ) : (
            <p className="empty">No explanation text on this run.</p>
          )}
        </div>
        <div className="card">
          <h3>Reasons</h3>
          {(p.reasons || explanation?.reasons || []).length ? (
            <ul className="reasons">
              {(p.reasons || explanation?.reasons || []).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="empty">No structured reasons on this run.</p>
          )}
        </div>
      </div>

      {p.trades?.length ? (
        <div className="card" style={{ overflowX: "auto" }}>
          <h3>Proposed trades (paper)</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Side</th>
                <th>Name</th>
                <th className="r">USD</th>
                <th className="r">From</th>
                <th className="r">To</th>
              </tr>
            </thead>
            <tbody>
              {p.trades.map((t, i) => (
                <tr key={i}>
                  <td className="mono">{t.side}</td>
                  <td className="mono">{t.symbol}</td>
                  <td className="num r">{usd(t.valueE8 ?? t.usdE8)}</td>
                  <td className="num r">{t.fromValueE8 != null ? usd(t.fromValueE8) : "—"}</td>
                  <td className="num r">{t.toValueE8 != null ? usd(t.toValueE8) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        action !== "rebalance" && (
          <div className="empty">
            No paper trades on this run
            {action === "hold" ? " — weights are inside the threshold." : "."}
          </div>
        )
      )}

      {p.target && (
        <div className="card" style={{ overflowX: "auto" }}>
          <h3>Target vs current</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th className="r">Current</th>
                <th className="r">Target</th>
                <th>Allocation</th>
                <th className="r">Drift</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(p.target)
                .filter((k) => k !== "cash")
                .map((sym) => {
                  const t = p.target[sym];
                  const c = p.current?.[sym];
                  const drift = t.driftBps != null
                    ? t.driftBps
                    : Math.abs((c?.weightBps ?? 0) - (t.weightBps ?? 0));
                  return (
                    <tr key={sym}>
                      <td className="mono">{sym}</td>
                      <td className="num r">{c ? usd(c.valueE8) : "—"}</td>
                      <td className="num r">{usd(t.valueE8)}</td>
                      <td>
                        <div className="bar target">
                          <span style={{ width: `${Math.min(100, (t.weightBps || 0) / 100)}%` }} />
                        </div>
                        <div className="num">{pctBps(t.weightBps)}</div>
                      </td>
                      <td className="num r">{drift} bps</td>
                    </tr>
                  );
                })}
              <tr>
                <td>Cash</td>
                <td className="num r">{p.current?.cash ? usd(p.current.cash.valueE8) : "—"}</td>
                <td className="num r">{usd(p.target.cash?.valueE8)}</td>
                <td className="num">{pctBps(p.target.cash?.weightBps)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="row">
        {action === "rebalance" && !decided && proposalId && status === "Proposed" && (
          <button className="btn good" data-testid="approve-fill" disabled={Boolean(busy)} onClick={() => onApprove(proposalId)}>
            {busy === "decide" ? "Approving…" : "Approve (paper fill)"}
          </button>
        )}
        {action !== "rebalance" && !decided && status === "Proposed" && proposalId && (
          <button className="btn good" disabled={Boolean(busy)} onClick={() => onApprove(proposalId)}>
            {busy === "decide" ? "Approving…" : "Approve (record only)"}
          </button>
        )}
        {!decided && status === "Proposed" && proposalId && (
          <button className="btn warn" data-testid="reject-proposal" disabled={Boolean(busy)} onClick={() => onReject(proposalId)}>
            Reject
          </button>
        )}
        {decided && (
          <span className="chip ok" data-testid="proposal-decided">
            {status === "Approved" ? "Approved — paper book updated" : "Rejected"}
          </span>
        )}
        {action !== "rebalance" && !proposalId && (
          <span className="hint">Hold and blocked recommendations are not written to the log. There is no paper fill on this run.</span>
        )}
        <button className="btn ghost" data-testid="run-steward" disabled={Boolean(busy) || !hasMandate} onClick={onRun}>
          {busy === "run" ? "Running steward…" : "Run again"}
        </button>
      </div>

      {live ? (
        <p className="hint" data-testid="live-no-schedule">
          Bounded schedules are disabled in live Base Sepolia mode so a timer cannot send testnet transactions.
        </p>
      ) : (
        <Scheduler
          onSchedule={onSchedule}
          onStop={onStop}
          schedule={schedule}
          intervalSec={intervalSec}
          setIntervalSec={setIntervalSec}
          maxRuns={maxRuns}
          setMaxRuns={setMaxRuns}
          busy={busy}
        />
      )}
    </section>
  );
}

function Scheduler({ onSchedule, onStop, schedule, intervalSec, setIntervalSec, maxRuns, setMaxRuns, busy }) {
  const done = schedule ? (schedule.runsDone ?? (schedule.maxRuns - (schedule.remaining ?? 0))) : 0;
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3>Bounded schedule</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Optional, and not part of the four-step demo. Requires a max-run cap (1–6) and an interval
        of 60–3600 seconds. Stops on its own. Never an unbounded loop. The first run waits one full interval.
      </p>
      {schedule?.running ? (
        <div className="row" style={{ marginBottom: 0 }}>
          <span className="chip hold">
            running {done}/{schedule.maxRuns} · every {schedule.intervalSec}s
            {schedule.nextAt ? ` · next ${new Date(schedule.nextAt).toISOString().slice(11, 19)} UTC` : ""}
          </span>
          <button className="btn warn small" onClick={onStop} disabled={Boolean(busy)}>
            Stop schedule
          </button>
        </div>
      ) : (
        <div className="row" style={{ marginBottom: 0 }}>
          <label className="hint">
            Interval (s){" "}
            <input
              type="number"
              min="60"
              max="3600"
              value={intervalSec}
              onChange={(e) => setIntervalSec(Number(e.target.value))}
              style={{ width: 88, marginLeft: 6 }}
            />
          </label>
          <label className="hint">
            Max runs{" "}
            <input
              type="number"
              min="1"
              max="6"
              value={maxRuns}
              onChange={(e) => setMaxRuns(Number(e.target.value))}
              style={{ width: 64, marginLeft: 6 }}
            />
          </label>
          <button className="btn ghost" disabled={Boolean(busy)} onClick={onSchedule}>
            Start bounded schedule
          </button>
        </div>
      )}
    </div>
  );
}

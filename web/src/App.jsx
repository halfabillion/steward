import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { shortAddr } from "./format.js";
import Gate from "./components/Gate.jsx";
import Mandate from "./components/Mandate.jsx";
import Portfolio from "./components/Portfolio.jsx";
import Proposal from "./components/Proposal.jsx";
import Log from "./components/Log.jsx";

const TABS = [
  { id: "mandate", label: "Mandate" },
  { id: "portfolio", label: "Portfolio" },
  { id: "proposal", label: "Proposal" },
  { id: "log", label: "On-chain log" },
];

function defaultForm() {
  return {
    universe: ["AAPLc", "AMZNc", "GOOGLc", "METAc", "MSFTc", "NVDAc", "TSLAc"],
    maxWeightBps: 3000,
    cashSleeveBps: 1000,
    rebalanceThresholdBps: 200,
    cashUsd: 10000,
    holdingsUsd: { AAPLc: 90000 },
    neverAutoSpend: true,
  };
}

export default function App() {
  const [elig, setElig] = useState(null);
  const [checked, setChecked] = useState({});
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState("mandate");
  const [status, setStatus] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [mandateTx, setMandateTx] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [intervalSec, setIntervalSec] = useState(60);
  const [maxRuns, setMaxRuns] = useState(2);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    api
      .eligibility(tz)
      .then(setElig)
      .catch((e) => setError(e.message));
  }, []);

  const applyStatus = useCallback((s) => {
    setStatus(s);
    setSchedule(s.schedule);
    if (s.snapshot) setSnapshot(s.snapshot);
    if (s.lastRun) setLastRun(s.lastRun);
    if (s.mandateTx) setMandateTx(s.mandateTx);
    if (s.mandate) {
      setForm((f) => ({
        ...f,
        universe: s.mandate.universe,
        maxWeightBps: s.mandate.maxWeightBps,
        cashSleeveBps: s.mandate.cashSleeveBps,
        rebalanceThresholdBps: s.mandate.rebalanceThresholdBps,
        neverAutoSpend: true,
        positions: s.mandate.positions,
        cashE8: s.mandate.cashE8,
      }));
    }
    return s;
  }, []);

  const loadStatus = useCallback(async () => {
    return applyStatus(await api.status());
  }, [applyStatus]);

  const refreshLog = useCallback(async () => {
    const l = await api.log();
    setEvents(l.entries || l.events || []);
    return l;
  }, []);

  useEffect(() => {
    if (!entered) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await loadStatus();
        await refreshLog();
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    const t = window.setInterval(async () => {
      try {
        const s = await api.status();
        if (cancelled) return;
        applyStatus(s);
      } catch {
        /* ignore poll errors */
      }
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [entered, loadStatus, refreshLog, applyStatus]);

  async function wrap(name, fn) {
    setBusy(name);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveMandate() {
    await wrap("mandate", async () => {
      const holdingsUsd = {};
      for (const [k, v] of Object.entries(form.holdingsUsd || {})) {
        holdingsUsd[k] = Number(v) || 0;
      }
      const res = await api.saveMandate({
        universe: form.universe,
        maxWeightBps: form.maxWeightBps,
        cashSleeveBps: form.cashSleeveBps,
        rebalanceThresholdBps: form.rebalanceThresholdBps,
        cashUsd: Number(form.cashUsd) || 0,
        holdingsUsd,
        neverAutoSpend: true,
      });
      setMandateTx(res.tx || res);
      await loadStatus();
      await refreshLog();
    });
  }

  async function refreshSnap() {
    await wrap("snap", async () => {
      const s = await api.snapshot();
      setSnapshot(s.snapshot || s);
    });
  }

  async function runAgent() {
    await wrap("run", async () => {
      const r = await api.runAgent();
      setLastRun(r);
      setSnapshot(r.snapshot);
      setTab("proposal");
      await loadStatus();
      await refreshLog();
    });
  }

  async function decide(kind, id) {
    await wrap("decide", async () => {
      const r = kind === "approve" ? await api.approve(id) : await api.reject(id);
      setLastRun((prev) => ({
        ...(prev || {}),
        ...(r.lastRun || {}),
        snapshot: (r.lastRun && r.lastRun.snapshot) || prev?.snapshot,
      }));
      await loadStatus();
      await refreshLog();
    });
  }

  async function startSchedule() {
    await wrap("sched", async () => {
      const r = await api.schedule({ intervalSec, maxRuns });
      setSchedule(r.schedule);
    });
  }

  async function stopSchedule() {
    await wrap("sched", async () => {
      const r = await api.stopSchedule();
      setSchedule(r.schedule);
    });
  }

  if (!elig) {
    return (
      <div className="gate">
        <p className="hint">{error || "Checking eligibility…"}</p>
      </div>
    );
  }

  if (!entered) {
    return (
      <Gate
        eligibility={elig}
        blocked={!elig.allowed}
        checked={checked}
        onToggle={(id) => setChecked((c) => ({ ...c, [id]: !c[id] }))}
        onEnter={() => setEntered(true)}
      />
    );
  }

  const chainId = status?.chainId ?? status?.network?.chainId;
  const action = lastRun?.proposal?.action || lastRun?.action;

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <h1>Steward</h1>
          <span className="tag">research-to-portfolio agent · paper &amp; testnet only</span>
        </div>
        <div className="meta">
          {status && <span className="chip ok">local · chain {chainId}</span>}
          {status?.builderCode?.status === "not_issued" && (
            <span className="chip">Builder Code not issued</span>
          )}
          {action && <span className={`chip ${action}`}>{action}</span>}
          {schedule?.running && (
            <span className="chip hold">
              schedule {schedule.runsDone ?? (schedule.maxRuns - (schedule.remaining ?? 0))}/{schedule.maxRuns}
            </span>
          )}
          {status?.contract && <span className="chip blue">{shortAddr(status.contract)}</span>}
        </div>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main className="main">
        {error && <div className="err">{error}</div>}
        {tab === "mandate" && (
          <Mandate form={form} setForm={setForm} onSave={saveMandate} busy={busy} mandateTx={mandateTx} snapshot={snapshot} />
        )}
        {tab === "portfolio" && (
          <Portfolio
            snapshot={snapshot}
            mandate={status?.mandate}
            lastRun={lastRun}
            onRefresh={refreshSnap}
            onRun={runAgent}
            busy={busy}
          />
        )}
        {tab === "proposal" && (
          <Proposal
            lastRun={lastRun}
            onApprove={(id) => decide("approve", id)}
            onReject={(id) => decide("reject", id)}
            onRun={runAgent}
            onSchedule={startSchedule}
            onStop={stopSchedule}
            schedule={schedule}
            intervalSec={intervalSec}
            setIntervalSec={setIntervalSec}
            maxRuns={maxRuns}
            setMaxRuns={setMaxRuns}
            busy={busy}
          />
        )}
        {tab === "log" && <Log events={events} status={status} onRefresh={refreshLog} busy={busy} />}
      </main>
      <footer className="foot">
        Paper and testnet only. Never auto-spends. Not investment advice, not a brokerage, not an offer
        or solicitation. Tokenized stocks do not confer shareholder rights. Not available in the United
        States. Steward is not endorsed by Coinbase, Base, or any issuer.
      </footer>
    </div>
  );
}

import { shortAddr, shortHash, when } from "../format.js";
import TxLink from "./TxLink.jsx";

const DEMO_KINDS = ["MandateSet", "Proposed", "Approved"];

export default function Log({ events, status, onRefresh, onStart, complete, approved, rejected, busy, live }) {
  const kinds = new Set((events || []).map((e) => e.type || e.kind));
  const missing = DEMO_KINDS.filter((k) => !kinds.has(k));
  return (
    <section data-testid="log-panel">
      <h2 className="section">Step 4 — Proposal log</h2>
      <p className="sub">
        {live
          ? "StewardProposalLog on Base Sepolia (chain id 84532). Session events since this app started are listed below. Each transaction links to Blockscout. The contract never moves funds."
          : "StewardProposalLog on the in-process Hardhat network, tagged chain id 84532 (Base Sepolia’s id, used here for realism). Nothing is deployed to a public chain."}
      </p>
      {complete && approved && (
        <div className="ok-banner" data-testid="demo-complete">
          {live
            ? "Demo complete. This Base Sepolia log shows MandateSet, Proposed, and Approved, with Blockscout links in the Tx column. The paper book was updated on approval. No funds moved."
            : "Demo complete. This local log shows MandateSet, Proposed, and Approved. The paper book was updated on approval. No funds moved, and this contract is not on a public network."}
        </div>
      )}
      {complete && rejected && !approved && (
        <div className="empty-warn" data-testid="demo-rejected-log">
          The log has MandateSet, Proposed, and Rejected. There was no paper fill. To complete the
          happy path, run a new proposal and approve it.
        </div>
      )}
      <div className="row">
        <button className="btn ghost" data-testid="refresh-log" disabled={Boolean(busy)} onClick={onRefresh}>
          Refresh log
        </button>
        {status?.contract && (
          <span className="hint mono" data-testid="log-contract">
            contract{" "}
            {live && status?.network?.contractUrl ? (
              <a href={status.network.contractUrl} target="_blank" rel="noreferrer" data-testid="contract-link">
                {status.contract}
              </a>
            ) : (
              status.contract
            )}{" "}
            · owner {shortAddr(status.owner)} · agent {shortAddr(status.agent)}
            {status?.chainId || status?.network?.chainId
              ? ` · chain ${status.chainId ?? status.network.chainId}`
              : ""}
          </span>
        )}
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        {(!events || events.length === 0) && (
          <div className="empty" data-testid="log-empty">
            <strong>No events yet.</strong>
            <p>Start at Step 1 — save a mandate to write the first MandateSet entry on this local log.</p>
            {onStart && (
              <button className="btn" type="button" onClick={onStart}>
                Go to Step 1 — Mandate
              </button>
            )}
          </div>
        )}
        {events?.length > 0 && (
          <table className="data" data-testid="log-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Block</th>
                <th>Ids / hashes</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => {
                const kind = e.type || e.kind;
                const tx = e.tx || e.txHash;
                const highlight = DEMO_KINDS.includes(kind) || kind === "Rejected";
                return (
                  <tr key={`${tx}-${kind}-${i}`} data-kind={kind} className={highlight ? "log-demo-row" : ""}>
                    <td className="num">{when(e.at)}</td>
                    <td className="mono">{kind}</td>
                    <td className="num">{e.block}</td>
                    <td className="mono hint">
                      {e.proposalId ? <div>id {shortHash(e.proposalId)}</div> : null}
                      {e.mandateHash ? <div>mandate {shortHash(e.mandateHash)}</div> : null}
                      {e.researchHash ? <div>research {shortHash(e.researchHash)}</div> : null}
                      {e.proposalHash ? <div>body {shortHash(e.proposalHash)}</div> : null}
                      {e.status ? <div>status {e.status}</div> : null}
                      {e.reason ? <div>{e.reason}</div> : null}
                    </td>
                    <td className="mono hint">
                      <TxLink hash={tx} url={e.txUrl} live={live} testid={`log-tx-link-${i}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {events?.length > 0 && missing.length > 0 && !rejected && (
          <p className="hint" style={{ margin: "14px 0 0" }} data-testid="log-missing">
            Still waiting on: {missing.join(", ")}.
          </p>
        )}
      </div>
    </section>
  );
}

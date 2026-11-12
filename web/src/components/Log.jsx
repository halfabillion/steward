import { shortAddr, shortHash, when } from "../format.js";

export default function Log({ events, status, onRefresh, busy }) {
  return (
    <section>
      <h2 className="section">On-chain log</h2>
      <p className="sub">
        StewardProposalLog on the in-process Hardhat network, tagged chain id 84532 (Base Sepolia’s
        id, used here for realism). Nothing is deployed to a public chain.
      </p>
      <div className="row">
        <button className="btn ghost" disabled={busy} onClick={onRefresh}>
          Refresh log
        </button>
        {status?.contract && (
          <span className="hint mono">
            contract {status.contract} · owner {shortAddr(status.owner)} · agent {shortAddr(status.agent)}
          </span>
        )}
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        {(!events || events.length === 0) && <p className="hint">No events yet. Save a mandate or run the steward.</p>}
        {events?.length > 0 && (
          <table className="data">
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
                return (
                  <tr key={`${tx}-${kind}-${i}`}>
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
                    <td className="mono hint">{shortHash(tx)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

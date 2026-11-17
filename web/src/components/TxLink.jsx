import { shortHash } from "../format.js";

/** Blockscout (or other) tx link in live mode; otherwise a shortened hash. */
export default function TxLink({ hash, url, live, testid = "tx-link" }) {
  if (!hash) return "—";
  if (live && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="tx-link"
        data-testid={testid}
      >
        {shortHash(hash)}
        <span aria-hidden="true"> ↗</span>
      </a>
    );
  }
  return <span className="mono hint">{shortHash(hash)}</span>;
}

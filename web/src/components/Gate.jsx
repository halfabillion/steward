export default function Gate({ eligibility, checked, onToggle, onEnter, blocked }) {
  const allOn = eligibility.items?.every((i) => checked[i.id]);
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="mark">
          <h1>Steward</h1>
          <span className="dot" />
        </div>
        <p className="lede">
          A research-to-portfolio agent for Coinbase tokenized stocks on Base.
          Paper and testnet only. Never auto-spends.
        </p>

        <h2>Availability</h2>
        {blocked ? (
          <div className="blocked">
            <strong>Access refused.</strong>
            <p style={{ margin: "8px 0 0" }}>{eligibility.reason}</p>
            <p style={{ margin: "8px 0 0" }}>
              Steward is not offered to persons in the United States. There is no bypass.
            </p>
          </div>
        ) : (
          <>
            <div className="legal">
              <p>
                Coinbase tokenized stocks are available only to persons in eligible
                jurisdictions outside the United States. Steward does not offer live
                trading. Approvals are recorded on a local log (chain id 84532) and
                update a paper portfolio only.
              </p>
              <p>
                This is not investment, legal, or tax advice, not a brokerage, and not
                an offer or solicitation to buy or sell any security or tokenized stock.
                Tokenized stocks do not confer shareholder rights in the underlying
                company. Steward is not endorsed by Coinbase, Base, or any issuer.
              </p>
            </div>
            <div className="attest">
              {(eligibility.items || []).map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={Boolean(checked[item.id])}
                    onChange={() => onToggle(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <button className="btn" disabled={!allOn} onClick={onEnter}>
              Enter Steward
            </button>
          </>
        )}
      </div>
    </div>
  );
}

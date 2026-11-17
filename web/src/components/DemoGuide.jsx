export default function DemoGuide({ progress, onPrimary, onGoTab, busy }) {
  const { steps, complete, current, nextLabel, message } = progress;
  const currentN = steps.find((s) => s.id === current)?.n;
  return (
    <aside className="demo-guide" aria-label="Guided demo" data-testid="demo-guide">
      <div className="demo-guide-head">
        <span className="demo-kicker">Guided demo</span>
        <span className="hint" data-testid="demo-progress-label">
          {complete ? "All four steps complete" : `Step ${currentN} of 4`}
        </span>
      </div>
      <ol className="demo-steps">
        {steps.map((s) => (
          <li key={s.id} className={s.status}>
            <button
              type="button"
              className="demo-step-btn"
              data-testid={`demo-step-${s.id}`}
              data-status={s.status}
              onClick={() => onGoTab(s.tab)}
              aria-current={s.status === "current" ? "step" : undefined}
            >
              <span className="demo-n" aria-hidden="true">
                {s.status === "done" ? "✓" : s.status === "rejected" ? "×" : s.n}
              </span>
              <span className="demo-step-label">{s.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="demo-msg" data-testid="demo-message">
        {message}
      </p>
      {nextLabel && (
        <button
          className="btn"
          data-testid="demo-primary"
          disabled={Boolean(busy)}
          onClick={onPrimary}
        >
          {busy ? "Working…" : nextLabel}
        </button>
      )}
    </aside>
  );
}

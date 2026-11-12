# Steward

Research-to-portfolio agent for Coinbase tokenized stocks on Base. Paper and testnet only. Never auto-spends. Not investment advice, not a brokerage, not available in the United States.

This folder is the local build for the Base Stocks Maxxing season (Agentic Stock Finance). Contest plan: `../PLAN.md`. Spike findings: `SPIKE.md`. Core app status and how to run: `CORE.md`.

```bash
npm install          # project-local only
npm test             # engine, eligibility, explain, paper, and local contract tests
npm run dev          # http://127.0.0.1:5173 — in-process Hardhat (84532) + API + web app
                     # stop with Ctrl-C; one process, loopback only
npm run spike        # optional live read-only Mainnet + API probe (no keys, no gas)
```

No public deploy, no faucet in this tree, no wallet keys in the repo, no remote git. Do not add a GitHub remote, do not point Hardhat at a public chain, and do not send mainnet assets to the testnet deployer (address in `CORE.md`).

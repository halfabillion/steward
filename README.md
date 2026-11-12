# Steward (spike)

Research-to-portfolio agent for Coinbase tokenized stocks on Base. This folder is a local spike for the Stocks Maxxing season (Agentic Stock Finance). See `../PLAN.md` for the contest plan and `SPIKE.md` for what this milestone proved.

```bash
npm install          # project-local only
npm run spike        # live read-only Mainnet + API probe (no keys, no gas)
npm run test:engine  # mandate → proposal unit tests (offline)
npm run compile      # compile the Sepolia-oriented log contract
npm run test         # engine tests + local Hardhat contract tests
```

No deploy, no faucet, no wallet, no remote git. Do not add a GitHub remote or run a deploy script.

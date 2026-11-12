# Steward — core build (milestone 2)

Local research-to-portfolio agent for Coinbase tokenized stocks on Base. Paper and a local Hardhat chain tagged 84532 only. This is not a live product, not investment advice, and not available in the United States.

The spike findings in `SPIKE.md` still hold. This file is the status of the core app.

## Status

Done, locally:

- Polished web app (Vite + React, served from the same process as the API).
- Mandate setup, live portfolio / NAV with multiplier and corporate-action flags, proposal review with rule-based reasons, approve / reject, on-chain log.
- On-demand steward run, plus an optional bounded schedule (`maxRuns` 1–6 required, interval 60–3600s, first run waits one interval, stops itself). No unbounded loops.
- US geo-gate: US timezone or country is a hard block with no bypass. `America/St_Johns` is treated as Canada, not the US. Everyone else must attest (18+, not a US person, not advice, no shareholder rights, paper / testnet only).
- Contract integration on an in-process Hardhat network tagged 84532. Ready to point at Base Sepolia later. **Not deployed to any public chain in this milestone.**
- ERC-8021 Builder Code hook (`src/builderCode.js`): calldata is left unchanged until a real code is issued (`BUILDER_CODE = null`).
- Paper fill on rebalance approval. Never auto-spend is locked on. No funds move.
- 24 Node tests + 6 contract tests, all green.
- A fresh **testnet-only** Base Sepolia deployer key, stored outside the repo. Public address only, below. Not funded. Not used. Do not send mainnet assets to it.

## How to run

Project-local Node only, from this directory. One process, bound to loopback:

```bash
npm install          # already done in this tree
npm test             # 24 engine / eligibility / hash / paper / explain tests + 6 contract tests
npm run dev          # http://127.0.0.1:5173  — stop with Ctrl-C
```

`npm run dev` starts in-process Hardhat (chain id 84532), deploys `StewardProposalLog` to that in-memory chain, and serves the Express API and Vite app together. It refuses to start on any other network name or chain id. It never prints or writes private keys (Hardhat signers stay in memory).

Optional: `STEWARD_PORT=5173`. Do not point Hardhat at a public RPC. There is no deploy script and no Sepolia URL in `hardhat.config.cjs`.

Default demo book: $90,000 AAPLc + $10,000 cash, equal-weight 7-name universe, 30% cap, 10% cash sleeve, 200 bps threshold. The first “Run steward” therefore proposes a rebalance. Approving records the decision on the local log and updates the paper book; a second run then holds (0 bps drift in the 12 Nov 2026 session).

Live prices are read-only Mainnet `eth_call`s (Chainlink NAV, B20 multiplier) plus the public Tokenized Stocks API. Sequential, no gas, no keys. The public `https://mainnet.base.org` RPC can return HTTP 429; `src/data/rpc.js` retries 429/503 at most three times with a 1s / 2s backoff.

## Architecture

One Node process (`server/dev.cjs` + `server/helpers.cjs`):

| Surface | Role |
| --- | --- |
| In-process Hardhat, chain id 84532 | Owner = account 0, agent = account 1, `StewardProposalLog` deployed in memory only |
| `GET /api/eligibility` | Geo-gate + attestation items |
| `PUT /api/mandate` | Normalise mandate, `setMandate` via `withBuilderCode`, neverAutoSpend forced on |
| `GET /api/snapshot` | Live Mainnet + API snapshot; converts `holdingsUsd` to raw on first price |
| `POST /api/agent/run` | Snapshot → `proposeRebalance` → `explainProposal` → `propose` on rebalance |
| `POST /api/agent/schedule` | Bounded `setTimeout` loop; 409 if already running |
| `POST /api/proposals/:id/approve\|reject` | Owner-only on the log; approve of a rebalance calls `applyPaper` |
| `GET /api/log` | `MandateSet`, `Proposed`, `Approved`, `Rejected` |
| Vite middleware | SPA at `/` (`web/`) |

Rule-based explanations only. Product copy uses “steward”, “agent”, “automated” — never “AI”.

## Screenshots

Taken 12 Nov 2026 around 10:54 UK (Europe/London) against the local app, after a live price run and a paper approval. Headless Chrome, no Playwright.

- [docs/screenshots/01-gate.png](docs/screenshots/01-gate.png) — attestation gate (Europe/London; Enter disabled until all five boxes are checked).
- [docs/screenshots/02-mandate.png](docs/screenshots/02-mandate.png) — universe, caps, starting paper holdings.
- [docs/screenshots/03-portfolio.png](docs/screenshots/03-portfolio.png) — concentrated AAPLc book, Chainlink NAVs, B20 multipliers, held-off-hours flags.
- [docs/screenshots/04-proposal.png](docs/screenshots/04-proposal.png) — rebalance at 7714 bps drift, reasons, paper trades, approved on the local log.
- [docs/screenshots/05-log.png](docs/screenshots/05-log.png) — MandateSet, Proposed, Approved on in-process 84532.

Session numbers at 10:48–10:54 UK on 12 Nov 2026: AAPLc $356.55, AMZNc $266.77, GOOGLc $293.84, METAc $628.65, MSFTc $520.36, NVDAc $163.33, TSLAc $389.10. Multipliers ≠ 1 on GOOGLc, METAc, NVDAc. No pending corporate actions. Book $99,999.99.

## Remaining gaps (not this milestone)

- No Builder Code has been issued. The hook is in place; do not invent a placeholder suffix.
- The Sepolia deployer key exists but is **unfunded**. Do not use a faucet and do not deploy from this milestone. The parent / Ali will handle the faucet separately.
- No public GitHub remote, no posting, no registration, no paid APIs, no sign-ups. Those wait on Ali.
- Public Mainnet RPC rate limits (429) can delay a snapshot; three bounded retries help, a dedicated public endpoint would be sturdier.
- Tokenized Stocks API and Chainlink coverage are the official documented set; names without a feed fall back to the API NAV.
- IndexKit (backup concept in `../PLAN.md`) is not built. Steward is still the go path.
- Judging / eligibility reminders: US-user trading is ineligible; treat the submission deadline as Thu 3 Dec 2026 18:00 UK (contest close Fri 5 Dec 23:59 UK — earlier of the two published times).

## Testnet deployer (address only)

A fresh key was generated with project-local `ethers.Wallet.createRandom()` at the end of this milestone, written to `/workspace/money/hackathons/base-stocks/.secrets/sepolia-deployer.key` with mode 600, outside this git repo. Parent and repo `.gitignore` both exclude `.secrets/` and `*.key`. The key itself is never printed, logged, or committed.

- **Address:** `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F`
- **Network:** Base Sepolia (84532) only
- **Never** send mainnet assets to this address
- Not funded, not used for a deploy or a faucet request in this milestone

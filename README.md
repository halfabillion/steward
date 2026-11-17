# Steward

Research-to-portfolio agent for Coinbase tokenized stocks on Base. Paper and testnet only. Never auto-spends. Not investment advice, not a brokerage, not available in the United States.

This folder is the local build for the Base Stocks Maxxing season (Agentic Stock Finance). Contest plan: `../PLAN.md`. Current status, deadline, judging criteria, remaining work, and questions for Ali: `STATUS.md`. Spike findings: `SPIKE.md`. 12 Nov core write-up: `CORE.md`.

```bash
npm install          # project-local only
npm test             # Node tests (engine, eligibility, explain, paper, premium, API e2e, DEX, guided-demo flow) + 6 local contract tests
npm run demo         # recommended: prints the 4-step path and serves http://127.0.0.1:5173
npm run dev          # same server without the printed walkthrough
                     # stop with Ctrl-C; one process, in-process Hardhat (chain id 84532), loopback only
npm run spike        # optional live read-only Mainnet + API probe (no keys, no gas)
```

## Guided demo

The judge path is **mandate → proposal → paper fill → proposal log**. One command starts it:

```bash
npm run demo
# then open http://127.0.0.1:5173
```

1. **Attest and enter.** Steward is not available in the United States. There is no bypass.
2. **Step 1 — Mandate.** Demo defaults are already filled in: a 7-name basket, 30% cap, 10% cash sleeve, 200 bps threshold, $10,000 cash and $90,000 in AAPLc. Save the mandate to the local log. (Reset to demo defaults if you changed anything.)
3. **Step 2 — Proposal.** Run the steward. The concentrated AAPLc book should produce a rebalance: sell some AAPLc, buy the other names, keep the cash sleeve. The run reads live Mainnet NAVs (read-only, no gas) and writes a `Proposed` event on the in-process chain.
4. **Step 3 — Paper fill.** Approve. The paper book updates to the target weights. No funds move.
5. **Step 4 — Proposal log.** Confirm `MandateSet`, `Proposed`, and `Approved` on chain id 84532.

The UI shows a 4-step guide at the top of the app and will not run the steward until a mandate has been saved. A later “hold” (for example after the paper fill) does not rewind the completed steps.

The local network is **always chain id 84532** (Base Sepolia’s id, used here for realism). It is in-process Hardhat, not a public chain and not a Sepolia deploy.

17 Nov 2026 screenshots of this path: `docs/screenshots/2026-11-17/`. Earlier 12 Nov shots remain in `docs/screenshots/`.

## Deploy (Base Sepolia)

`StewardProposalLog` is on **Base Sepolia (chain id 84532)** only:

- Contract: [`0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188`](https://base-sepolia.blockscout.com/address/0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188?tab=contract)
- Deploy tx: [`0xf42e597cd77b05a3d7ea04bc2d998595ef413636afdc1d4e3688af7c7d21593a`](https://sepolia.basescan.org/tx/0xf42e597cd77b05a3d7ea04bc2d998595ef413636afdc1d4e3688af7c7d21593a) (17 Nov 2026, 11:47:41 UK)
- Deployer: `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F` (testnet only; never send mainnet assets to it)
- Verified on [Blockscout](https://base-sepolia.blockscout.com/address/0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188?tab=contract) (Solidity 0.8.24, optimizer 200, cancun). Not verified on BaseScan (no API key was used).
- Demo write (paper evidence only; the contract never moves funds): MandateSet [`0x8606005ba5138afbfc03fc618e8034af8ae9f8411a9189d578f5fa940747993a`](https://sepolia.basescan.org/tx/0x8606005ba5138afbfc03fc618e8034af8ae9f8411a9189d578f5fa940747993a), Proposed [`0x6221c7dd350870efe19b0a9047402aa327519c3a671de2faaceee9fa197aa1ba`](https://sepolia.basescan.org/tx/0x6221c7dd350870efe19b0a9047402aa327519c3a671de2faaceee9fa197aa1ba), Approved [`0x5ab6a7bf9f851cb6bc01de1e19f0295abc062a07b3938e34699cc64cf3f1bffa`](https://sepolia.basescan.org/tx/0x5ab6a7bf9f851cb6bc01de1e19f0295abc062a07b3938e34699cc64cf3f1bffa). Full hashes and the exact hashed JSON are in `docs/DEPLOYMENTS.md`.

The local `npm run demo` app still uses in-process Hardhat tagged 84532; it is not this public-testnet deploy. The Hardhat config still has no public network URLs. Gated scripts: `STEWARD_DEPLOY=yes node scripts/deploy-sepolia.cjs` and `STEWARD_DEMO_WRITE=yes node scripts/demo-sepolia-write.cjs`.

## Contest notes

Official Rules for Stocks Maxxing (checked 17 Nov 2026) do not require an AI-assistance disclosure. Steward’s engine is rule-based; the app copy does not claim a model. Application-form drafts (not submitted): `docs/SUBMISSION_DRAFT.md`. Public-repo readiness (not published): `docs/PUBLISH_READY.md`.

No public deploy, no faucet key in this tree, no wallet keys in the repo, no remote git. Do not add a GitHub remote, do not point Hardhat at a public chain, and do not send mainnet assets to the testnet deployer.

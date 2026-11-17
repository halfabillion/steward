# Steward — status (17 November 2026, 11:50 UK)

**Project:** Steward, the primary Base Stocks Maxxing concept (Agentic Stock Finance).  
**Updated:** Tuesday 17 November 2026, Europe/London (GMT / UTC+0). Earlier updates: Sunday 15 November 2026, 14:39 GMT; Saturday 14 November 2026, 01:57 GMT.  
**Tree:** `/workspace/money/hackathons/base-stocks/steward/` — local git only; no remote, no push, no GitHub.  
**Plan:** `../PLAN.md`. Spike: `SPIKE.md`. 12 Nov core write-up: `CORE.md` (this file supersedes it for current state).

This is a research-to-portfolio agent for Coinbase tokenized stocks on Base. Paper and a local Hardhat chain tagged 84532 only. Not a live product, not investment advice, not a brokerage, and not available in the United States.

No spend, no mainnet transaction, no wallet install, no signing with a real wallet, no registration-form submit, no public repo, and no posts were made in this session.

---

## 0. Update — Tuesday 17 November 2026, 11:50 UK (Base Sepolia deploy)

**StewardProposalLog is on Base Sepolia (84532).** Contract [`0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188`](https://base-sepolia.blockscout.com/address/0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188?tab=contract), deploy tx [`0xf42e597c…1593a`](https://sepolia.basescan.org/tx/0xf42e597cd77b05a3d7ea04bc2d998595ef413636afdc1d4e3688af7c7d21593a) at 11:47:41 UK, after the CDP faucet funded the existing deployer `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F` with 0.0001 ETH (tx `0x78d2686…dee87`, 11:46:29 UK). Verified on Blockscout (0.8.24, optimizer 200, cancun), not on BaseScan (no API key). A paper-only demo write (setMandate / propose / approve, no funds moved) is recorded in `docs/DEPLOYMENTS.md`. The key was not printed, logged, or committed. No remote, no push, no form submit, no spend of real funds (test ETH only).

---

## 0. Update — Tuesday 17 November 2026, 11:41 UK (deploy prep; not published)

**Sepolia deploy was prepared, not executed.** The existing testnet deployer `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F` was reused (key still at `/workspace/money/hackathons/base-stocks/.secrets/sepolia-deployer.key`, mode 600). No new key was created. Base Sepolia balance is **0**. No faucet could be claimed from the shell without a login or a mainnet balance. Current Sepolia gas would make a single free CDP drip (0.0001 ETH) enough to deploy. A gated script `scripts/deploy-sepolia.cjs` and `docs/DEPLOYMENTS.md` are in the tree. The key was not printed, logged, or committed. No public-chain transaction was sent.

**Public-repo readiness:** gitleaks found no leaks in the working tree or in all 8 git commits. trufflehog reported only unverified false positives on the DexScreener fixture. No history rewrite is needed. A local `publish` branch is prepared without `.github/workflows/ci.yml`. No GitHub repo was created and nothing was pushed. See `docs/PUBLISH_READY.md`.

**Application form:** the only form linked from the Quest Page is still https://docs.google.com/forms/d/1zotYvkeAtDjR2MKk3qNxyNIAfJ_IPQtzTtjNhOAF8js/viewform (now titled “Application Form”). It does not collect an X post, video, or wallet signature. Draft answers, including X handle `@half_abillion` and payout `0xd9784f8122af988E51b3183F725b0b53BCb8278A`, are in `docs/SUBMISSION_DRAFT.md`. **Not submitted.** Official rules do not require an AI disclosure.

No spend, no post, no form submit, no remote, no push.

---

## 0. Update — Tuesday 17 November 2026 (UK time, GMT / UTC+0)

**Guided demo path polished.** The judge flow is now explicit: mandate → proposal → paper fill → proposal log.

- **One command:** `npm run demo` prints the four steps and starts the same loopback server as `npm run dev` (in-process Hardhat, chain id 84532 only). `http://127.0.0.1:5173`.
- **UI:** a 4-step guide stays at the top of the app after the eligibility gate. Demo defaults are labelled (7-name basket, $90k AAPLc, $10k cash). The steward will not run until a mandate is saved. After a rebalance is approved, a paper-fill confirmation points at the log. Empty and error states cover “no mandate yet”, “no snapshot yet”, an empty log, a hold or blocked run, a rejected proposal, and a dismissible error banner. A later hold does not rewind completed steps.
- **Verified on the local path** (screenshots in `docs/screenshots/2026-11-17/`): save mandate → run steward → approve (paper fill) → log shows MandateSet, Proposed, and Approved on chain id 84532. No public network was used.
- **Tests:** `npm test` gives **64** Node tests (49 earlier + 15 new guided-demo state-machine tests in `test/demoFlow.test.js`) and **6** Hardhat tests, all green. The local network stays on chain 84532 only.
- **Progress X post:** drafted only, at `docs/X_POST_DRAFT_2026-11-17.md`. Not posted. Needs Ali's OK and Ali's X handle.

No spend, keys, wallet, deploy, signup, post, form submit, or remote push. `.secrets/` was not read.

---

## 0. Update — Sunday 15 November 2026 (UK time, GMT / UTC+0)

**Live read-only DEX premium reader added.** The NAV-premium flag now works on live data, not only on test-injected `marketE8`.

- **Source:** DexScreener public API, `GET https://api.dexscreener.com/latest/dex/tokens/<address>`. No key, no signup, no wallet, no gas. Token addresses come from the official Tokenized Stocks API, as before.
- **Live check, Sun 15 Nov 2026 about 14:34–14:38 UK:** all 7 demo-basket tokens have real Base DEX pairs. The deepest USD-stable pool for each was an Aerodrome (`aero`) USDC pool. Premium is versus official NAV, which was the Friday 13 Nov close (Chainlink, matching the API exactly). Read at 14:37:38 UK:

| Token | Official NAV (Fri close) | Deepest DEX price | Pool liquidity | Premium |
| --- | --- | --- | --- | --- |
| AAPLc | $355.5850 | $356.2109 | ~$547k | +17 bps |
| AMZNc | $265.4472 | $262.8228 | ~$1.81m | −98 bps |
| GOOGLc | $294.8912 | $291.9461 | ~$1.47m | −99 bps |
| METAc | $638.5403 | $634.9219 | ~$872k | −56 bps |
| MSFTc | $522.4050 | $519.7963 | ~$544k | −49 bps |
| NVDAc | $160.7654 | $160.3288 | ~$1.44m | −27 bps |
| TSLAc | $387.7930 | $386.2848 | ~$523k | −38 bps |

  None reached the ±100 bps flag at that read. It is a weekend, so the gap includes DEX trading since the Friday close; the brief says so.
- **Rules (`src/data/dex.js`):** only `chainId: base` pairs where the stock token is the **base** token (so the price means USDC per token) and the quote is USDC or USDbC. The deepest pool by `liquidity.usd` wins, with a $25,000 minimum. Price comes from `priceNative` (USDC per token, more decimals), falling back to `priceUsd`. There is an 8 s timeout per call, sequential calls, a 60 s in-memory cache (transport errors are not cached), and the reader never throws. Any failure gives `{ ok: false, note: "no DEX market" }`, so the premium stays unflagged.
- **uiMultiplier:** official NAV (Chainlink / API) is per token (total return = share price × uiMultiplier). The DEX price is per whole token too, so the premium compares per token with per token, and the multiplier cancels. `market.perShareE8` divides the multiplier out for display only. A test checks that the per-share and per-token premiums agree on GOOGLc (multiplier ≈ 1.000377).
- **Wiring:** `snapshotUniverse(symbols, { dexMarket: true | {opts} })`. The default is **off**, so tests stay deterministic. The local dev server turns it on (`STEWARD_DEX=0` turns it off). `attachDexMarket(snapshot)` also works on `snapshotFromListed` output. The premium is still a **flag, never a block**: a test injects an NVDAc price about +1,200 bps rich and the rebalance still proposes buying NVDAc.
- **UI / brief:** the Portfolio table has a new "DEX vs NAV" column (signed bps, DEX price, pool, liquidity, read time in UTC, or "no DEX market"), with a source and time line above it. The "Why" brief adds one sentence listing premium bps per name and the source and time, and names any token with no DEX market.
- **Verified end to end:** the local dev server (`/api/snapshot`, `/api/agent/run`, in-process Hardhat 84532 only) priced all 7 names on live Chainlink NAV with DEX premiums attached. The web bundle builds.
- **Tests:** `npm test` gives **49** Node tests (35 earlier + 13 DEX unit tests on a committed, unmodified live fixture `test/fixtures/dexscreener-basket.json`, fetched 15 Nov 2026 14:34 UK, + 1 live smoke test that skips offline or with `STEWARD_SKIP_LIVE_API=1`) and **6** Hardhat tests, all green. Manual live table: `npm run dex:smoke`.
- **Limitations:** DexScreener gives no per-price timestamp, so "read at" is our fetch time. Its `liquidity.usd` is its own estimate. 1 USDC is treated as $1. There is no depth or slippage model: this is a mid-price indicator, not an executable quote. DexScreener rate limits apply (7 calls per snapshot, cached for 60 s). It is a third-party aggregator; an eth_call pool read could replace it later. Off-hours NAV is held, so weekend premiums mostly show drift since the close, not mispricing.

No spend, keys, wallet, deploy, signup, post or remote push. `.secrets/` was not read.

---

## 1. Verified deadline (UK time)

Re-checked live on Saturday 14 November 2026 against the official pages. Times below are Europe/London (GMT / UTC+0 in December).

| Source | What it says | In UK time |
| --- | --- | --- |
| Official Rules §2 (https://www.base.org/stocksmaxxing/rules) | Quest period 5 Nov–5 Dec 2026. All submissions must be received in the Quest Period. Times are **UTC** unless the Quest Page says otherwise. Sponsor’s computer is the official clock. | Date only; no hour in the rules text |
| Quest Page FAQ “How do I submit?” (https://www.base.org/stocksmaxxing), live 14 Nov | “Share a Loom demo on X and tag @buildonbase, then complete the submission form by **11:59 PM UTC on December 5, 2026**. Didn’t register? You can still submit.” | **Friday 5 December 2026, 23:59 UK** |
| Registration form conditions (https://docs.google.com/forms/d/1zotYvkeAtDjR2MKk3qNxyNIAfJ_IPQtzTtjNhOAF8js/viewform), read-only, not submitted | “Ends December 5, 2026, **11:59pm EST**” | Saturday 6 December 2026, 04:59 UK (EST is UTC−5 in December) |

**Binding time we will use:** the earlier official time, **Friday 5 December 2026, 23:59 UK**. Do not rely on the form’s EST wording.

**Internal target (from `PLAN.md`):** submit in the buffer window **Wednesday 2 December – Thursday 3 December**, aiming for **Thursday 3 December 2026, 18:00 UK**. 4–5 December is emergency only.

Winners-announced date is still not posted (Quest Page timeline slot remains a placeholder). Official Rules §10: digital-asset prizes normally within 30 days after verification.

---

## 2. Judging criteria and track

**Track we are building for:** Agentic Stock Finance only (official example ideas include “research-to-portfolio agents” and “agent-managed rebalancing”). Stated Base prize for that track: **$20,000**. A single project may win in only one Base track. Partner-track cash is optional and not planned unless Ali says otherwise.

**How judging is written:**

- Official Rules §7: a Sponsor-chosen panel scores Submissions against “the criteria included on the Quest Page, weighted equally unless the Quest Page sets different weights.”
- The Quest Page, re-fetched 14 Nov 2026, still does **not** list criteria or weights.
- The official @base announcement (5 Nov 2026, https://x.com/base/status/2118282384437022894) does:

  - **50% Traction:** real usage, verified onchain
  - **25% Product:** utility, creativity, execution
  - **25% Build in public:** dated progress posts and community growth

Treat 50/25/25 as how they will actually judge, but flag that it is not on the Quest Page the rules incorporate. Official Rules §5: testnet submissions “will not be judged less favorably because they were built on testnet.” Official Rules §13 forbids manipulating engagement or traction metrics.

**Required to enter** (Official Rules §5; Quest Page FAQ):

1. A public X post with a video demo (Loom is the official example) that tags `@buildonbase`.
2. The official **submission** form (separate from the optional registration form), including the X-post link and track.
3. Any extra Track Section requirements — none posted for Agentic as of 14 Nov.

Public GitHub is **not** an official requirement. A public demo URL, Builder Code, and traction data are asked for in the How-it-works / checklist language and matter for the 50% / 25% legs, but all of those need Ali’s approval before anything is made public.

**Prize-split inconsistency (still live in PLAN.md; not re-litigated here):** the page also shows an $11,000 / $7,000 “every track” widget that does not add cleanly to the $20,000 Agentic figure or the $50,000 Base-track FAQ total. Do not promise a specific winner cheque size.

---

## 3. Current state

The local vertical slice works end to end. As of 17 Nov the judge path is a guided 4-step demo (`npm run demo` → http://127.0.0.1:5173).

**User flow that already runs on loopback:**

1. US geo-gate (timezone or country) is a hard block; `America/St_Johns` is treated as Canada. Everyone else must attest (18+, not a US person, not advice, no shareholder rights, paper / testnet only).
2. Set a mandate (universe, caps, cash sleeve, threshold). `neverAutoSpend` is forced on.
3. Steward takes a live snapshot: official Tokenized Stocks API (no key) plus read-only Base Mainnet `eth_call`s (Chainlink NAV, B20 `uiMultiplier` / pending corporate action). Sequential, no gas, no keys.
4. Deterministic engine proposes rebalance, hold, or block, with rule-based reasons (no model; copy never says “AI”).
5. User approves or rejects. Approval writes to `StewardProposalLog` on an **in-process Hardhat** network tagged 84532 and updates the **paper** book only. Nothing is sent to a public chain.

**This session (14 Nov), added on top of the 12 Nov core:**

- API list `paused_features` is now carried into the snapshot. The engine **will not buy or sell** a paused name (position is held unchanged; leftover stays cash).
- DEX / secondary-market premium versus official NAV is computed when a `marketE8` is present, and flagged at ±100 bps. It is **not a block**. Since 15 Nov a live, read-only DexScreener reader supplies `marketE8` (see §0).
- `snapshotFromListed` builds an engine snapshot from official API rows only, so the core loop can run without a public RPC.
- A local end-to-end test hits the live Tokenized Stocks API (no key) when reachable, otherwise the committed fixture, then propose → explain → paper fill → second run holds. Live API succeeded in this session (358 list records; demo basket NAVs present).
- Tests: **64** Node tests (as of 17 Nov; 49 on 15 Nov; 35 on 14 Nov) and **6** Hardhat contract tests, all green (`npm test`).

**Default demo book:** $90,000 AAPLc + $10,000 cash, equal-weight 7-name universe (AAPLc, AMZNc, GOOGLc, METAc, MSFTc, NVDAc, TSLAc), 30% cap, 10% cash sleeve, 200 bps threshold.

**What is deliberately not done:**

- No Base Sepolia deploy, faucet request, or funded key use. An unused testnet-only deployer address exists (see below). The key itself is outside the repo and was not read or printed.
- No Builder Code issued. `src/builderCode.js` leaves calldata unchanged until a real code exists (`BUILDER_CODE = null`). Do not invent a placeholder suffix.
- No wallet connect (wagmi / OnchainKit) and no wallet install.
- No public GitHub remote, no demo hosting, no X posts published (a 17 Nov progress draft exists, unposted), no registration or submission form sent.
- DEX premium is mid-price only (DexScreener, no depth model). No policy-registry / announcement-log historical query. IndexKit (backup concept) is not built. Steward remains the go path.

**Testnet deployer (address only, from `CORE.md`):** `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F` — Base Sepolia (84532) only. Not funded, not used. **Never** send mainnet assets to it. The key file lives outside git (`.secrets/` is gitignored). Do not read or print it.

---

## 4. Tests (this session)

```bash
npm test
```

Result on 17 Nov 2026 (Europe/London): **64/64** Node tests pass, **6/6** contract tests pass, 0 failures. Added 15 guided-demo flow tests (`test/demoFlow.test.js`) on top of the 15 Nov suite (49 Node + 6 contract).

Earlier: 14 Nov 2026, about 01:58 GMT — **35/35** Node + **6/6** contract.

Node coverage: eligibility, hash, paper, explain, builder-code stub, engine (rebalance / hold / cap / stale / pending CA / off-hours / pause / premium), premium helper, `snapshotFromListed`, the API-to-paper e2e loop, DEX reader, and the guided-demo state machine. Contract coverage: mandate, propose, owner-only approve-once, reject, mandate mismatch, no-mandate / empty hash, local chain id 84532.

---

## 5. What remains (next milestones, UK time)

From `PLAN.md`, adjusted for what is already built. Target effort stays lean.

| # | When (UK) | What is left | Exit criteria / blocker |
| --- | --- | --- | --- |
| 2 (wrap) | through Mon 16 Nov | Local core is done. Sepolia faucet + hello/log deploy is **not** done and stays blocked on Ali. Optional: draft registration answers (not submit). | Ali answers in §6 before any faucet, deploy, or form. |
| 3 | Tue 17 – Mon 23 Nov | **Local demo polish done 17 Nov** (`npm run demo`, 4-step UI, screenshots, tests green). Dated progress X post **drafted** (`docs/X_POST_DRAFT_2026-11-17.md`) — not posted, needs Ali. Sepolia approval flow only after Ali’s wallet / faucet OK. Live DEX premium reader already landed 15 Nov. | A stranger can set a mandate, see a real-data brief, and approve on the local 84532 log. Sepolia remains blocked on Ali. |
| 4 | Tue 24 – Sat 28 Nov | Builder Codes on every tx **once a real code is issued**; tests; visual finish; README ready if Ali agrees to a public repo. Mid-build X **draft** (~25–26 Nov). | Test suite green; Builder Code visible on a Sepolia explorer only if Ali has approved that deploy. |
| 5 | Sun 29 – Mon 30 Nov | Demo video (2–4 min): gate → mandate → research → approve → history. Final X post **draft** tagging `@buildonbase`. Submission packet prepared and held. | Video and drafts ready. No agent posts. |
| 6 | Tue 1 – Thu 3 Dec | QA; re-check Quest Page for the **final submission form** and any rules/prize changes. **Target submit: Thu 3 Dec 18:00 UK.** | Form and X post only with Ali’s explicit OK; Ali posts and Ali (or Ali-directed) submits. |
| — | Fri 4 – Fri 5 Dec 23:59 UK | Emergency only. No new features. | — |

IndexKit stays the unused backup. Switch only if Steward clearly cannot make the 3 Dec buffer.

Product polish that can wait: policy-registry pause confirmation on-chain, announcement history, public-RPC 429 hardening, wallet-connect UI (only after Ali is ready to use a wallet on Sepolia — no install from an agent). Live DEX premium reader landed 15 Nov; guided demo polish landed 17 Nov.

---

## 6. Exact questions for Ali

Nothing below should be done until Ali answers. An agent must not post, submit, deploy, spend, or open a public repo on his behalf.

### Concept and repo

1. **Concept.** Do you want us to keep building Steward for the Agentic Stock Finance track (paper / testnet only), rather than switching to the IndexKit backup or not entering?
2. **Private GitHub repo.** May we create a **private** GitHub repository under `halfabillion` for this project? Official rules do not require a public repo.
3. **Public source.** If a private repo is created, should it stay private, and if it should become public, when?

### Hosting, Builder Code, wallet, and deploy

4. **Public demo hosting.** May we publish a public demo URL (for example a Cloudflare `workers.dev` or Pages site)? This would be a public page.
5. **Builder Code.** Do you want to apply for a Base Builder Code (ERC-8021) in your name so later testnet transactions can be attributed? The hook is already in the app and is a no-op until a real code is issued. We will not invent a placeholder.
6. **Base Sepolia deploy.** A testnet-only deployer address already exists and is unfunded: `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F` (Sepolia only). Do you approve requesting **Base Sepolia faucet ETH only** (no mainnet assets, no spend of real funds) and deploying the proposal log to Base Sepolia from that key? Or would you rather use your own testnet wallet? We will not install a wallet, sign with a mainnet or funded real wallet, or deploy without your OK.
7. **Mainnet deploy.** Please confirm we should **not** deploy to Base Mainnet and should **not** send any mainnet transaction, signature, or gas. (Recommended: yes, stay off mainnet. Official rules allow testnet and do not judge it less favourably.)

### X posts

8. **Progress posts.** Will you post dated build-in-public updates on X, tagging `@buildonbase`, if we draft the text and images for you? An agent will not post.
9. **Required demo-video post.** At submission, will you post the required public X video demo (Loom or a local recording) tagging `@buildonbase`? We will draft the post and prepare the video; only you publish it.
10. **Your X handle.** What X handle should we use on the registration form (if you register) and in drafts?

### Registration form (optional — not the final submission)

The “Apply Now” form is still titled **“Stocks Maxxing \| Register + Partner Support.”** It is optional (Quest Page FAQ: you can still submit without registering). It is **not** the final submission form. Read-only check on 14 Nov 2026: the confirmation text is now “Application received. Now pick a track and start building…” — the earlier “TEST registration saved… not a final submission” wording is gone. The form still is not entry. **Do not ask an agent to submit this.** If you register, you should submit it yourself.

11. **Do you want to register now?** If no, we wait. If yes, please confirm or correct each field below, and submit the form yourself:

    - **Project name:** Steward — is that the name you want?
    - **Full name:** what exact name should appear (for example Ali Ghaedi)?
    - **Email address:** `gh.ali7755@gmail.com` — is that the address you want used?
    - **X Handle:** (see question 10)
    - **Describe your project in 1–2 sentences:** draft to follow your go-ahead, e.g. “Steward is a research-to-portfolio agent for Coinbase tokenized stocks on Base. The user sets a mandate; Steward reads official NAV, multipliers and pauses; it proposes a reasoned rebalance; the user approves; execution is paper / testnet only and is not available to US persons.”
    - **Current stage:** Prototype — agree?
    - **Does your project have a token?** No — agree?
    - **Entry type:** “Build New - you want to launch a new tokenized stock product on Base. A token is optional.” — agree?
    - **Intended Base track:** Agentic Stock Finance — agree?
    - **Launch partners:** **None** (recommended unless you want partner introductions) — agree? Choices are o1 Exchange, Bankr, Stonks Exchange, Feel.cash, Base Stonk, Hydropump by Hydrex, or None.
    - **What support is most valuable for you?** Leave blank / N/A — agree?
    - **Product or demo URL, if available (N/A if not):** N/A until you approve a public demo — agree?
    - **Why should we select you to be a part of Stocks Maxxing?** We can draft this for you to edit. Do you want a draft?
    - **May we collect, store and share your contact, project details and support request with your selected partners for campaign introductions?** Recommended answer: **No**, unless you want partner intros. Which do you want?
    - **You have read the Official Rules and Conditions** (https://www.base.org/stocksmaxxing/rules): only you can tick **Yes**. Have you read them, and will you tick this yourself?
    - **You agree to the following conditions** (the form still says “Ends December 5, 2026, 11:59pm EST”; we treat the earlier Quest Page time of **5 Dec 2026, 23:59 UK** as binding). The conditions also state that projects enabling trading for U.S. users are not in scope. Only you can tick “Yes, I have and read and accepted the above conditions.” Will you?
    - **Join the Telegram Group with partners you want to work with:** recommended skip unless you want new outside contact. Do you want to skip?

12. **Partner Telegram / Bankr Partner Track ($1,000).** Do you want to join any partner Telegram or pursue the Bankr track, or should we skip both? Skipping avoids a new account and new outside contact. Partner office hours listed through 13 Nov have already ended.

### Payout, KYC, and final submission

13. **Payout wallet, if we win.** Confirm that your existing Phantom Base address `0xd9784f8122af988E51b3183F725b0b53BCb8278A` is the one to give on the Winner Documents. No funding and no new wallet.
14. **KYC / tax.** If we win, are you willing to complete identity, sanctions screening, and W-8 (or equivalent) tax forms within **7 days** of a winner notice?
15. **Final submission.** Confirm that the official submission form and the required X demo post go out only with your explicit OK, and that you (not an agent) will publish the X post and complete the form?

---

## 7. How to run (local only)

```bash
npm install          # already done in this tree
npm test             # 64 Node tests (engine, eligibility, explain, paper, premium, e2e, DEX, guided-demo flow) + 6 contract tests
npm run demo         # recommended: prints the 4-step path and serves http://127.0.0.1:5173
npm run dev          # same server without the printed walkthrough — stop with Ctrl-C
npm run spike        # optional live read-only Mainnet + API probe (no keys, no gas)
```

`npm run demo` / `npm run dev` starts in-process Hardhat (chain id 84532), deploys `StewardProposalLog` in memory, and serves the API and Vite app together. It refuses to start on any other network name or chain id. There is no deploy script and no Sepolia URL in `hardhat.config.cjs`. Do not point Hardhat at a public RPC. Do not add a git remote. Do not send mainnet assets to the testnet deployer.

# Steward — status (14 November 2026)

**Project:** Steward, the primary Base Stocks Maxxing concept (Agentic Stock Finance).  
**Updated:** Saturday 14 November 2026, 01:57 GMT (Europe/London, UTC+0).  
**Tree:** `/workspace/money/hackathons/base-stocks/steward/` — local git only; no remote, no push, no GitHub.  
**Plan:** `../PLAN.md`. Spike: `SPIKE.md`. 12 Nov core write-up: `CORE.md` (this file supersedes it for current state).

This is a research-to-portfolio agent for Coinbase tokenized stocks on Base. Paper and a local Hardhat chain tagged 84532 only. Not a live product, not investment advice, not a brokerage, and not available in the United States.

No spend, no mainnet transaction, no wallet install, no signing with a real wallet, no registration-form submit, no public repo, and no posts were made in this session.

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

The local vertical slice works end to end.

**User flow that already runs on loopback (`npm run dev` → http://127.0.0.1:5173):**

1. US geo-gate (timezone or country) is a hard block; `America/St_Johns` is treated as Canada. Everyone else must attest (18+, not a US person, not advice, no shareholder rights, paper / testnet only).
2. Set a mandate (universe, caps, cash sleeve, threshold). `neverAutoSpend` is forced on.
3. Steward takes a live snapshot: official Tokenized Stocks API (no key) plus read-only Base Mainnet `eth_call`s (Chainlink NAV, B20 `uiMultiplier` / pending corporate action). Sequential, no gas, no keys.
4. Deterministic engine proposes rebalance, hold, or block, with rule-based reasons (no model; copy never says “AI”).
5. User approves or rejects. Approval writes to `StewardProposalLog` on an **in-process Hardhat** network tagged 84532 and updates the **paper** book only. Nothing is sent to a public chain.

**This session (14 Nov), added on top of the 12 Nov core:**

- API list `paused_features` is now carried into the snapshot. The engine **will not buy or sell** a paused name (position is held unchanged; leftover stays cash).
- DEX / secondary-market premium versus official NAV is computed when a `marketE8` is present, and flagged at ±100 bps. It is **not a block**. There is still no live DEX / CoinGecko reader (kept lean; tests inject a market price).
- `snapshotFromListed` builds an engine snapshot from official API rows only, so the core loop can run without a public RPC.
- A local end-to-end test hits the live Tokenized Stocks API (no key) when reachable, otherwise the committed fixture, then propose → explain → paper fill → second run holds. Live API succeeded in this session (358 list records; demo basket NAVs present).
- Tests: **35** Node tests and **6** Hardhat contract tests, all green (`npm test`).

**Default demo book:** $90,000 AAPLc + $10,000 cash, equal-weight 7-name universe (AAPLc, AMZNc, GOOGLc, METAc, MSFTc, NVDAc, TSLAc), 30% cap, 10% cash sleeve, 200 bps threshold.

**What is deliberately not done:**

- No Base Sepolia deploy, faucet request, or funded key use. An unused testnet-only deployer address exists (see below). The key itself is outside the repo and was not read or printed.
- No Builder Code issued. `src/builderCode.js` leaves calldata unchanged until a real code exists (`BUILDER_CODE = null`). Do not invent a placeholder suffix.
- No wallet connect (wagmi / OnchainKit) and no wallet install.
- No public GitHub remote, no demo hosting, no X drafts posted, no registration or submission form sent.
- No live DEX premium feed. No policy-registry / announcement-log historical query. IndexKit (backup concept) is not built. Steward remains the go path.

**Testnet deployer (address only, from `CORE.md`):** `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F` — Base Sepolia (84532) only. Not funded, not used. **Never** send mainnet assets to it. The key file lives outside git (`.secrets/` is gitignored). Do not read or print it.

---

## 4. Tests (this session)

```bash
npm test
```

Result on 14 Nov 2026, about 01:58 GMT (Europe/London): **35/35** Node tests pass, **6/6** contract tests pass, 0 failures.

Node coverage: eligibility, hash, paper, explain, builder-code stub, engine (rebalance / hold / cap / stale / pending CA / off-hours / pause / premium), premium helper, `snapshotFromListed`, and the API-to-paper e2e loop. Contract coverage: mandate, propose, owner-only approve-once, reject, mandate mismatch, no-mandate / empty hash, local chain id 84532.

---

## 5. What remains (next milestones, UK time)

From `PLAN.md`, adjusted for what is already built. Target effort stays lean.

| # | When (UK) | What is left | Exit criteria / blocker |
| --- | --- | --- | --- |
| 2 (wrap) | through Mon 16 Nov | Local core is done. Sepolia faucet + hello/log deploy is **not** done and stays blocked on Ali. Optional: draft registration answers (not submit). | Ali answers in §6 before any faucet, deploy, or form. |
| 3 | Tue 17 – Mon 23 Nov | Polish the demo path; first dated progress **draft** for Ali (~18–20 Nov). Sepolia approval flow only after Ali’s wallet / faucet OK. Optional: a free-tier DEX or pool read for live premium. | A stranger can set a mandate, see a real-data brief, and (if Sepolia is approved) approve on Sepolia; otherwise the local 84532 log remains the demo. |
| 4 | Tue 24 – Sat 28 Nov | Builder Codes on every tx **once a real code is issued**; tests; visual finish; README ready if Ali agrees to a public repo. Mid-build X **draft** (~25–26 Nov). | Test suite green; Builder Code visible on a Sepolia explorer only if Ali has approved that deploy. |
| 5 | Sun 29 – Mon 30 Nov | Demo video (2–4 min): gate → mandate → research → approve → history. Final X post **draft** tagging `@buildonbase`. Submission packet prepared and held. | Video and drafts ready. No agent posts. |
| 6 | Tue 1 – Thu 3 Dec | QA; re-check Quest Page for the **final submission form** and any rules/prize changes. **Target submit: Thu 3 Dec 18:00 UK.** | Form and X post only with Ali’s explicit OK; Ali posts and Ali (or Ali-directed) submits. |
| — | Fri 4 – Fri 5 Dec 23:59 UK | Emergency only. No new features. | — |

IndexKit stays the unused backup. Switch only if Steward clearly cannot make the 3 Dec buffer.

Product polish that can wait: live DEX premium reader, policy-registry pause confirmation on-chain, announcement history, public-RPC 429 hardening, wallet-connect UI (only after Ali is ready to use a wallet on Sepolia — no install from an agent).

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
npm test             # 35 engine / eligibility / hash / paper / explain / premium / snapshot / e2e tests + 6 contract tests
npm run dev          # http://127.0.0.1:5173 — stop with Ctrl-C
npm run spike        # optional live read-only Mainnet + API probe (no keys, no gas)
```

`npm run dev` starts in-process Hardhat (chain id 84532), deploys `StewardProposalLog` in memory, and serves the API and Vite app together. It refuses to start on any other network name or chain id. There is no deploy script and no Sepolia URL in `hardhat.config.cjs`. Do not point Hardhat at a public RPC. Do not add a git remote. Do not send mainnet assets to the testnet deployer.

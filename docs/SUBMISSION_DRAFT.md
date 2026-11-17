# Stocks Maxxing form draft — NOT SUBMITTED

Status: **draft only**. Do not send this form. Public repo, push, and form submit wait on Ali’s confirmation.

Fetched live: Tuesday 17 November 2026, 11:40 UK (Europe/London, GMT / UTC+0), from the box network (the user’s computer was offline; this was a public page).

## Which form this is

The only form linked from the official Quest Page ([https://www.base.org/stocksmaxxing](https://www.base.org/stocksmaxxing)) and from every “Apply Now” button is:

**https://docs.google.com/forms/d/1zotYvkeAtDjR2MKk3qNxyNIAfJ_IPQtzTtjNhOAF8js/viewform**

Live title on 17 Nov 2026: **Stocks Maxxing | Application Form** (earlier it was titled “Register + Partner Support”; the 17 fields are the same shape as the 14 Nov registration draft in `docs/REGISTRATION_DRAFT.md`).

This is **not** clearly the final official “Submission Form” described in the Official Rules. Reasons:

- Official Rules §5 still require (1) a public X post with a video demo that tags `@buildonbase`, and (2) a Submission Form that includes a **link to that X post**, the track(s), and any other requested information. A Submission is not complete until the sponsor receives that form.
- The Quest Page FAQ still says: “Share a Loom demo on X and tag @buildonbase, then complete the submission form by **11:59 PM UTC on 5 December 2026**. Didn’t register? You can still submit.”
- **This Google Form has no field for an X post URL, no video upload, no GitHub URL, and no wallet-signature step.** It is the apply / partner-support form. Confirmation text: “Application received. Now pick a track and start building. The best way to stand out is to ship and build in public.”
- A separate final submission form was **not** linked on the Quest Page as of this check. Re-check [https://www.base.org/stocksmaxxing](https://www.base.org/stocksmaxxing) before any real submit.

Treat the earlier of the published close times as binding: **Friday 5 December 2026, 23:59 UK**. Internal target remains **Thursday 3 December 2026, 18:00 UK**, only with Ali’s go.

## After submit, KYC, video, signature

- **Editable after submit?** The public form HTML has no “edit your response” language. Confirmation is a plain “Application received…” message. Treat a submit as **one-shot** unless Ali sees an edit link on a confirmation screen. Do not test-submit.
- **X post / video:** not collected on this form. Still required later by Official Rules §5 and the FAQ (Loom or similar, tag `@buildonbase`). Not posted, not recorded for submission in this session.
- **KYC / identity:** not on this form. Official Rules and the form conditions say **winners** are subject to identity verification and tax forms after a notice, not at application time.
- **Wallet signature:** none on this form.
- **US trading:** projects that enable trading for US users are out of scope. Steward’s US geo-gate is already a hard block; the draft answers do not claim a US product.

## Draft answers (17 fields)

Payout address below is Ali’s existing Phantom Base wallet, confirmed in `/workspace/money` records and the tracker, **not** the unfunded testnet deployer. Do not send funds to the deployer.

| # | Field (exact, required unless noted) | Draft answer |
| --- | --- | --- |
| 1 | Project name | Steward |
| 2 | Full name | Ali Ghaedi |
| 3 | Email address | gh.ali7755@gmail.com |
| 4 | X Handle | @half_abillion |
| 5 | Describe your project in 1-2 sentences | Steward is a research-to-portfolio agent for Coinbase tokenized stocks on Base. You set a mandate; it reads official NAV and on-chain state, proposes a reasoned rebalance, and only updates a paper book after you approve. Approvals are recorded on a contract log (local chain 84532 today; Base Sepolia deploy pending funding). It never auto-spends and is not available in the United States. |
| 6 | Current stage | Prototype |
| 7 | Does your project have a token? | No |
| 8 | Entry type | Build New - you want to launch a new tokenized stock product on Base. A token is optional. |
| 9 | Intended Base track | Agentic Stock Finance |
| 10 | Launch partners you want to consider working with (select all that apply; choose ‘None’ if not applicable) | None |
| 11 | What support is most valuable for you? *(optional)* | Feedback from the Base team on Builder Codes attribution for agent-proposed transactions, and the cleanest Base Sepolia path for an approve-before-execute log. |
| 12 | Product or demo URL, if available (N/A if not) | N/A (local prototype; a public demo URL will follow only after Ali approves a public repo or host) |
| 13 | Why should we select you to be a part of Stocks Maxxing? *(short field)* | Steward already runs end to end on live official data: mandate → reasoned proposal → paper fill → contract log, with a 4-step guided demo (`npm run demo`), 64 Node + 6 contract tests, a US geo-gate, and never-auto-spend locked on. It is built for the Agentic Stock Finance brief and stays paper / testnet until a Sepolia deploy is funded. |
| 14 | May we collect, store and share your contact, project details and support request with your selected partners for campaign introductions? | No (no partner selected). This is partner-sharing consent, not a “publish the project” question. If a later form asks whether we intend to publish the repo / demo, the standing answer is **Yes**. |
| 15 | You have read the Official Rules and Conditions: https://www.base.org/stocksmaxxing/rules | Yes — **only Ali can tick this**, and only after he has read the rules. |
| 16 | You agree to the following conditions: *(void where prohibited; 18+; ends 5 Dec 2026 11:59pm EST; winners may face identity verification and tax forms; US-user trading is out of scope; do not send sensitive IDs on this form)* | Yes, I have and read and accepted the above conditions — **only Ali can tick this.** |
| 17 | Join the Telegram Group with partners you want to work with | Skip (no partner). This item is a section with partner Telegram links, not a required text field. |

Official rules **do not** ask for an AI-assistance disclosure (no “AI” / “language model” requirement in the 17 Nov rules text). Wording above does not claim model authorship or a public-chain deploy that has not happened.

## If / when a final Submission Form appears

Expect at least: link to the X video post tagging `@buildonbase`, track = Agentic Stock Finance, project name Steward, and likely a repo / demo URL (needs Ali’s public-repo OK). Payout, if asked at winner stage: `0xd9784f8122af988E51b3183F725b0b53BCb8278A` (Phantom Base, Ali’s existing address). GitHub: halfabillion. Re-draft against the live fields; do not reuse this file blindly.

Earlier 14 Nov answers, without the X handle, are in `docs/REGISTRATION_DRAFT.md` and are superseded by this file for the same URL.

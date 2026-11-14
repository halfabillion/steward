# Stocks Maxxing application form — DRAFT answers (not submitted)

Form: https://docs.google.com/forms/d/1zotYvkeAtDjR2MKk3qNxyNIAfJ_IPQtzTtjNhOAF8js/viewform
Fields pulled live from the form on Sat 14 Nov 2026 ~20:25 UK (17 items). This form is the optional
registration / partner-support form, separate from the final submission form. Nothing has been sent.
Sending it puts Ali's name, email and X handle in front of Coinbase/Base, so it needs Ali's OK first.

| # | Field (exact) | Draft answer |
|---|---|---|
| 1 | Project name | Steward |
| 2 | Full name | Ali Ghaedi |
| 3 | Email address | gh.ali7755@gmail.com (Ali to confirm) |
| 4 | X Handle | **Ali to fill** (not on record) |
| 5 | Describe your project in 1-2 sentences | Steward is a research-to-portfolio agent for tokenized stocks on Base: you set a mandate (names, caps, cash sleeve, drift threshold), it reads official Tokenized Stocks API data and Chainlink NAV feeds, and proposes a rebalance with plain reasons that you approve before anything happens. Every proposal and approval is recorded in a contract log, and it refuses to trade paused names or ones with a pending corporate action. |
| 6 | Current stage | Prototype |
| 7 | Does your project have a token? | No |
| 8 | Entry type | Build New - you want to launch a new tokenized stock product on Base. A token is optional. |
| 9 | Intended Base track | Agentic Stock Finance |
| 10 | Launch partners (select all) | None (Bankr is the only plausible fit for agent execution; leave as None unless Ali wants an intro) |
| 11 | What support is most valuable for you? | Feedback from the Base team on Builder Codes attribution for agent-proposed transactions, and guidance on the cleanest Base Sepolia → mainnet path for an approve-before-execute flow. |
| 12 | Product or demo URL | N/A (local prototype; hosted demo after Ali approves hosting) |
| 13 | Why should we select you? | The prototype already works end to end on real data: it pulls the live official Tokenized Stocks list, reads NAV and multiplier state from Base, builds a proposal with explicit reasons, and records approve/reject in a contract log (Base Sepolia deploy pending), with 41 automated tests. It is built for the Agentic Stock Finance brief with safety first: the agent never spends on its own, honours paused features and corporate actions, flags DEX premium versus NAV, and blocks US users. |
| 14 | May we collect, store and share your contact... with partners? | No (no partner selected) |
| 15 | Read the Official Rules | Yes |
| 16 | Agree to the conditions | Yes, I have and read and accepted the above conditions |
| 17 | Join the Telegram Group | Skip (no partner) |

Facts behind #13 are from STATUS.md (14 Nov 01:58 UK: 35 Node + 6 contract tests green; live API 358 records).
Wording avoids any mention of AI authorship and does not claim a public-chain deploy (the log is an in-process 84532 Hardhat network today).

# Steward live demo video — script

Status: **local capture only. Not posted on X. Final Stocks Maxxing form not submitted.**

Recorded Thursday 19 November 2026, 11:37–11:43 UK (Europe/London, GMT / UTC+0), on the box. Terminal log is the authentic `npm run demo:live` session from 11:37:26–11:37:31 UK, paced so it is readable. Blockscout pages were captured with headless Playwright. Title card, end card, and on-screen captions only — no voice, no AI-generated audio.

**Video:** `submit/video/steward-demo-live.mp4` (1 minute 34 seconds, 1280×720, 30 fps, H.264 + silent AAC, about 1.3 MB).

**Contract:** [`0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188`](https://base-sepolia.blockscout.com/address/0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188?tab=contract) on Base Sepolia (chain id 84532).

## Live writes in this capture

All three writes used only the existing Base Sepolia ETH on the testnet deployer `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F`. Balance before the run: 0.0000936011 ETH. Preflight need (including headroom): 0.0000036873 ETH. No faucet and no other wallet.

| Step | Method | Tx | Block | Time (UK) |
| --- | --- | --- | --- | --- |
| 1. Mandate | setMandate | [`0x6034405cbfd46d31f8d88d7b7a6f89e4b7fef3615c52ea60fa19aa6b824abd1d`](https://base-sepolia.blockscout.com/tx/0x6034405cbfd46d31f8d88d7b7a6f89e4b7fef3615c52ea60fa19aa6b824abd1d) | 60831895 | 19 Nov 2026, 11:37:27 |
| 2. Proposal | propose | [`0x4c4981192e41b1b4e1c828d39cc5e57b6d2a49308aff7d186a610ab57581ca5c`](https://base-sepolia.blockscout.com/tx/0x4c4981192e41b1b4e1c828d39cc5e57b6d2a49308aff7d186a610ab57581ca5c) | 60831901 | 19 Nov 2026, 11:37:29 |
| 3. Paper fill | approve | [`0x0d6215537da01c3507400ae36876c5ebe950fd6dd296299dfb7c737966263a8c`](https://base-sepolia.blockscout.com/tx/0x0d6215537da01c3507400ae36876c5ebe950fd6dd296299dfb7c737966263a8c) | 60831908 | 19 Nov 2026, 11:37:30 |

- **proposalId:** `0xf94d78775037571ae0ce8508770648a16e1b2058ed027babc49935a930e94669`
- Opening balance 0.0000936011 ETH; remaining 0.0000923072 ETH (testnet only). Value on every transaction is 0 ETH. The contract never moves funds.

The authentic terminal log is at `submit/video/demo-live.log`. Evidence JSON: `submit/live-runs/20261119T113731Z-demo-live.json`.

## Timeline

| Time | Shot | Still | What is on screen |
| --- | --- | --- | --- |
| 0:00–0:07 | Title card | `stills/00-title.png` | “Steward — Live guided demo on Base Sepolia, paper + testnet only.” 19 November 2026, 11:37 UK. No voice. |
| 0:07–0:10 | Command | — | Types `npm run demo:live`. Caption notes this is a paced replay of the recorded 11:37:26 UK session; the log is authentic. |
| 0:10–0:47 | Terminal | `stills/term-00.png` … `term-07.png` | Balance check first, gas preflight, then mandate → rebalance proposal → paper fill → proposal log, with Blockscout links. |
| 0:47–0:55 | Blockscout Details | `stills/01-setMandate.png` | setMandate Success, block 60831895, 11:37:27 UK, value 0 ETH. |
| 0:55–1:03 | Blockscout Details | `stills/02-propose.png` | propose Success, block 60831901, 11:37:29 UK, value 0 ETH. |
| 1:03–1:11 | Blockscout Details | `stills/03-approve.png` | approve Success, block 60831908, 11:37:30 UK, value 0 ETH. |
| 1:11–1:18 | Blockscout Logs | `stills/04-propose-logs.png` | Proposed event (proposalId, owner, hashes). |
| 1:18–1:26 | Contract txs | `stills/05-contract-txs.png` | StewardProposalLog transactions, newest first: approve, propose, setMandate, each value 0 ETH. |
| 1:26–1:34 | End card | `stills/99-end.png` | “No funds moved. github.com/halfabillion/steward. Next: Ali posts on X tagging @buildonbase, then the final form, by 5 December 2026.” |

The finished file is 93.83 seconds (1 minute 34 seconds).

## What Ali still needs to do

These two steps need Ali’s own words. This capture is not a post and not a submission.

1. **Public X video post** of this demo, tagging `@buildonbase`. Draft copy remains in `docs/X_POST_DRAFT_2026-11-17_v2.md` (update the video and the 19 Nov tx links before posting).
2. **Final Stocks Maxxing §5 submission form**, with the public repo and the X post link, by **Friday 5 December 2026**. (Contest close is listed as 5 Dec 23:59 UTC; use the earlier UK end of day if the form timezone is unclear.) Target remains Thursday 3 December 18:00 UK.

Do not post or submit from this tree without that go.

## How to recapture

```bash
# Live writes (uses existing Base Sepolia ETH only; stops if the balance is too low)
npm run demo:live
# Preflight only:
npm run demo:live -- --dry-run

# After a new live run, refresh submit/video/demo-live.log from the session
# output, then compose the silent video (Playwright + ffmpeg, no key I/O):
python3 scripts/record-demo-live-video.py
```

The demo script reads `../.secrets/sepolia-deployer.key` at runtime only and never prints it. It refuses any chain id other than 84532.

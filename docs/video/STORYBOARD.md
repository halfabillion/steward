# Steward Base Sepolia demo — storyboard

Status: **local capture only. Not posted on X.** Recorded 17 November 2026, 20:50–20:55 UK (Europe/London, GMT / UTC+0), on the box, with headless Playwright + ffmpeg. No AI-generated voice; title cards and on-screen captions only.

**Video:** `docs/video/steward-base-sepolia-demo.mp4` (2 minutes 29 seconds, 1280×720, about 2.2 MB).

**Contract:** [`0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188`](https://base-sepolia.blockscout.com/address/0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188?tab=contract) on Base Sepolia (84532).

## Live writes in this capture

| Step | Method | Tx | Block | Time (UK) |
| --- | --- | --- | --- | --- |
| 1. Mandate | setMandate | [`0x7be716956ec28b76f6163d8936b5570e5b8daf5499279486e93a014e70bf02dd`](https://base-sepolia.blockscout.com/tx/0x7be716956ec28b76f6163d8936b5570e5b8daf5499279486e93a014e70bf02dd) | 60133781 | 17 Nov 2026, 20:50:25 |
| 2. Proposal | propose | [`0x3c953d3abe2e1fd175d7bb6594575b1f5ae44723447b86a29309628f18dff0ef`](https://base-sepolia.blockscout.com/tx/0x3c953d3abe2e1fd175d7bb6594575b1f5ae44723447b86a29309628f18dff0ef) | 60133847 | 17 Nov 2026, 20:50:38 |
| 3. Approve | approve | [`0x79398e1b8b7d9ec31d4927782d2329292165978f245bfb4b70c9c7c2e7488d9f`](https://base-sepolia.blockscout.com/tx/0x79398e1b8b7d9ec31d4927782d2329292165978f245bfb4b70c9c7c2e7488d9f) | 60133930 | 17 Nov 2026, 20:50:54 |

A rehearsal `setMandate` from the first recorder pass (receipt wait hung; later fixed) is also on-chain: [`0x8c75c2c2dcab18c9b23917581b87a72028f2194d0e87767f0bcb42b3ca4bb6c2`](https://base-sepolia.blockscout.com/tx/0x8c75c2c2dcab18c9b23917581b87a72028f2194d0e87767f0bcb42b3ca4bb6c2) at 20:47:21 UK. It is not the mandate shown in the finished video.

The contract does not move funds. The paper book is updated only after a human confirms each live write.

## Timeline

| Time | Shot | Still | What is on screen |
| --- | --- | --- | --- |
| 0:00–0:10 | Title card | — | “Steward — Guided demo on Base Sepolia, paper + testnet only.” No voice. |
| 0:10–0:25 | Gate | `stills/01-gate.png`, `stills/02-gate-attested.png` | Availability gate, five attestations, Enter Steward. |
| 0:25–0:45 | Mandate | `stills/03-mandate.png`, `stills/04-confirm-mandate.png` | Live Base Sepolia banner, demo defaults, in-app confirmation before signing. |
| 0:45–1:05 | Mandate write | `stills/05-mandate-saved.png` | Real `setMandate` on chain 84532. |
| 1:05–1:25 | Research brief / proposal | `stills/06-confirm-propose.png`, `stills/07-research-brief.png` | Confirm the live propose, then the rebalance brief and Blockscout tx link. |
| 1:25–1:29 | Approve | `stills/08-confirm-approve.png`, `stills/09-approved.png` | Confirm and send `approve`. (A public-RPC `eth_getLogs` range error briefly appeared on this frame after the tx had already landed; later log reads are chunked and retried.) |
| 1:29–1:37 | Hold — confirm | `stills/04-confirm-mandate.png` | Extra readable hold of the confirmation dialog. |
| 1:37–1:53 | Hold — research brief | `stills/07-research-brief.png` | Extra hold of the proposal / research brief with the propose tx link. |
| 1:53–2:21 | Hold — history | `stills/11-history-complete.png` | MandateSet, Proposed (status Approved), and Approved, each with a Blockscout tx link. |
| 2:21–2:29 | End card | — | “No funds moved. github.com/halfabillion/steward. Not posted on X.” |

The 0:10–1:29 stretch is the live Playwright capture (`STEWARD_NETWORK=base-sepolia npm run demo`). The later holds are the same session’s stills, held so the confirmation copy, research brief, and history stay readable for the 2–4 minute target. Captions are burnt into the frames; there is no voice track.

## How to recapture

```bash
STEWARD_NETWORK=base-sepolia STEWARD_PORT=5177 python3 scripts/record-sepolia-demo.py
```

The script never prints the deployer key. It starts the demo server, which reads `../.secrets/sepolia-deployer.key` at runtime only. Each write estimates gas and refuses to sign if the RPC reports any chain id other than 84532 or if the testnet balance is too low.

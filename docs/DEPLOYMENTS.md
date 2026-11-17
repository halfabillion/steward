# Steward deployments

Last checked: Tuesday 17 November 2026, 11:41 UK (Europe/London, GMT / UTC+0).

Nothing in this file has been deployed to a public network in this session. There is no public GitHub remote, and no verification was attempted.

## Intended network

- Network: Base Sepolia
- Chain id: **84532** only
- Official RPC (read/used for balance checks): `https://sepolia.base.org`
- Explorers (for a future verify step): [Sepolia BaseScan](https://sepolia.basescan.org), [Base Sepolia Blockscout](https://base-sepolia.blockscout.com)

## Deployer (public address only)

The testnet-only deployer key already existed (created 12 Nov 2026 with project-local `ethers.Wallet.createRandom()`). A new key was **not** created, so the original address is not stranded.

- **Address:** `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F`
- **Key path:** `/workspace/money/hackathons/base-stocks/.secrets/sepolia-deployer.key` (mode 600, directory mode 700)
- The path is outside the `steward/` git repo. Parent and repo `.gitignore` exclude `.secrets/`, `secrets/`, and `*.key`.
- The key has not been printed, logged, or committed. **Never** send mainnet assets to this address.

## Funding status (17 Nov 2026, 11:36–11:41 UK)

- Base Sepolia balance: **0 ETH** (nonce 0), confirmed on chain id 84532 via `https://sepolia.base.org`.
- No faucet claim succeeded from this shell (see below). **No deploy was run.**

### Would a free drip be enough to deploy?

Yes, at the gas price observed at 11:41 UK:

- `eth_gasPrice` ≈ 0.006 gwei; `maxPriorityFee` ≈ 0.001 gwei
- `StewardProposalLog` bytecode ≈ 2,314 bytes; rough deploy gas ≈ 480k
- Estimated deploy cost ≈ **0.000003 ETH**
- A single Coinbase CDP drip (0.0001 ETH) would cover the deploy with margin, if one can be claimed.

These figures will move with gas; re-check before any real send.

## Faucet routes checked (free only, no spend, no mainnet funding of this address)

| Route | Amount / limit | Can we use it from the shell today? | What it needs |
| --- | --- | --- | --- |
| **Coinbase Developer Platform (CDP)** — best fit once signed in | 0.0001 ETH per claim, up to 0.1 ETH / 24h (also USDC / EURC / cbBTC). UI or `POST https://api.cdp.coinbase.com/platform/v2/evm/faucet` | **No.** Needs a CDP Secret API key (JWT) or a signed-in Portal session. None is in this environment. | Free CDP account. Portal: [https://portal.cdp.coinbase.com/products/faucet](https://portal.cdp.coinbase.com/products/faucet) — pick Base Sepolia, token ETH, paste `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F`, Claim. Or create a free API key + Wallet Secret and call the [Faucets API](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/faucets/request-funds-on-evm-test-networks) / [SDK quickstart](https://docs.cdp.coinbase.com/faucets/introduction/quickstart). **No mainnet balance required.** Coinbase signup may still ask for email and sometimes phone / 2FA. |
| **Superchain faucet** | 0.01 ETH / 24h (more if onchain identity is verified) | **No.** Sign-in wall. | Browser: [https://console.optimism.io/faucet/](https://console.optimism.io/faucet/) — sign in (typically GitHub), choose **Base Sepolia** (84532), paste the deployer address. No mainnet balance required for the basic drip. |
| **ethfaucet.com** (in official [Base faucet list](https://docs.base.org/chain/network-faucets)) | Page offers 0.1 test ETH / 24h | **No usable shell API found.** The page is a JS app with BringID verification. | Browser: [https://ethfaucet.com/networks/base/base-sepolia](https://ethfaucet.com/networks/base/base-sepolia) — paste the address and complete BringID. Requirements beyond that were not fully exercised (no login was started). |
| **QuickNode** | Base drip shown after an address is entered; 12h cooldown | **No.** Official FAQ on the live page: a **small mainnet balance on the claiming wallet** is required. This deployer must not receive mainnet assets. | [https://faucet.quicknode.com/base/sepolia](https://faucet.quicknode.com/base/sepolia). Do not use this address here unless a *different*, already-funded mainnet wallet is allowed to claim and then *send test ETH only* to the deployer — that needs Ali. |
| **Alchemy** | 0.1 ETH / 24h | **No.** | [https://www.alchemy.com/faucets/base-sepolia](https://www.alchemy.com/faucets/base-sepolia) — requires **0.001 ETH on Ethereum mainnet** plus mainnet activity on the same address. |
| **thirdweb** | Testnet drip | **No.** | [https://thirdweb.com/faucets](https://thirdweb.com/faucets) / Base Sepolia page — **Connect Wallet** / login. |
| **Chainlink** | 0.5 ETH + 25 test LINK (listed by third parties) | **No.** | Wallet connect in the browser. |
| **Circle faucet** | Test USDC only | Not useful for gas. | [Circle faucet](https://faucet.circle.com) — Base Sepolia USDC. Does not pay ETH gas. |

Official Base list (17 Nov 2026): [https://docs.base.org/chain/network-faucets](https://docs.base.org/chain/network-faucets) — CDP, thirdweb, Alchemy, QuickNode, Chainstack, ethfaucet.com.

**Recommended next step for Ali (free, no spend):** sign in to the [CDP Portal faucet](https://portal.cdp.coinbase.com/products/faucet) (or the [Superchain faucet](https://console.optimism.io/faucet/)) and send **Base Sepolia ETH only** to `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F`. After a non-zero balance, the gated script below can deploy. Do not send mainnet ETH to this address.

## How to deploy (only after the address is funded; not run today)

The Hardhat config still has **no public network URLs**, so `npx hardhat run` cannot be pointed at Sepolia by accident. A separate, gated script is in `scripts/deploy-sepolia.cjs`.

```bash
# From steward/. Refuses unless STEWARD_DEPLOY=yes, chain id is 84532, and the key file has a balance.
STEWARD_DEPLOY=yes node scripts/deploy-sepolia.cjs
```

It reads the key from the path above (or `STEWARD_DEPLOYER_KEY_FILE`), never prints it, deploys `StewardProposalLog`, and appends the tx hash and contract address here. It will not run if the balance is zero or too low.

Verification (once there is a contract address): Blockscout’s free UI verifier at the explorer above, or BaseScan if a free API key is available. Neither was used today.

## Record

| Date (UK) | Network | Contract | Deploy tx | Verified | Notes |
| --- | --- | --- | --- | --- | --- |
| 17 Nov 2026, 11:41 | Base Sepolia (84532) | — | — | — | Address unfunded. No deploy. |

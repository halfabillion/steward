# Steward deployments

Last updated: Tuesday 17 November 2026, 20:55 UK (Europe/London, GMT / UTC+0).

The proposal-log contract is on **Base Sepolia (chain id 84532)** only. Public repository: https://github.com/halfabillion/steward

## Network

- Network: Base Sepolia
- Chain id: **84532** only
- Official RPC: `https://sepolia.base.org`
- Explorers: [Sepolia BaseScan](https://sepolia.basescan.org), [Base Sepolia Blockscout](https://base-sepolia.blockscout.com)

## Deployer (public address only)

The testnet-only deployer key lives outside the git repo and is never printed, logged, or committed.

- **Address:** `0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F`
- **Key path:** `/workspace/money/hackathons/base-stocks/.secrets/sepolia-deployer.key` (mode 600, directory mode 700)
- Parent and repo `.gitignore` exclude `.secrets/`, `secrets/`, and `*.key`.
- **Never** send mainnet assets to this address.

## Funding

Coinbase CDP faucet sent **0.0001 ETH** on Base Sepolia to the deployer.

- Faucet tx: [`0x78d2686041f16deed99dfe9ae524de5e6165a3533264d3ed981cb5fb70bdee87`](https://sepolia.basescan.org/tx/0x78d2686041f16deed99dfe9ae524de5e6165a3533264d3ed981cb5fb70bdee87) (via the CDP faucet contract; status 0x1)
- Block: 59970602
- Time: 17 Nov 2026, 11:46:29 UK (Europe/London, GMT / UTC+0)
- Balance after the drip, before deploy: **0.0001 ETH**, nonce 0, confirmed on chain id 84532.

## Contract

- **StewardProposalLog:** [`0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188`](https://base-sepolia.blockscout.com/address/0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188?tab=contract)
- **Deploy tx:** [`0xf42e597cd77b05a3d7ea04bc2d998595ef413636afdc1d4e3688af7c7d21593a`](https://sepolia.basescan.org/tx/0xf42e597cd77b05a3d7ea04bc2d998595ef413636afdc1d4e3688af7c7d21593a)
- Block: 59970963
- Time: 17 Nov 2026, 11:47:41 UK (Europe/London, GMT / UTC+0)
- Status: 0x1 (success). Gas used: 547,265. Deployer nonce after deploy: 1.
- Script: `STEWARD_DEPLOY=yes node scripts/deploy-sepolia.cjs` (refuses any chain id other than 84532; never prints the key). Hardhat config still has no public network URLs.

## Verification

- **Blockscout: verified.** Name `StewardProposalLog`, compiler `v0.8.24+commit.e11b9ed9`, optimizer on (200 runs), evm cancun, MIT. Submitted keyless via Blockscout’s flattened-code API (`POST /api/v2/smart-contracts/…/verification/via/flattened-code`). Confirmed `is_verified: true` on the address and via `module=contract&action=getsourcecode`.
  - Contract: https://base-sepolia.blockscout.com/address/0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188?tab=contract
- **Sourcify official `/server/verify`:** 404 (endpoint moved / not used). Not relied on.
- **BaseScan:** not verified here. The public `api-sepolia.basescan.org` getsourcecode call returned `NOTOK` without an API key, and no BaseScan API key was created or used.

## Demo write (on-chain evidence, no funds moved)

A single paper-only path was written with the same deployer (the contract owner): **setMandate → propose → approve**. The contract does not transfer tokens or ETH. Script: `STEWARD_DEMO_WRITE=yes node scripts/demo-sepolia-write.cjs` (chain 84532 only).

Hashes are `keccak256` of these exact UTF-8 strings (no extra whitespace):

- Mandate JSON: `{"name":"Steward Base Sepolia demo","universe":["AAPLc","AMZNc","GOOGLc","METAc","MSFTc","NVDAc","TSLAc"],"maxWeightBps":3000,"cashSleeveBps":1000,"rebalanceThresholdBps":200,"neverAutoSpend":true,"note":"Demo write 2026-11-17. Paper evidence only. No funds move."}`
- Research JSON: `{"source":"demo","date":"2026-11-17","note":"Placeholder research hash for on-chain log evidence. Not a live snapshot."}`
- Proposal JSON: `{"action":"rebalance","neverAutoSpend":true,"note":"Placeholder proposal body for on-chain log evidence. Not an executable trade."}`

| Step | Tx | Block | Time (UK) |
| --- | --- | --- | --- |
| setMandate | [`0x8606005ba5138afbfc03fc618e8034af8ae9f8411a9189d578f5fa940747993a`](https://sepolia.basescan.org/tx/0x8606005ba5138afbfc03fc618e8034af8ae9f8411a9189d578f5fa940747993a) | 59971700 | 17 Nov 2026, 11:50:08 |
| propose | [`0x6221c7dd350870efe19b0a9047402aa327519c3a671de2faaceee9fa197aa1ba`](https://sepolia.basescan.org/tx/0x6221c7dd350870efe19b0a9047402aa327519c3a671de2faaceee9fa197aa1ba) | 59971722 | 17 Nov 2026, 11:50:13 |
| approve | [`0x5ab6a7bf9f851cb6bc01de1e19f0295abc062a07b3938e34699cc64cf3f1bffa`](https://sepolia.basescan.org/tx/0x5ab6a7bf9f851cb6bc01de1e19f0295abc062a07b3938e34699cc64cf3f1bffa) | 59971743 | 17 Nov 2026, 11:50:17 |

- **proposalId:** `0xb1af6ab0b30e44852ad8225e83a052fbac2b69b592b70c2acc852a70453e2b17`
- **mandateHash:** `0x96c073dd49f76be490af838ee26cc5b85c899dad6d7a1e0166f4d7f47fd0e299`
- **researchHash:** `0x10ac4acdf94505e35858bea7addc4d6fc5128d14e99680dc8ec581a7b8ce7d97`
- **proposalHash:** `0x126caa353f3ae12e36ecea0cd596edd5c90b60f8f4866cca5050dc8c05cb6d13`
- On-chain proposal status after approve: **2 (Approved)**. All three receipts are status 0x1.



## Live demo writes (17 Nov 2026, 20:50 UK)

The demo app can opt in with `STEWARD_NETWORK=base-sepolia`. A recorded guided run (see `docs/video/STORYBOARD.md`) wrote:

- setMandate [`0x7be716956ec28b76f6163d8936b5570e5b8daf5499279486e93a014e70bf02dd`](https://base-sepolia.blockscout.com/tx/0x7be716956ec28b76f6163d8936b5570e5b8daf5499279486e93a014e70bf02dd) (block 60133781, 20:50:25 UK)
- propose [`0x3c953d3abe2e1fd175d7bb6594575b1f5ae44723447b86a29309628f18dff0ef`](https://base-sepolia.blockscout.com/tx/0x3c953d3abe2e1fd175d7bb6594575b1f5ae44723447b86a29309628f18dff0ef) (block 60133847, 20:50:38 UK)
- approve [`0x79398e1b8b7d9ec31d4927782d2329292165978f245bfb4b70c9c7c2e7488d9f`](https://base-sepolia.blockscout.com/tx/0x79398e1b8b7d9ec31d4927782d2329292165978f245bfb4b70c9c7c2e7488d9f) (block 60133930, 20:50:54 UK)

An earlier rehearsal setMandate from the first recorder pass: [`0x8c75c2c2dcab18c9b23917581b87a72028f2194d0e87767f0bcb42b3ca4bb6c2`](https://base-sepolia.blockscout.com/tx/0x8c75c2c2dcab18c9b23917581b87a72028f2194d0e87767f0bcb42b3ca4bb6c2) (20:47:21 UK). Remaining deployer balance after these writes: about 0.00009360 ETH. No other wallet was used.

## Balances after this session

- Deployer nonce: 4
- Remaining Base Sepolia ETH: **≈ 0.00009510** (17 Nov 2026, 11:50:33 UK)
- Enough leftover for further test writes at the then gas price (~0.006 gwei). Still test ETH only.

## Record

| Date (UK) | Network | Contract | Deploy tx | Verified | Notes |
| --- | --- | --- | --- | --- | --- |
| 17 Nov 2026, 11:41 | Base Sepolia (84532) | — | — | — | Address unfunded. No deploy. |
| 17 Nov 2026, 11:47:41 | Base Sepolia (84532) | [`0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188`](https://base-sepolia.blockscout.com/address/0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188?tab=contract) | [`0xf42e597cd77b05a3d7ea04bc2d998595ef413636afdc1d4e3688af7c7d21593a`](https://sepolia.basescan.org/tx/0xf42e597cd77b05a3d7ea04bc2d998595ef413636afdc1d4e3688af7c7d21593a) | Blockscout yes (Solidity 0.8.24, optimizer 200, cancun). BaseScan not verified (no API key). | Funded by CDP faucet tx `0x78d2686…dee87` (0.0001 ETH, 11:46:29 UK). Demo write: MandateSet / Proposed / Approved in txs listed above. |

# Steward spike — findings

**When:** Thursday 12 November 2026, Europe/London (GMT / UTC+0)  
**Where:** `/workspace/money/hackathons/base-stocks/steward/` (local git only; no remote, no push, no GitHub)  
**Scope:** Read-only Mainnet + API proofs, a mandate → proposal engine with unit tests, and a Base Sepolia-oriented approval-log contract compiled and tested locally. No deploy, no faucet, no wallet, no keys, no sign-ups, no spend, no posts.

## What works

### 1. Free Tokenized Stocks API (no key)

- `GET https://api.coinbase.com/v1/tokenized-stocks` returned **338** records, paginated (`page_size` up to 100, `next_page_token`).
- `GET …/chains` returned Base Mainnet (`chain_id` 8453) plus `policy_registry_address` `0x8453…0002`, `token_supply_manager_address` `0xD1Ca4dAcdf3231011D175351f1f02D15C7c5664C`, `token_factory_address` `0x4bA3E29E254F25E94E61C4c9d67b37027331534D`.
- `GET …/metadata/{ticker}` returns contract, name, prospectus URL, description, ADGM ISIN. It does **not** include NAV or multiplier — those are on the list endpoint (and on-chain).
- List records for the demo basket include `contract_address`, `decimals` (8), `multiplier`, `nav_price`, `nav_price_updated_at`, `total_supply`, `isin`, `first_mint_date`. `paused_features` was omitted (API omits empty / default fields).
- Run: `npm run spike`.

### 2. Chainlink NAV feeds on Base Mainnet (public RPC, eth_call, no gas)

- Public RPC `https://mainnet.base.org` answered `eth_chainId = 0x2105` (8453) and served `eth_call` without a key.
- All **ten** official Coinbase equity feeds listed in [List Tokenized Stocks](https://docs.base.org/build-on-base/integrate-defi/list-tokenized-stocks) returned `latestRoundData()` and `decimals() = 8`. Sample at about 10:32–10:36 UTC on 12 Nov 2026:

  | Feed | Price | `updatedAt` (UTC) |
  | --- | ---: | --- |
  | AAPL | 356.55 | 11 Nov 22:25 |
  | AMZN | 266.77 | 12 Nov 09:11 |
  | GOOGL | 293.84077106 | 12 Nov 10:05 |
  | META | 628.65237016 | 12 Nov 02:34 |
  | MSFT | 520.369 | 11 Nov 23:23 |
  | MSTR | 117.005 | 12 Nov 10:00 |
  | NVDA | 163.36 then 164.248 a few minutes later | 12 Nov 10:09 / 10:35 |
  | SNDK | 945.114 | 12 Nov 10:09 |
  | SPCX | 140.64 | 12 Nov 09:57 |
  | TSLA | 389.105 | 12 Nov 09:40 |

- **API `nav_price` and `nav_price_updated_at` matched the Chainlink answer and `updatedAt` exactly** on every name we compared. The API NAV is the Chainlink total-return value (underlying × multiplier), not a raw share price. Position value is therefore `(raw / 10^decimals) * nav`.
- Off-hours hold is real: at 10:36 UTC on a Thursday (05:36 US Eastern, before the cash open) AAPL, META and MSFT were still on the previous session’s last tick (ages ~8–12 hours). That is **not** a 24h heartbeat failure. The engine treats age > 8h as a soft `held_off_hours` flag and only **blocks** after 72h (covers a long weekend). Docs: feeds update on a 0.5% deviation or a 24h heartbeat *during market hours*, and hold last close off-hours.

### 3. B20 multiplier and corporate-action state (eth_call, no gas)

- View functions from the [IB20Asset spec](https://docs.base.org/specifications/b20/reference/interfaces/ib20-asset) all answered on the Coinbase token precompiles (`0xb200…` addresses):
  - `uiMultiplier()` (`0xa60bf13d`)
  - `newUIMultiplier()` (`0xdc767007`)
  - `effectiveAt()` (`0x97a4064f`)
  - `WAD_PRECISION()` (`0x664808a8`) → `1e18`
  - `decimals()` → 8
  - `name()`
- On-chain multipliers matched the API for 1.0 names exactly (AAPL, AMZN, MSFT, TSLA). For dividend-adjusted names (GOOGL `1.000377118676784`, NVDA `1.0005379395763696`, META `1.0003137922895982`) the API value is a JSON number with ~15 significant digits, so converting it to a WAD can be off by tens of units at the 18th decimal (observed diffs around 21). **That is float rounding, not a real disagreement. Use the on-chain `uiMultiplier` for any math.** The snapshotter treats sub-ppb differences as a match.
- **No live pending corporate action** at spike time: `effectiveAt() = 0` on the whole demo basket. When nothing is pending, `newUIMultiplier()` equals the current `uiMultiplier()`, so a pending update must be detected with `effectiveAt() > now`, not by comparing the two multipliers. This matches the official B20 docs (“a pending update is active while `effectiveAt() > block.timestamp`”; do not infer from a zero/non-zero multiplier).
- The engine flags a pending CA and **will not buy more** of that name (unit-tested with a fixture, because none was live on Mainnet today).

### 4. Mandate → rebalance engine

Pure function in `src/engine/propose.js`. No I/O, no LLM, no spend. Rules:

- Equal-weight the universe after a cash sleeve, each name capped at `maxWeightBps`; leftover from caps stays cash.
- Hold if max drift is inside `rebalanceThresholdBps`.
- Block if the universe is empty, portfolio value is zero, or **every** NAV is stale.
- Do not buy a stale or pending-CA name; leftover stays cash.
- `neverAutoSpend` is on by default; the brief says this is a proposal, not an order.
- UI shares = `raw * uiMultiplier / 1e18`. Value uses NAV (already total-return), not a second multiplier.

**14/14** `node --test` cases pass (offline fixtures): rebalance, hold, max-weight cap, all-stale block, skip stale buy, skip pending-CA buy, empty/zero block, off-hours soft flag, never-auto-spend.

A live run against the 12 Nov snapshot, with a synthetic book of $90k AAPLc + $10k cash, max 30%, 10% sleeve, produced a `rebalance`: sell AAPL down from 90% and buy the other six demo names up to 12.857% each (30% cap is not binding at 7 names: equal risk weight is ~12.86%, sleeve 10%). Off-hours flags on AAPL/META/MSFT did not block. Dust of a few microdollars on total value is from integer division (`raw = usd * 10^decimals / nav`).

### 5. Approval-log contract (compile + local tests, not deployed)

`contracts/StewardProposalLog.sol` (Solidity 0.8.24, MIT):

- Owner `setMandate(mandateHash)`.
- Anyone (e.g. an agent address) may `propose` against the owner’s **current** mandate.
- Only the owner may `approve` or `reject`, and only from `Proposed`. Approving **does not move funds**.
- Custom errors: `EmptyHash`, `UnknownProposal`, `NotOwner`, `MandateMismatch`, `NotProposed`, `NoMandate`.

Foundry is **not** installed on this box. The contract is compiled and tested with **project-local Hardhat 2** (`npx hardhat`, no global install). The in-process chain is tagged with Base Sepolia’s id **84532** for realism; **no Sepolia RPC, no faucet, no deploy script, no wallet**. ERC-8021 Builder Codes are documented as an app-layer calldata suffix to add when we later send real testnet txs — they do not belong in the contract.

**6/6** Hardhat tests pass (mandate + propose, owner-only approve-once, reject, mandate mismatch, no-mandate / empty hash, local chain id 84532).

`npm test` runs both suites sequentially (engine then contracts).

## Blockers and limits (none are hard stops for the next milestone)

1. **Official on-chain feeds cover 10 names only** (the docs table). The other ~328 API tickers have API NAV but no documented Chainlink proxy. The demo basket is a subset of those 10. A wider universe would fall back to API NAV and should be labelled as such.
2. **No pending corporate-action example on Mainnet today.** Pending-CA behaviour is unit-tested, not live-proven. Worth re-checking around an actual dividend/split.
3. **Announcement event history** (`Announcement` / `UIMultiplierUpdated`) was not queried. `eth_getLogs` over a long range can be heavy on a public RPC; view functions are enough for “is something pending now.” Historical CA narrative can wait.
4. **On-chain pause / policy registry** (`0x8453…0002`, Onchain Registry `0x3f3E8cf41cdd3b1D118c16471aB0113DfDDd5CaD` from the docs) was not fully ABI-spiked. The list API’s `paused_features` was empty for the demo basket. Worth a small follow-up before relying on a pause flag in the engine.
5. **No DEX premium** in this spike (optional CoinGecko / pool read). NAV vs secondary-market spread is still a planned product edge, not a blocker.
6. **Hardhat downloaded solc 0.8.24** into its compiler cache on first compile (normal; not a global toolchain install). `keccak`’s optional native install script was not approved; tests passed on the JS fallback.
7. **Faucet / Sepolia deploy is still ahead**, and still needs Ali / MMG before any wallet or testnet ETH. This spike deliberately stopped short of that. The earlier PLAN milestone that mentioned “Sepolia faucet + a hello contract” is **not** done, by instruction.

## Layout

```
steward/
  src/constants.js          feeds, API URL, selectors, stale windows
  src/data/api.js           Tokenized Stocks API client
  src/data/rpc.js           eth_call helper
  src/data/onchain.js       B20 + Chainlink readers
  src/data/snapshot.js      merge API + on-chain, freshness flags
  src/engine/propose.js     pure mandate → proposal
  contracts/StewardProposalLog.sol
  test/engine.test.js       14 offline tests (node:test)
  test/contracts/…          6 Hardhat tests
  scripts/spike-reads.js    live probe
  SPIKE.md                  this file
```

Commands: `npm run spike`, `npm run test:engine`, `npm run compile`, `npm test`.

## Decisions for Ali

None that have to be taken for this spike to stand. The previous plan’s Ali gates still apply before the next milestone does anything public or on-chain:

1. Go ahead to keep building Steward (this spike did not surface a reason to switch to the IndexKit backup).
2. Private `halfabillion` GitHub repo — still not created; this folder is a **local** git repo only.
3. Public demo hosting, public source, and any X posts — still Ali’s, still drafts-only from the agent.
4. **Sepolia deploy / faucet / a signing wallet** — not done, and should not be done without Ali’s OK. No mainnet gas is needed. When that OK comes, we can use a throwaway dev key that never holds real funds, or Ali’s own testnet wallet; we will not create a wallet unasked.
5. Registration form and Bankr / Telegram — still recommended to wait / skip, as in `../PLAN.md`.

No other spend, account, or legal decision came out of the live reads.

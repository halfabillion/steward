"use strict";

/**
 * Judge-friendly entry point for the guided demo.
 * Default: in-process Hardhat (chain id 84532) + API + web app, same as `npm run dev`.
 * Opt-in live Base Sepolia: STEWARD_NETWORK=base-sepolia (chain-id 84532 guard, gas check,
 * in-app confirmation). Never logs private keys.
 */
const PORT = Number(process.env.STEWARD_PORT || 5173);
const HOST = "127.0.0.1";
const live = String(process.env.STEWARD_NETWORK || "").toLowerCase() === "base-sepolia"
  || String(process.env.STEWARD_NETWORK || "") === "84532"
  || String(process.env.STEWARD_NETWORK || "").toLowerCase() === "sepolia";

console.log(`
Steward — guided demo
=====================

Default is the local app (in-process Hardhat tagged chain id 84532).
Opt-in live writes: STEWARD_NETWORK=base-sepolia
Open  http://${HOST}:${PORT}
${live ? "\nLIVE MODE: writes go to StewardProposalLog on Base Sepolia after in-app confirmation.\nChain id must be 84532. Gas is estimated before each sign. The key is never printed.\n" : ""}

The UI walks a judge through four steps:

  1. Mandate       Keep the demo defaults (7-name basket, $90k AAPLc, $10k cash)
                   and save them to the local proposal log.
  2. Proposal      Run the steward. Expect a rebalance: sell some AAPLc, buy the
                   other names, keep a 10% cash sleeve.
  3. Paper fill    Approve. The paper book updates. No funds move.
  4. Proposal log  Confirm MandateSet, Proposed, and Approved on chain id 84532
                   (local Hardhat by default, or Base Sepolia when opted in).

Attest and enter first. Never auto-spend is locked on.
Stop with Ctrl-C.
`);

require("../server/dev.cjs");

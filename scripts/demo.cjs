"use strict";

/**
 * Judge-friendly entry point for the local guided demo.
 * Starts the same in-process Hardhat (chain id 84532) + API + web app as `npm run dev`.
 * Never points at a public chain. Never logs private keys.
 */
const PORT = Number(process.env.STEWARD_PORT || 5173);
const HOST = "127.0.0.1";

console.log(`
Steward — guided demo
=====================

One command starts the local app (in-process Hardhat tagged chain id 84532 only).
Open  http://${HOST}:${PORT}

The UI walks a judge through four steps:

  1. Mandate       Keep the demo defaults (7-name basket, $90k AAPLc, $10k cash)
                   and save them to the local proposal log.
  2. Proposal      Run the steward. Expect a rebalance: sell some AAPLc, buy the
                   other names, keep a 10% cash sleeve.
  3. Paper fill    Approve. The paper book updates. No funds move.
  4. Proposal log  Confirm MandateSet, Proposed, and Approved on the in-process
                   chain (id 84532). Nothing is deployed to a public network.

Attest and enter first. Never auto-spend is locked on.
Stop with Ctrl-C.
`);

require("../server/dev.cjs");

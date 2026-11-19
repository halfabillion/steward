"use strict";

/**
 * Guided live demo against the deployed StewardProposalLog on Base Sepolia.
 *
 *   npm run demo:live
 *
 * Checks the testnet deployer balance first, estimates gas for the three
 * writes, and stops without sending if the balance is too low. Uses only
 * the existing Base Sepolia ETH in that deployer. Never prints the key.
 * The contract is a proposal log: it never moves funds.
 *
 *   npm run demo:live -- --dry-run
 *     Snapshot + preflight only. No transaction is sent.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const ARTIFACT = path.join(ROOT, "artifacts", "contracts", "StewardProposalLog.sol", "StewardProposalLog.json");
const DEFAULT_EVIDENCE_DIR = path.join(ROOT, "submit", "live-runs");

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function hasFlag(name) {
  return process.argv.slice(2).includes(name);
}

function utcStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

async function main() {
  const dryRun = hasFlag("--dry-run") || String(process.env.STEWARD_DEMO_LIVE || "").toLowerCase() === "dry-run";

  const [{ startSepoliaLive }, mode, live] = await Promise.all([
    Promise.resolve(require("../server/sepoliaLive.cjs")),
    import(pathToFileURL(path.join(ROOT, "src", "networkMode.js")).href),
    import(pathToFileURL(path.join(ROOT, "src", "demoLive.js")).href),
  ]);
  const { snapshotUniverse } = await import(pathToFileURL(path.join(ROOT, "src", "data", "snapshot.js")).href);

  const network = mode.resolveNetwork({ ...process.env, STEWARD_NETWORK: process.env.STEWARD_NETWORK || "base-sepolia" });
  if (!network.live) {
    die('Refusing: npm run demo:live talks to Base Sepolia only. Do not set STEWARD_NETWORK=local.');
  }
  if (!fs.existsSync(ARTIFACT)) {
    die("Refusing: contract artifact is missing. Run `npx hardhat compile` first.");
  }

  let session;
  try {
    session = await startSepoliaLive(network);
  } catch (err) {
    die(`Refusing: ${mode.redactSecrets(err && err.message ? err.message : err)}`);
  }

  const { abi } = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  // Re-bind so encode/parse uses the same ABI as the session contract.
  const logContract = session.contract;

  async function takeSnapshot() {
    const { demoMandateDefaults } = await import(pathToFileURL(path.join(ROOT, "src", "demoFlow.js")).href);
    const symbols = demoMandateDefaults().universe;
    return snapshotUniverse(symbols, { dexMarket: true });
  }

  const result = await live.runDemoLive({
    provider: session.provider,
    logContract,
    ownerAddress: session.address,
    contractAddress: session.contractAddress,
    explorerOrigin: network.explorerOrigin,
    expectedChainId: network.chainId,
    dryRun,
    takeSnapshot,
    sendTx: async (call) => session.sendTx({ to: call.to, data: call.data }),
    log: (line) => console.log(line),
  });

  const evidenceDir = process.env.STEWARD_EVIDENCE_DIR || DEFAULT_EVIDENCE_DIR;
  fs.mkdirSync(evidenceDir, { recursive: true });
  const outPath = path.join(evidenceDir, `${utcStamp()}-demo-live.json`);
  const payload = {
    recordedAt: new Date().toISOString(),
    recordedAtUK: new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }) + " UK",
    network: "base-sepolia",
    chainId: network.chainId,
    contract: session.contractAddress,
    owner: session.address,
    dryRun,
    ok: result.ok,
    skipped: result.skipped || false,
    error: result.error || null,
    txs: result.txs || null,
    evidence: result.evidence,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log("");
  console.log(`Evidence    ${path.relative(ROOT, outPath)}`);

  if (!result.ok) process.exit(result.skipped ? 2 : 1);
}

main().catch((err) => {
  console.error("Live demo failed:", String(err && err.message ? err.message : err).replace(/0x[0-9a-fA-F]{64}/g, "0x[redacted-32-byte]"));
  process.exit(1);
});

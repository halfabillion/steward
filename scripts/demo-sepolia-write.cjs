"use strict";

/**
 * Optional one-time Base Sepolia demo write against a deployed StewardProposalLog:
 * setMandate → propose → approve. Paper evidence only; the contract never moves funds.
 *
 *   STEWARD_DEMO_WRITE=yes node scripts/demo-sepolia-write.cjs
 *
 * Refuses unless STEWARD_DEMO_WRITE=yes and chain id is 84532. Never prints the key.
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const EXPECTED_CHAIN_ID = 84532n;
const DEFAULT_RPC = "https://sepolia.base.org";
const DEFAULT_KEY_FILE = "/workspace/money/hackathons/base-stocks/.secrets/sepolia-deployer.key";
const DEFAULT_CONTRACT = "0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188";
const ARTIFACT = path.join(__dirname, "..", "artifacts", "contracts", "StewardProposalLog.sol", "StewardProposalLog.json");

// Canonical demo body, documented in docs/DEPLOYMENTS.md. Hashes are keccak256 of these exact UTF-8 strings.
const MANDATE_JSON = JSON.stringify({
  name: "Steward Base Sepolia demo",
  universe: ["AAPLc", "AMZNc", "GOOGLc", "METAc", "MSFTc", "NVDAc", "TSLAc"],
  maxWeightBps: 3000,
  cashSleeveBps: 1000,
  rebalanceThresholdBps: 200,
  neverAutoSpend: true,
  note: "Demo write 2026-11-17. Paper evidence only. No funds move.",
});
const RESEARCH_JSON = JSON.stringify({
  source: "demo",
  date: "2026-11-17",
  note: "Placeholder research hash for on-chain log evidence. Not a live snapshot.",
});
const PROPOSAL_JSON = JSON.stringify({
  action: "rebalance",
  neverAutoSpend: true,
  note: "Placeholder proposal body for on-chain log evidence. Not an executable trade.",
});

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function readKey(file) {
  const st = fs.statSync(file);
  if ((st.mode & 0o077) !== 0) {
    die(`Refusing to read key file: group/other bits are set.`);
  }
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw) && !/^[0-9a-fA-F]{64}$/.test(raw)) {
    die("Refusing: unexpected key format (value not printed).");
  }
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

function redact(msg) {
  return String(msg).replace(/0x[0-9a-fA-F]{64}/g, "0x[redacted-32-byte]");
}

async function main() {
  if (process.env.STEWARD_DEMO_WRITE !== "yes") {
    die("Refusing: set STEWARD_DEMO_WRITE=yes to write a demo mandate/proposal on Base Sepolia.");
  }
  const keyFile = process.env.STEWARD_DEPLOYER_KEY_FILE || DEFAULT_KEY_FILE;
  const rpcUrl = process.env.STEWARD_SEPOLIA_RPC || DEFAULT_RPC;
  const contractAddr = process.env.STEWARD_LOG_ADDRESS || DEFAULT_CONTRACT;
  if (!fs.existsSync(ARTIFACT)) die("Compile first: npx hardhat compile.");

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  const provider = new ethers.JsonRpcProvider(rpcUrl, EXPECTED_CHAIN_ID, { staticNetwork: true });
  const net = await provider.getNetwork();
  if (net.chainId !== EXPECTED_CHAIN_ID) {
    die(`Refusing: expected chain id ${EXPECTED_CHAIN_ID}, got ${net.chainId}.`);
  }

  const wallet = new ethers.Wallet(readKey(keyFile), provider);
  const balance = await provider.getBalance(wallet.address);
  if (balance === 0n) die("Refusing: deployer balance is 0.");

  const mandateHash = ethers.keccak256(ethers.toUtf8Bytes(MANDATE_JSON));
  const researchHash = ethers.keccak256(ethers.toUtf8Bytes(RESEARCH_JSON));
  const proposalHash = ethers.keccak256(ethers.toUtf8Bytes(PROPOSAL_JSON));

  const log = new ethers.Contract(contractAddr, artifact.abi, wallet);
  console.log(`Network       Base Sepolia (${net.chainId})`);
  console.log(`Owner         ${wallet.address}`);
  console.log(`Contract      ${contractAddr}`);
  console.log(`Balance       ${ethers.formatEther(balance)} ETH`);
  console.log(`mandateHash   ${mandateHash}`);
  console.log(`researchHash  ${researchHash}`);
  console.log(`proposalHash  ${proposalHash}`);

  const tx1 = await log.setMandate(mandateHash);
  const rc1 = await tx1.wait();
  console.log(`setMandate    ${rc1.hash}  block ${rc1.blockNumber}`);

  const tx2 = await log.propose(wallet.address, mandateHash, researchHash, proposalHash);
  const rc2 = await tx2.wait();
  let proposalId = null;
  for (const ev of rc2.logs) {
    try {
      const parsed = log.interface.parseLog({ topics: ev.topics, data: ev.data });
      if (parsed && parsed.name === "Proposed") {
        proposalId = parsed.args.proposalId;
      }
    } catch {
      /* not our event */
    }
  }
  if (!proposalId) die("Propose succeeded but Proposed event was not parsed.");
  console.log(`propose       ${rc2.hash}  block ${rc2.blockNumber}`);
  console.log(`proposalId    ${proposalId}`);

  const tx3 = await log.approve(proposalId);
  const rc3 = await tx3.wait();
  console.log(`approve       ${rc3.hash}  block ${rc3.blockNumber}`);
  const stored = await log.proposals(proposalId);
  console.log(`status        ${Number(stored.status)} (2 = Approved)`);
}

main().catch((err) => {
  console.error("Demo write failed:", redact(err && err.message ? err.message : err));
  process.exit(1);
});

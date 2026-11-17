"use strict";

/**
 * Gated Base Sepolia deploy of StewardProposalLog.
 *
 *   STEWARD_DEPLOY=yes node scripts/deploy-sepolia.cjs
 *
 * Refuses to run unless STEWARD_DEPLOY=yes, the connected chain id is 84532,
 * and the deployer key file has enough test ETH. Never prints or logs the key.
 * Does not add a public network to hardhat.config.cjs.
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const EXPECTED_CHAIN_ID = 84532n;
const DEFAULT_RPC = "https://sepolia.base.org";
const DEFAULT_KEY_FILE = "/workspace/money/hackathons/base-stocks/.secrets/sepolia-deployer.key";
const ARTIFACT = path.join(__dirname, "..", "artifacts", "contracts", "StewardProposalLog.sol", "StewardProposalLog.json");
const RECORD = path.join(__dirname, "..", "docs", "DEPLOYMENTS.md");

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function readKey(file) {
  const st = fs.statSync(file);
  if ((st.mode & 0o077) !== 0) {
    die(`Refusing to read key file: group/other bits are set (${file}).`);
  }
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw) && !/^[0-9a-fA-F]{64}$/.test(raw)) {
    die("Refusing: unexpected key format (value not printed).");
  }
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

async function main() {
  if (process.env.STEWARD_DEPLOY !== "yes") {
    die("Refusing: set STEWARD_DEPLOY=yes to run a Base Sepolia deploy. No network call made.");
  }

  const keyFile = process.env.STEWARD_DEPLOYER_KEY_FILE || DEFAULT_KEY_FILE;
  const rpcUrl = process.env.STEWARD_SEPOLIA_RPC || DEFAULT_RPC;
  if (!fs.existsSync(keyFile)) die(`Key file not found (path not printed in detail).`);
  if (!fs.existsSync(ARTIFACT)) {
    die("Compile first: npx hardhat compile. Artifact missing.");
  }

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  const provider = new ethers.JsonRpcProvider(rpcUrl, EXPECTED_CHAIN_ID, { staticNetwork: true });
  const net = await provider.getNetwork();
  if (net.chainId !== EXPECTED_CHAIN_ID) {
    die(`Refusing: expected chain id ${EXPECTED_CHAIN_ID}, got ${net.chainId}.`);
  }

  const wallet = new ethers.Wallet(readKey(keyFile), provider);
  const address = wallet.address;
  const balance = await provider.getBalance(address);
  const feeData = await provider.getFeeData();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const gas = await factory.getDeployTransaction().then((tx) => provider.estimateGas({ ...tx, from: address }));
  const maxFee = feeData.maxFeePerGas || feeData.gasPrice || 0n;
  const needed = gas * maxFee * 12n / 10n; // 20% headroom
  console.log(`Network          Base Sepolia (${net.chainId})`);
  console.log(`Deployer         ${address}`);
  console.log(`Balance          ${ethers.formatEther(balance)} ETH`);
  console.log(`Estimated gas    ${gas.toString()}`);
  console.log(`Needed (w/ 20%)  ${ethers.formatEther(needed)} ETH`);

  if (balance === 0n) {
    die("Refusing: deployer balance is 0. Claim free Base Sepolia ETH first (see docs/DEPLOYMENTS.md).");
  }
  if (balance < needed) {
    die(`Refusing: balance is below the estimated gas (+20%). No transaction sent.`);
  }

  console.log("Sending deploy transaction…");
  const contract = await factory.deploy();
  const tx = contract.deploymentTransaction();
  const receipt = await contract.deploymentTransaction().wait();
  const contractAddress = await contract.getAddress();
  const txHash = receipt.hash;
  console.log(`Contract         ${contractAddress}`);
  console.log(`Deploy tx        ${txHash}`);
  console.log(`Block            ${receipt.blockNumber}`);
  console.log(`Explorer         https://sepolia.basescan.org/tx/${txHash}`);
  console.log(`Blockscout       https://base-sepolia.blockscout.com/tx/${txHash}`);

  const now = new Date();
  const uk = now.toISOString().replace("T", " ").replace(/\..+/, " UTC");
  const row = `| ${uk} (convert to UK) | Base Sepolia (84532) | \`${contractAddress}\` | [\`${txHash}\`](https://sepolia.basescan.org/tx/${txHash}) | pending | Script \`scripts/deploy-sepolia.cjs\`. |\n`;
  if (fs.existsSync(RECORD)) {
    fs.appendFileSync(RECORD, `\n${row}`);
    console.log(`Appended a row to docs/DEPLOYMENTS.md (please tidy the date to UK time).`);
  }
}

main().catch((err) => {
  const msg = err && err.message ? String(err.message) : String(err);
  // Avoid accidentally echoing a key if a library included it in a message.
  const safe = msg.replace(/0x[0-9a-fA-F]{64}/g, "0x[redacted]");
  console.error("Deploy failed:", safe);
  process.exit(1);
});

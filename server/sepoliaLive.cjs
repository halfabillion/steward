"use strict";

/**
 * Live Base Sepolia writer for the demo app.
 * Reads the deployer key from a file at runtime only. Never prints, logs, or echoes it.
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ROOT = path.join(__dirname, "..");
const ARTIFACT = path.join(ROOT, "artifacts", "contracts", "StewardProposalLog.sol", "StewardProposalLog.json");

async function loadMode() {
  return import("../src/networkMode.js");
}

function makeProvider(rpcUrl) {
  const freq = new ethers.FetchRequest(rpcUrl);
  freq.setHeader("user-agent", "Mozilla/5.0 StewardDemo");
  freq.setHeader("content-type", "application/json");
  return new ethers.JsonRpcProvider(freq);
}

function loadWallet(keyFile, provider) {
  if (!fs.existsSync(keyFile)) {
    throw new Error("Refusing: deployer key file is missing.");
  }
  let raw;
  try {
    raw = fs.readFileSync(keyFile, "utf8").trim();
  } catch {
    throw new Error("Refusing: deployer key file could not be read.");
  }
  try {
    const wallet = new ethers.Wallet(raw, provider);
    raw = "";
    return wallet;
  } catch {
    raw = "";
    throw new Error("Refusing: deployer key file could not be used.");
  }
}

async function startSepoliaLive(network, opts = {}) {
  const mode = await loadMode();
  const keyFile = mode.defaultKeyFilePath(ROOT, process.env);
  const provider = makeProvider(network.rpcUrl);
  const net = await provider.getNetwork();
  mode.assertChainId(net.chainId, network.chainId);

  const wallet = loadWallet(keyFile, provider);
  const expected = (opts.expectedOwner || mode.EXPECTED_DEPLOYER).toLowerCase();
  if (wallet.address.toLowerCase() !== expected) {
    throw new Error("Refusing: signer address does not match the known testnet deployer.");
  }

  if (!fs.existsSync(ARTIFACT)) {
    throw new Error("Refusing: contract artifact is missing. Run `npx hardhat compile` first.");
  }
  const { abi } = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  const contract = new ethers.Contract(network.contract, abi, wallet);
  const sessionFromBlock = Number(await provider.getBlockNumber());
  const balance = await provider.getBalance(wallet.address);

  async function waitForReceipt(hash, timeoutMs = 90_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const rc = await provider.getTransactionReceipt(hash);
      if (rc && rc.blockNumber != null) return rc;
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Timed out waiting for the transaction to be mined. No further transaction was sent.");
  }

  async function sendTx({ to, data }) {
    try {
      const result = await mode.guardedSend({
        provider,
        signer: wallet,
        to: to || network.contract,
        data,
        expectedChainId: network.chainId,
        skipWait: true,
      });
      const hash = result.tx.hash;
      // Public tx hash only — never the key.
      console.log(`Sepolia tx sent    ${hash}`);
      const receipt = await waitForReceipt(hash);
      console.log(`Sepolia tx mined   ${hash} block ${receipt.blockNumber} status ${receipt.status}`);
      return receipt;
    } catch (err) {
      throw new Error(mode.redactSecrets(err && err.message ? err.message : err));
    }
  }

  return {
    provider,
    wallet,
    contract,
    contractAddress: network.contract,
    chainId: Number(net.chainId),
    address: wallet.address,
    sessionFromBlock,
    balance,
    sendTx,
  };
}

module.exports = { startSepoliaLive, makeProvider };

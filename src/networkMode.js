/**
 * Network selection, chain-id guard, Blockscout links, and a gas check
 * used before any live Base Sepolia write. Pure helpers — no RPC, no key I/O.
 */
import path from "node:path";

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const SEPOLIA_LOG_ADDRESS = "0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188";
export const DEFAULT_SEPOLIA_RPC = "https://sepolia.base.org";
export const DEFAULT_KEY_RELATIVE = "../.secrets/sepolia-deployer.key";
export const BLOCKSCOUT_ORIGIN = "https://base-sepolia.blockscout.com";
export const EXPECTED_DEPLOYER = "0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F";

const LIVE_ALIASES = new Set(["base-sepolia", "sepolia", "84532"]);
const LOCAL_ALIASES = new Set(["", "local", "hardhat", "local-84532"]);

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 */
export function resolveNetwork(env = {}) {
  const raw = String(env.STEWARD_NETWORK ?? "").trim().toLowerCase();
  if (LIVE_ALIASES.has(raw)) {
    const contract = env.STEWARD_LOG_ADDRESS || SEPOLIA_LOG_ADDRESS;
    const rpcUrl = env.STEWARD_SEPOLIA_RPC || DEFAULT_SEPOLIA_RPC;
    return {
      mode: "base-sepolia",
      live: true,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      name: "base-sepolia",
      label: "Base Sepolia (live testnet, chain id 84532)",
      contract,
      rpcUrl,
      explorerOrigin: BLOCKSCOUT_ORIGIN,
    };
  }
  if (!LOCAL_ALIASES.has(raw)) {
    throw new Error(
      `Unknown STEWARD_NETWORK=${JSON.stringify(raw)}. Use "local" (default) or "base-sepolia".`,
    );
  }
  return {
    mode: "local",
    live: false,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    name: "local-84532",
    label: "Local Hardhat, tagged as Base Sepolia (84532). Not a public chain.",
    contract: null,
    rpcUrl: null,
    explorerOrigin: null,
  };
}

/**
 * Strict chain-id guard. Refuses to continue (and therefore to sign) unless
 * the RPC-reported id is exactly 84532.
 * @param {bigint | number | string} reported
 * @param {number} [expected]
 */
export function assertChainId(reported, expected = BASE_SEPOLIA_CHAIN_ID) {
  let got;
  try {
    got = Number(typeof reported === "bigint" ? reported : BigInt(reported));
  } catch {
    throw new Error(`Refusing to sign: expected chain id ${expected}, got ${String(reported)}.`);
  }
  if (!Number.isInteger(got) || got !== Number(expected)) {
    throw new Error(`Refusing to sign: expected chain id ${expected}, got ${reported}.`);
  }
  return got;
}

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDR = /^0x[0-9a-fA-F]{40}$/;

export function blockscoutTxUrl(hash, origin = BLOCKSCOUT_ORIGIN) {
  const h = String(hash || "");
  if (!TX_HASH.test(h)) {
    throw new Error("Invalid transaction hash for Blockscout link.");
  }
  return `${origin}/tx/${h}`;
}

export function blockscoutAddressUrl(address, origin = BLOCKSCOUT_ORIGIN) {
  const a = String(address || "");
  if (!ADDR.test(a)) {
    throw new Error("Invalid address for Blockscout link.");
  }
  return `${origin}/address/${a}`;
}

export function attachTxUrl(hash, live, origin = BLOCKSCOUT_ORIGIN) {
  if (!live || !hash) return null;
  try {
    return blockscoutTxUrl(hash, origin);
  } catch {
    return null;
  }
}

/** Path only. Never reads the file. Relative to the steward root: ../.secrets/sepolia-deployer.key */
export function defaultKeyFilePath(stewardRoot, env = {}) {
  if (env.STEWARD_DEPLOYER_KEY_FILE) return path.resolve(String(env.STEWARD_DEPLOYER_KEY_FILE));
  return path.resolve(stewardRoot, DEFAULT_KEY_RELATIVE);
}

/**
 * Require balance >= gasLimit * maxFeePerGas * (1 + headroomBps/10000).
 * @returns {bigint} wei needed (including headroom)
 */
export function assertGasAffordable({
  balanceWei,
  gasLimit,
  maxFeePerGas,
  headroomBps = 2000,
}) {
  const balance = BigInt(balanceWei);
  const gas = BigInt(gasLimit);
  const fee = BigInt(maxFeePerGas);
  const bps = BigInt(headroomBps);
  if (gas <= 0n || fee <= 0n) {
    throw new Error("Refusing to sign: gas estimate or fee is missing. No transaction sent.");
  }
  const needed = (gas * fee * (10000n + bps)) / 10000n;
  if (balance < needed) {
    throw new Error(
      `Refusing to sign: estimated gas ${gas.toString()} at ${fee.toString()} wei/gas (+${headroomBps} bps) needs ${needed.toString()} wei, balance is ${balance.toString()} wei. No transaction sent.`,
    );
  }
  return needed;
}

/**
 * Estimate gas, check chain id and balance, then sign. Injected provider/signer
 * so tests can mock both and never touch a network or a key file.
 *
 * Order is deliberate: chain-id first, then estimate, then balance, then sign.
 */
export async function guardedSend({
  provider,
  signer,
  to,
  data,
  expectedChainId = BASE_SEPOLIA_CHAIN_ID,
  headroomBps = 2000,
  skipWait = false,
}) {
  if (!provider || typeof provider.getNetwork !== "function") {
    throw new Error("Refusing to sign: no provider.");
  }
  if (!signer || typeof signer.sendTransaction !== "function") {
    throw new Error("Refusing to sign: no signer.");
  }
  const net = await provider.getNetwork();
  assertChainId(net.chainId, expectedChainId);
  const from = signer.address || (await signer.getAddress());
  const gasLimit = await provider.estimateGas({ to, from, data });
  const fee = await provider.getFeeData();
  const maxFee = fee.maxFeePerGas || fee.gasPrice;
  const balance = await provider.getBalance(from);
  assertGasAffordable({
    balanceWei: balance,
    gasLimit,
    maxFeePerGas: maxFee ?? 0n,
    headroomBps,
  });
  const padded = (BigInt(gasLimit) * (10000n + BigInt(headroomBps))) / 10000n;
  const tx = await signer.sendTransaction({ to, data, gasLimit: padded });
  if (skipWait) return { tx, receipt: null, gasLimit, from };
  const receipt = typeof tx.wait === "function" ? await tx.wait() : tx;
  return { tx, receipt, gasLimit, from };
}

/** Strip 32-byte hex from error text so a key can never leak via a thrown message. */
export function redactSecrets(msg) {
  return String(msg ?? "").replace(/0x[0-9a-fA-F]{64}/g, "0x[redacted-32-byte]");
}

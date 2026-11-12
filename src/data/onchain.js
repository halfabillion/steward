import {
  BASE_MAINNET_RPC,
  CHAINLINK_FEEDS,
  SELECTORS,
  WAD,
} from "../constants.js";
import { decodeAbiString, ethBlockNumber, ethCall, ethChainId, wordInt, wordUint } from "./rpc.js";

export async function readNetwork(rpcUrl = BASE_MAINNET_RPC) {
  const [chainId, blockNumber] = await Promise.all([
    ethChainId(rpcUrl),
    ethBlockNumber(rpcUrl),
  ]);
  return { chainId, blockNumber };
}

/**
 * Read B20 multiplier and pending corporate-action state.
 * A live pending update exists only while effectiveAt > now.
 * When none is pending, newUIMultiplier typically equals uiMultiplier and effectiveAt is 0.
 */
export async function readB20(tokenAddress, rpcUrl = BASE_MAINNET_RPC, nowSec = Math.floor(Date.now() / 1000)) {
  const to = tokenAddress;
  const [uiHex, newHex, effHex, wadHex, decHex, nameHex] = await Promise.all([
    ethCall(rpcUrl, to, SELECTORS.uiMultiplier),
    ethCall(rpcUrl, to, SELECTORS.newUIMultiplier),
    ethCall(rpcUrl, to, SELECTORS.effectiveAt),
    ethCall(rpcUrl, to, SELECTORS.wadPrecision),
    ethCall(rpcUrl, to, SELECTORS.decimals),
    ethCall(rpcUrl, to, SELECTORS.name),
  ]);
  const uiMultiplierWad = wordUint(uiHex);
  const newUIMultiplierWad = wordUint(newHex);
  const effectiveAt = Number(wordUint(effHex));
  const wadPrecision = wordUint(wadHex);
  const decimals = Number(wordUint(decHex));
  const name = decodeAbiString(nameHex);
  const pending = effectiveAt > nowSec;
  return {
    address: tokenAddress,
    name,
    decimals,
    wadPrecision,
    uiMultiplierWad,
    newUIMultiplierWad,
    effectiveAt,
    pendingCorporateAction: pending,
    pending: pending
      ? { newUIMultiplierWad, effectiveAt }
      : null,
  };
}

/**
 * Chainlink AggregatorV3 latestRoundData. Answer is a total-return token price, 8 decimals.
 */
export async function readChainlink(feedAddress, rpcUrl = BASE_MAINNET_RPC) {
  const [decHex, rdHex] = await Promise.all([
    ethCall(rpcUrl, feedAddress, SELECTORS.decimals),
    ethCall(rpcUrl, feedAddress, SELECTORS.latestRoundData),
  ]);
  const decimals = Number(wordUint(decHex));
  const roundId = wordUint(rdHex, 0);
  const answer = wordInt(rdHex, 1);
  const startedAt = Number(wordUint(rdHex, 2));
  const updatedAt = Number(wordUint(rdHex, 3));
  const answeredInRound = wordUint(rdHex, 4);
  if (answer < 0n) {
    throw new Error(`Chainlink feed ${feedAddress} returned a negative answer`);
  }
  return {
    address: feedAddress,
    decimals,
    roundId,
    answer,
    startedAt,
    updatedAt,
    answeredInRound,
  };
}

export function feedForSymbol(symbol) {
  return CHAINLINK_FEEDS[symbol] ?? null;
}

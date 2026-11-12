/** Official public Base Mainnet RPC. Read-only; no key, no gas. */
export const BASE_MAINNET_RPC = "https://mainnet.base.org";
export const BASE_MAINNET_CHAIN_ID = 8453;
/** Target deployment chain for the log contract (not used in this spike). */
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/** Official Tokenized Stocks API, no API key. */
export const TOKENIZED_STOCKS_API = "https://api.coinbase.com/v1/tokenized-stocks";

/**
 * Chainlink Coinbase equity total-return feeds on Base Mainnet.
 * Source: https://docs.base.org/build-on-base/integrate-defi/list-tokenized-stocks
 * 8 decimals. Token price = underlying × multiplier (already in the feed).
 */
export const CHAINLINK_FEEDS = {
  AAPLc: "0x787f13dEa48Db0897CbCDD985de77809D837F988",
  AMZNc: "0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295",
  GOOGLc: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2",
  METAc: "0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D",
  MSFTc: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c",
  MSTRc: "0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a",
  NVDAc: "0x04689a41629776563E6822F76f2e57D148d28513",
  SNDKc: "0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA",
  SPCXc: "0x6A634B235903C4ad6376892180d6fF8612e3Fa68",
  TSLAc: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4",
};

/** Default demo basket: names that have an official on-chain feed. */
export const DEMO_UNIVERSE = [
  "AAPLc",
  "AMZNc",
  "GOOGLc",
  "METAc",
  "MSFTc",
  "NVDAc",
  "TSLAc",
];

export const WAD = 10n ** 18n;
export const BPS_DENOM = 10_000n;
/** Chainlink / NAV scale. */
export const NAV_DECIMALS = 8;
export const NAV_SCALE = 10n ** BigInt(NAV_DECIMALS);

/**
 * Hard-stale window. Feeds hold last close off-hours (nights, weekends,
 * holidays). 72h covers a long weekend; shorter ages are a soft "held" flag.
 */
export const STALE_AFTER_SEC = 72 * 3600;
export const HELD_AFTER_SEC = 8 * 3600;

/** B20 view selectors (https://docs.base.org/specifications/b20/reference/interfaces/ib20-asset). */
export const SELECTORS = {
  uiMultiplier: "0xa60bf13d",
  newUIMultiplier: "0xdc767007",
  effectiveAt: "0x97a4064f",
  wadPrecision: "0x664808a8",
  decimals: "0x313ce567",
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  latestRoundData: "0xfeaf968c",
};

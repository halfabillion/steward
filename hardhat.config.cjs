require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

/** Local compile + unit tests only. No network URLs, so a deploy cannot
 *  be pointed at Base or Base Sepolia by accident. */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
  },
  paths: {
    sources: "./contracts",
    tests: "./test/contracts",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      // Tag the in-process chain with the Base Sepolia id for realism.
      // This does not connect to Sepolia.
      chainId: 84532,
    },
  },
};

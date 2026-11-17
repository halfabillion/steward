import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import {
  BASE_SEPOLIA_CHAIN_ID,
  SEPOLIA_LOG_ADDRESS,
  assertChainId,
  assertGasAffordable,
  attachTxUrl,
  blockscoutAddressUrl,
  blockscoutTxUrl,
  defaultKeyFilePath,
  guardedSend,
  redactSecrets,
  resolveNetwork,
} from "../src/networkMode.js";

describe("resolveNetwork", () => {
  it("defaults to local Hardhat tagged 84532 when STEWARD_NETWORK is unset", () => {
    const n = resolveNetwork({});
    assert.equal(n.mode, "local");
    assert.equal(n.live, false);
    assert.equal(n.chainId, 84532);
    assert.equal(n.name, "local-84532");
    assert.equal(n.contract, null);
  });

  it("treats empty, local, hardhat, and local-84532 as the default", () => {
    for (const v of ["", "local", "HARDHAT", "local-84532"]) {
      const n = resolveNetwork({ STEWARD_NETWORK: v });
      assert.equal(n.mode, "local", v);
      assert.equal(n.live, false, v);
    }
  });

  it("selects live Base Sepolia when STEWARD_NETWORK=base-sepolia", () => {
    const n = resolveNetwork({ STEWARD_NETWORK: "base-sepolia" });
    assert.equal(n.mode, "base-sepolia");
    assert.equal(n.live, true);
    assert.equal(n.chainId, 84532);
    assert.equal(n.contract, SEPOLIA_LOG_ADDRESS);
    assert.equal(n.rpcUrl, "https://sepolia.base.org");
    assert.equal(n.explorerOrigin, "https://base-sepolia.blockscout.com");
  });

  it("accepts sepolia and 84532 aliases and honours address/RPC overrides", () => {
    const n = resolveNetwork({
      STEWARD_NETWORK: "84532",
      STEWARD_LOG_ADDRESS: "0x1111111111111111111111111111111111111111",
      STEWARD_SEPOLIA_RPC: "https://example.invalid",
    });
    assert.equal(n.live, true);
    assert.equal(n.contract, "0x1111111111111111111111111111111111111111");
    assert.equal(n.rpcUrl, "https://example.invalid");
  });

  it("rejects an unknown STEWARD_NETWORK value", () => {
    assert.throws(() => resolveNetwork({ STEWARD_NETWORK: "mainnet" }), /Unknown STEWARD_NETWORK/);
    assert.throws(() => resolveNetwork({ STEWARD_NETWORK: "base" }), /Unknown STEWARD_NETWORK/);
  });
});

describe("assertChainId", () => {
  it("accepts 84532 as number, bigint, or string", () => {
    assert.equal(assertChainId(84532), 84532);
    assert.equal(assertChainId(84532n), 84532);
    assert.equal(assertChainId("84532"), 84532);
    assert.equal(assertChainId(BASE_SEPOLIA_CHAIN_ID), 84532);
  });

  it("refuses any other chain id", () => {
    for (const bad of [1, 1n, 8453, 84531, 0, "1", 11155111]) {
      assert.throws(() => assertChainId(bad), /Refusing to sign: expected chain id 84532/);
    }
    assert.throws(() => assertChainId("not-a-number"), /Refusing to sign/);
  });
});

describe("blockscout link formatting", () => {
  const hash = "0x8606005ba5138afbfc03fc618e8034af8ae9f8411a9189d578f5fa940747993a";
  const addr = "0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188";

  it("formats a tx link as base-sepolia.blockscout.com/tx/<hash>", () => {
    assert.equal(
      blockscoutTxUrl(hash),
      `https://base-sepolia.blockscout.com/tx/${hash}`,
    );
  });

  it("formats an address link", () => {
    assert.equal(
      blockscoutAddressUrl(addr),
      `https://base-sepolia.blockscout.com/address/${addr}`,
    );
  });

  it("rejects a malformed hash or address", () => {
    assert.throws(() => blockscoutTxUrl("0xabc"), /Invalid transaction hash/);
    assert.throws(() => blockscoutTxUrl(""), /Invalid transaction hash/);
    assert.throws(() => blockscoutAddressUrl("0xabc"), /Invalid address/);
  });

  it("attachTxUrl only emits a link in live mode", () => {
    assert.equal(attachTxUrl(hash, false), null);
    assert.equal(attachTxUrl(hash, true), `https://base-sepolia.blockscout.com/tx/${hash}`);
    assert.equal(attachTxUrl("nope", true), null);
    assert.equal(attachTxUrl(null, true), null);
  });
});

describe("defaultKeyFilePath", () => {
  it("resolves ../.secrets/sepolia-deployer.key relative to the steward root", () => {
    const p = defaultKeyFilePath("/workspace/money/hackathons/base-stocks/steward", {});
    assert.equal(p, path.resolve("/workspace/money/hackathons/base-stocks/.secrets/sepolia-deployer.key"));
    assert.match(p, /\.secrets\/sepolia-deployer\.key$/);
  });

  it("honours STEWARD_DEPLOYER_KEY_FILE without reading the file", () => {
    const p = defaultKeyFilePath("/tmp/steward", { STEWARD_DEPLOYER_KEY_FILE: "/tmp/custom.key" });
    assert.equal(p, path.resolve("/tmp/custom.key"));
  });
});

describe("assertGasAffordable", () => {
  it("allows a balance that covers gas plus 20% headroom", () => {
    const needed = assertGasAffordable({
      balanceWei: 1200n,
      gasLimit: 1000n,
      maxFeePerGas: 1n,
      headroomBps: 2000,
    });
    assert.equal(needed, 1200n);
  });

  it("stops when the balance is below the estimate, and does not under-report need", () => {
    assert.throws(
      () =>
        assertGasAffordable({
          balanceWei: 1199n,
          gasLimit: 1000n,
          maxFeePerGas: 1n,
          headroomBps: 2000,
        }),
      /Refusing to sign: estimated gas/,
    );
  });

  it("refuses a zero fee or gas limit", () => {
    assert.throws(
      () => assertGasAffordable({ balanceWei: 10n ** 18n, gasLimit: 0n, maxFeePerGas: 1n }),
      /gas estimate or fee is missing/,
    );
  });
});

describe("guardedSend (mocked signer, no network)", () => {
  const to = SEPOLIA_LOG_ADDRESS;
  const data = "0x1234";

  function mock({ chainId = 84532n, gasLimit = 21_000n, fee = 8n, balance = 10n ** 18n, send } = {}) {
    const calls = { estimate: 0, send: 0, network: 0, balance: 0 };
    const provider = {
      getNetwork: async () => {
        calls.network += 1;
        return { chainId };
      },
      estimateGas: async () => {
        calls.estimate += 1;
        return gasLimit;
      },
      getFeeData: async () => ({ maxFeePerGas: fee, gasPrice: fee }),
      getBalance: async () => {
        calls.balance += 1;
        return balance;
      },
    };
    const sent = [];
    const signer = {
      address: "0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F",
      sendTransaction: async (tx) => {
        calls.send += 1;
        sent.push(tx);
        if (send) return send(tx);
        const hash = "0x" + "11".repeat(32);
        return { hash, wait: async () => ({ hash, status: 1 }) };
      },
    };
    return { provider, signer, calls, sent };
  }

  it("signs only after a 84532 chain-id check and a sufficient gas estimate", async () => {
    const { provider, signer, calls, sent } = mock();
    const result = await guardedSend({ provider, signer, to, data });
    assert.equal(calls.network, 1);
    assert.equal(calls.estimate, 1);
    assert.equal(calls.send, 1);
    assert.equal(result.receipt.hash, "0x" + "11".repeat(32));
    assert.equal(sent[0].to, to);
    assert.equal(sent[0].data, data);
    // 21000 * 1.2 = 25200
    assert.equal(sent[0].gasLimit, 25200n);
  });

  it("refuses to sign and never calls the signer when the RPC reports the wrong chain", async () => {
    const { provider, signer, calls } = mock({ chainId: 1n });
    await assert.rejects(
      () => guardedSend({ provider, signer, to, data }),
      /expected chain id 84532, got 1/,
    );
    assert.equal(calls.send, 0);
    assert.equal(calls.estimate, 0);
  });

  it("refuses to sign and never calls the signer when the balance cannot cover gas", async () => {
    const { provider, signer, calls } = mock({
      gasLimit: 100_000n,
      fee: 10n,
      balance: 1n, // far below 100000 * 10 * 1.2
    });
    await assert.rejects(
      () => guardedSend({ provider, signer, to, data }),
      /No transaction sent/,
    );
    assert.equal(calls.send, 0);
    assert.ok(calls.estimate >= 1);
  });
});

describe("redactSecrets", () => {
  it("redacts 32-byte hex so a key cannot appear in an error string", () => {
    const keyish = "0x" + "ab".repeat(32);
    assert.equal(redactSecrets(`boom ${keyish} done`), "boom 0x[redacted-32-byte] done");
  });
});

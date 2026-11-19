import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Interface, keccak256, toUtf8Bytes } from "ethers";
import { WAD } from "../src/constants.js";
import { DEMO_UNIVERSE } from "../src/constants.js";
import {
  APPROVE_GAS_RESERVE,
  encodeGuidedWrites,
  formatEth,
  neededWeiForGas,
  positionsFromHoldingsUsd,
  preflightWriteBudget,
  prepareDemoMandate,
  runDemoLive,
  summariseProposal,
} from "../src/demoLive.js";
import { proposeRebalance } from "../src/engine/propose.js";

const ABI = [
  "function setMandate(bytes32 mandateHash)",
  "function propose(address owner, bytes32 mandateHash, bytes32 researchHash, bytes32 proposalHash)",
  "function approve(bytes32 proposalId)",
  "event MandateSet(address indexed owner, bytes32 mandateHash, uint64 updatedAt)",
  "event Proposed(bytes32 indexed proposalId, address indexed owner, bytes32 mandateHash, bytes32 researchHash, bytes32 proposalHash)",
  "event Approved(bytes32 indexed proposalId, address indexed owner, uint64 at)",
];

const OWNER = "0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F";
const CONTRACT = "0xA2cFFa3bdb2CD12dda441f1DA7139E050b733188";
const NAV = 100n * 10n ** 8n;
const DEC = 8;

function asset() {
  return {
    decimals: DEC,
    uiMultiplierWad: WAD,
    navE8: NAV,
    stale: false,
    heldOffHours: false,
    pendingCorporateAction: false,
    pending: null,
    reason: null,
  };
}

function rebalanceSnapshot() {
  const assets = {};
  for (const symbol of DEMO_UNIVERSE) assets[symbol] = asset();
  return { at: 1_794_800_000, assets };
}

function iface() {
  return new Interface(ABI);
}

function logContract() {
  return { interface: iface(), target: CONTRACT };
}

function receipt({ hash, blockNumber, name, args }) {
  const encoded = iface().encodeEventLog(iface().getEvent(name), args);
  return {
    hash,
    transactionHash: hash,
    blockNumber,
    logs: [{ topics: encoded.topics, data: encoded.data }],
  };
}

function mockProvider({ chainId = 84532n, balance = 10n ** 15n, fee = 6_000_000n, gasLimit = 80_000n } = {}) {
  const calls = { estimate: 0, send: 0, network: 0, balance: 0 };
  return {
    calls,
    getNetwork: async () => {
      calls.network += 1;
      return { chainId };
    },
    getBalance: async () => {
      calls.balance += 1;
      return balance;
    },
    getFeeData: async () => ({ maxFeePerGas: fee, gasPrice: fee }),
    estimateGas: async () => {
      calls.estimate += 1;
      return gasLimit;
    },
  };
}

describe("formatEth and neededWeiForGas", () => {
  it("formats wei to a short ETH string", () => {
    assert.equal(formatEth(0n), "0.0");
    assert.equal(formatEth(93601149997906n), "0.0000936011");
  });

  it("applies headroom to gas * fee", () => {
    const needed = neededWeiForGas({ gasLimit: 100_000n, maxFeePerGas: 6_000_000n, headroomBps: 2000 });
    assert.equal(needed, (100_000n * 6_000_000n * 12000n) / 10000n);
  });

  it("refuses a missing fee rather than sending", () => {
    assert.throws(
      () => neededWeiForGas({ gasLimit: 1n, maxFeePerGas: 0n }),
      /No transaction sent/,
    );
  });
});

describe("prepareDemoMandate", () => {
  it("turns the $90k AAPLc demo book into raw positions at NAV", () => {
    const mandate = prepareDemoMandate(rebalanceSnapshot());
    assert.equal(mandate.universe.length, 7);
    assert.equal(mandate.neverAutoSpend, true);
    assert.equal(mandate.cashE8, 10_000n * 10n ** 8n);
    const apple = mandate.positions.find((p) => p.symbol === "AAPLc");
    assert.ok(apple);
    // $90,000 at $100/token, 8 decimals → 900 whole tokens
    assert.equal(apple.raw, 900n * 10n ** 8n);
  });

  it("keeps already-raw positions", () => {
    const snap = rebalanceSnapshot();
    const prepared = positionsFromHoldingsUsd(
      { positions: [{ symbol: "AAPLc", raw: 5n }], holdingsUsd: { AAPLc: 1 } },
      snap,
    );
    assert.equal(prepared[0].raw, 5n);
  });
});

describe("summariseProposal", () => {
  it("lists buy and sell legs with USD notionals", () => {
    const snap = rebalanceSnapshot();
    const mandate = prepareDemoMandate(snap);
    const proposal = proposeRebalance(mandate, snap);
    assert.equal(proposal.action, "rebalance");
    const summary = summariseProposal(proposal);
    assert.ok(summary.sellNames.includes("AAPLc"));
    assert.equal(summary.buyNames.includes("AAPLc"), false);
    assert.ok(summary.buyNames.length >= 1);
    assert.ok(summary.tradeLines.some((l) => /sell AAPLc \$/.test(l)));
  });
});

describe("encodeGuidedWrites", () => {
  it("encodes setMandate and propose, and approve only when a proposalId is given", () => {
    const hash = keccak256(toUtf8Bytes("demo"));
    const partial = encodeGuidedWrites(logContract(), {
      owner: OWNER,
      mandateHash: hash,
      researchHash: hash,
      proposalHash: hash,
      to: CONTRACT,
    });
    assert.equal(partial.map((w) => w.name).join(","), "setMandate,propose");
    const full = encodeGuidedWrites(logContract(), {
      owner: OWNER,
      mandateHash: hash,
      researchHash: hash,
      proposalHash: hash,
      proposalId: hash,
      to: CONTRACT,
    });
    assert.equal(full[2].name, "approve");
    assert.ok(full[2].data.startsWith("0x"));
  });
});

describe("preflightWriteBudget", () => {
  it("refuses a non-84532 chain id and does not treat it as affordable", async () => {
    const provider = mockProvider({ chainId: 1n });
    await assert.rejects(
      () => preflightWriteBudget({
        provider,
        from: OWNER,
        calls: [{ name: "setMandate", to: CONTRACT, data: "0x1234" }],
        expectedChainId: 84532,
      }),
      /expected chain id 84532/,
    );
  });

  it("stops when the balance cannot cover the three writes", async () => {
    const provider = mockProvider({ balance: 1n, gasLimit: 80_000n, fee: 6_000_000n });
    await assert.rejects(
      () => preflightWriteBudget({
        provider,
        from: OWNER,
        calls: [
          { name: "setMandate", to: CONTRACT, data: "0x11" },
          { name: "propose", to: CONTRACT, data: "0x22" },
        ],
        expectedChainId: 84532,
      }),
      /No transaction sent/,
    );
  });

  it("reserves approve gas when approve has not been encoded yet", async () => {
    const provider = mockProvider({ balance: 10n ** 18n, gasLimit: 50_000n, fee: 6_000_000n });
    const budget = await preflightWriteBudget({
      provider,
      from: OWNER,
      calls: [
        { name: "setMandate", to: CONTRACT, data: "0x11" },
        { name: "propose", to: CONTRACT, data: "0x22" },
      ],
      expectedChainId: 84532,
    });
    assert.equal(budget.ok, true);
    assert.equal(budget.estimates[2].name, "approve");
    assert.equal(budget.estimates[2].reserved, true);
    assert.equal(budget.estimates[2].gasLimit, APPROVE_GAS_RESERVE);
    const expected =
      neededWeiForGas({ gasLimit: 50_000n, maxFeePerGas: 6_000_000n }) * 2n
      + neededWeiForGas({ gasLimit: APPROVE_GAS_RESERVE, maxFeePerGas: 6_000_000n });
    assert.equal(budget.neededWei, expected);
  });
});

describe("runDemoLive", () => {
  const snap = rebalanceSnapshot();

  it("dry-runs a rebalance without calling sendTx", async () => {
    const sent = [];
    const provider = mockProvider({ balance: 10n ** 16n });
    const result = await runDemoLive({
      provider,
      logContract: logContract(),
      ownerAddress: OWNER,
      contractAddress: CONTRACT,
      snapshot: snap,
      dryRun: true,
      sendTx: async (call) => {
        sent.push(call);
        throw new Error("should not send");
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(sent.length, 0);
    assert.equal(result.proposal.action, "rebalance");
    assert.match(result.logLines.join("\n"), /DRY RUN/);
    assert.match(result.logLines.join("\n"), /Balance\s+0\.01 ETH/);
  });

  it("sends setMandate, propose and approve in order and returns Blockscout links", async () => {
    const sent = [];
    const provider = mockProvider({ balance: 10n ** 16n, gasLimit: 60_000n });
    const proposalId = keccak256(toUtf8Bytes("proposal-id"));
    const hashes = {
      setMandate: keccak256(toUtf8Bytes("tx-mandate")),
      propose: keccak256(toUtf8Bytes("tx-propose")),
      approve: keccak256(toUtf8Bytes("tx-approve")),
    };
    let balance = 10n ** 16n;
    provider.getBalance = async () => balance;
    const result = await runDemoLive({
      provider,
      logContract: logContract(),
      ownerAddress: OWNER,
      contractAddress: CONTRACT,
      snapshot: snap,
      sendTx: async (call) => {
        sent.push(call.name);
        if (call.name === "setMandate") {
          return receipt({
            hash: hashes.setMandate,
            blockNumber: 10,
            name: "MandateSet",
            args: [OWNER, keccak256(toUtf8Bytes("m")), 1n],
          });
        }
        if (call.name === "propose") {
          return receipt({
            hash: hashes.propose,
            blockNumber: 11,
            name: "Proposed",
            args: [proposalId, OWNER, keccak256(toUtf8Bytes("m")), keccak256(toUtf8Bytes("r")), keccak256(toUtf8Bytes("p"))],
          });
        }
        if (call.name === "approve") {
          balance -= 1n;
          return receipt({
            hash: hashes.approve,
            blockNumber: 12,
            name: "Approved",
            args: [proposalId, OWNER, 2n],
          });
        }
        throw new Error(`unexpected ${call.name}`);
      },
    });
    assert.equal(result.ok, true, result.error);
    assert.deepEqual(sent, ["setMandate", "propose", "approve"]);
    assert.equal(result.txs.setMandate, hashes.setMandate);
    assert.equal(result.txs.propose, hashes.propose);
    assert.equal(result.txs.approve, hashes.approve);
    assert.equal(result.txs.proposalId, proposalId);
    assert.equal(
      result.evidence.steps[0].url,
      `https://base-sepolia.blockscout.com/tx/${hashes.setMandate}`,
    );
    assert.match(result.logLines.join("\n"), /Paper book updated/);
    assert.match(result.logLines.join("\n"), /No funds moved/);
  });

  it("does not send when the opening balance is zero", async () => {
    const sent = [];
    const result = await runDemoLive({
      provider: mockProvider({ balance: 0n }),
      logContract: logContract(),
      ownerAddress: OWNER,
      contractAddress: CONTRACT,
      snapshot: snap,
      sendTx: async (call) => {
        sent.push(call);
        return {};
      },
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /balance is 0/);
    assert.equal(sent.length, 0);
  });

  it("does not send when the proposal is a hold", async () => {
    const sent = [];
    const result = await runDemoLive({
      provider: mockProvider({ balance: 10n ** 16n }),
      logContract: logContract(),
      ownerAddress: OWNER,
      contractAddress: CONTRACT,
      snapshot: snap,
      proposeRebalance: () => ({ action: "hold", code: "below_threshold", trades: [], flags: [] }),
      sendTx: async (call) => {
        sent.push(call);
        return {};
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.skipped, true);
    assert.equal(sent.length, 0);
    assert.match(result.logLines.join("\n"), /No transaction sent/);
  });

  it("does not send when preflight says the balance is too low", async () => {
    const sent = [];
    // Enough to pass the zero-balance gate, far too little for 80k*2 + 100k reserve at 6 gwei-millionths.
    const provider = mockProvider({ balance: 1_000n, gasLimit: 80_000n, fee: 6_000_000n });
    const result = await runDemoLive({
      provider,
      logContract: logContract(),
      ownerAddress: OWNER,
      contractAddress: CONTRACT,
      snapshot: snap,
      sendTx: async (call) => {
        sent.push(call);
        return {};
      },
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /No transaction sent/);
    assert.equal(sent.length, 0);
  });

  it("redacts 32-byte hex from thrown errors", async () => {
    const secret = "0x" + "ab".repeat(32);
    const result = await runDemoLive({
      provider: {
        getNetwork: async () => {
          throw new Error(`boom ${secret}`);
        },
        getBalance: async () => 1n,
      },
      logContract: logContract(),
      ownerAddress: OWNER,
      contractAddress: CONTRACT,
      snapshot: snap,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.includes(secret), false);
    assert.match(result.error, /0x\[redacted-32-byte\]/);
  });
});

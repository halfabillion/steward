import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalJson, hashMandate } from "../src/engine/hash.js";

describe("hashMandate", () => {
  it("is stable under key order and bigint encoding", () => {
    const a = hashMandate({
      universe: ["AAPLc", "NVDAc"],
      maxWeightBps: 3000,
      cashSleeveBps: 1000,
      rebalanceThresholdBps: 200,
      neverAutoSpend: true,
    });
    const b = hashMandate({
      rebalanceThresholdBps: 200,
      neverAutoSpend: true,
      cashSleeveBps: 1000,
      maxWeightBps: 3000,
      universe: ["AAPLc", "NVDAc"],
    });
    assert.equal(a, b);
    assert.match(a, /^0x[0-9a-f]{64}$/);
  });

  it("canonicalJson sorts keys", () => {
    assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
    assert.equal(canonicalJson({ n: 10n }), '{"n":"10"}');
  });
});

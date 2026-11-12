import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUILDER_CODE, BUILDER_CODE_STATUS, withBuilderCode } from "../src/builderCode.js";

describe("withBuilderCode", () => {
  it("is a stub: leaves calldata unchanged and reports not issued", () => {
    assert.equal(BUILDER_CODE, null);
    assert.equal(BUILDER_CODE_STATUS, "not_issued");
    const data = "0xabcdef";
    const out = withBuilderCode(data);
    assert.equal(out.data, data);
    assert.equal(out.tagged, false);
    assert.match(out.reason, /No Builder Code/);
  });

  it("rejects non-hex calldata", () => {
    assert.throws(() => withBuilderCode("abcdef"), /0x-prefixed/);
  });
});

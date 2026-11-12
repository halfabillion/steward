/**
 * ERC-8021 Builder Code hook.
 *
 * Official Base docs: a builder code is a suffix appended to transaction
 * calldata so indexers can attribute onchain activity to an app or agent.
 * Steward does not yet have an issued code. This module is the single place
 * that will append it once one exists. Until then, calldata is unchanged
 * and every send is marked untagged.
 *
 * Never invent a code. Never tag with a placeholder that could be mistaken
 * for a real attribution suffix.
 */
export const BUILDER_CODE = null;
export const BUILDER_CODE_STATUS = "not_issued";

/**
 * @param {string} data  0x-prefixed calldata
 * @returns {{ data: string, tagged: boolean, reason: string }}
 */
export function withBuilderCode(data) {
  if (typeof data !== "string" || !data.startsWith("0x")) {
    throw new Error("withBuilderCode expects 0x-prefixed calldata");
  }
  if (!BUILDER_CODE) {
    return {
      data,
      tagged: false,
      reason: "No Builder Code has been issued yet. Calldata is untagged; the suffix will be appended here when a code exists.",
    };
  }
  const suffix = BUILDER_CODE.startsWith("0x") ? BUILDER_CODE.slice(2) : BUILDER_CODE;
  return {
    data: data + suffix,
    tagged: true,
    reason: "Builder Code suffix appended (ERC-8021).",
  };
}

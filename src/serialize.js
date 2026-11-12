/** Recursively turn BigInt values into decimal strings for JSON. */
export function toJsonable(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonable);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJsonable(v);
    return out;
  }
  return value;
}

export function asBigInt(value, fallback = 0n) {
  if (typeof value === "bigint") return value;
  if (value === undefined || value === null || value === "") return fallback;
  return BigInt(value);
}

/**
 * Minimal JSON-RPC helper for read-only eth_call. No wallets, no signing, no keys.
 */
async function rpcOnce(url, method, params, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "steward/0.2" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`RPC HTTP ${res.status} for ${method}`);
    }
    const body = await res.json();
    if (body.error) {
      throw new Error(`RPC ${method}: ${JSON.stringify(body.error)}`);
    }
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

/** Read-only JSON-RPC. Bounded retries on 429/503 only — never an unbounded loop. */
export async function rpc(url, method, params = [], { timeoutMs = 20_000, retries = 3 } = {}) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      return await rpcOnce(url, method, params, timeoutMs);
    } catch (err) {
      last = err;
      const msg = String(err.message || err);
      if (!/HTTP 429|HTTP 503/.test(msg) || i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw last;
}

export async function ethCall(url, to, data) {
  return rpc(url, "eth_call", [{ to, data }, "latest"]);
}

export async function ethChainId(url) {
  return Number(BigInt(await rpc(url, "eth_chainId", [])));
}

export async function ethBlockNumber(url) {
  return Number(BigInt(await rpc(url, "eth_blockNumber", [])));
}

/** Decode a 32-byte word of ABI-encoded output as an unsigned bigint. */
export function wordUint(hex, index = 0) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const chunk = h.slice(index * 64, (index + 1) * 64);
  if (!chunk) return 0n;
  return BigInt("0x" + chunk);
}

export function wordInt(hex, index = 0) {
  const v = wordUint(hex, index);
  const bits = 256n;
  const sign = 1n << (bits - 1n);
  return v >= sign ? v - (1n << bits) : v;
}

/** ABI-decode a string return (name/symbol). */
export function decodeAbiString(hex) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length < 128) return "";
  const offset = Number(BigInt("0x" + h.slice(0, 64)));
  const start = offset * 2;
  const len = Number(BigInt("0x" + h.slice(start, start + 64)));
  const data = h.slice(start + 64, start + 64 + len * 2);
  return Buffer.from(data, "hex").toString("utf8");
}

// One JSON-RPC call with a timeout and typed errors.
import { RpcError, RpcTimeoutError } from "./errors.js";

export const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";

/**
 * @param {string} rpcUrl
 * @param {string} method
 * @param {unknown[]} params
 * @param {{ fetch?: typeof fetch, timeoutMs?: number }} [net]
 */
export async function rpc(rpcUrl, method, params, { fetch: fetchFn = globalThis.fetch, timeoutMs = 15_000 } = {}) {
  let res;
  try {
    res = await fetchFn(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") throw new RpcTimeoutError(`${method}: the RPC did not answer within ${timeoutMs} ms`, { cause: e });
    throw new RpcError(`${method}: the RPC could not be reached (${e?.message || e})`, { cause: e });
  }
  if (res.status === 429) throw new RpcError(`${method}: the RPC is rate limiting this client (HTTP 429); wait, or set SOLANA_RPC_URL to your own endpoint`, { code: 429, status: 429 });
  if (!res.ok) throw new RpcError(`${method}: the RPC answered HTTP ${res.status}`, { code: res.status, status: res.status });
  let j;
  try { j = await res.json(); } catch (e) { throw new RpcError(`${method}: the RPC answer is not JSON`, { status: res.status, cause: e }); }
  if (j?.error) throw new RpcError(`${method}: ${j.error.message || "RPC error"} (code ${j.error.code})`, { code: j.error.code ?? null, status: res.status });
  if (!j || !("result" in j)) throw new RpcError(`${method}: the RPC answer has no result`, { status: res.status });
  return j.result;
}

// One JSON-RPC call with a timeout and typed errors.
import { RpcError, RpcTimeoutError } from "./errors.js";

export const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";

/**
 * A timeout signal on a ref'd timer. AbortSignal.timeout() uses an unref'd timer, so when nothing else holds the
 * event loop open (a custom fetch, a stalled stream) Node exits before it fires and the call never settles.
 * Call clear() once the call is done so a finished request does not hold the process open.
 * @param {number} ms
 */
export function timeoutSignal(ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new DOMException(`The operation was aborted due to timeout`, "TimeoutError")), ms);
  return { signal: ac.signal, clear: () => clearTimeout(t) };
}

/**
 * @param {string} rpcUrl
 * @param {string} method
 * @param {unknown[]} params
 * @param {{ fetch?: typeof fetch, timeoutMs?: number }} [net]
 */
export async function rpc(rpcUrl, method, params, { fetch: fetchFn = globalThis.fetch, timeoutMs = 15_000 } = {}) {
  const timer = timeoutSignal(timeoutMs);
  try { return await rpcOnce(rpcUrl, method, params, fetchFn, timeoutMs, timer.signal); } finally { timer.clear(); }
}

async function rpcOnce(rpcUrl, method, params, fetchFn, timeoutMs, signal) {
  let res;
  try {
    res = await fetchFn(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal });
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

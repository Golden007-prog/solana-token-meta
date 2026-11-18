// Opt-in: fetch the off-chain JSON a token's `uri` points to, with a timeout, a size cap and a few SSRF guards.
// Never throws: the result says { ok: false, error } instead, because a dead link is normal for tokens.
import { timeoutSignal } from "./rpc.js";

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|\[?::1?\]?)$/i;
function isPrivateIp(host) {
  const h = host.replace(/^\[|\]$/g, "");
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
      || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;   // IETF, benchmarking, multicast/reserved/broadcast
  }
  return h.includes(":") && (/^(fc|fd|fe80)/i.test(h) || h === "::" || /^::ffff:/i.test(h));
}

export const DEFAULT_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";
// Public gateways that no longer serve plain HTTP clients (ipfs.io and dweb.link answer 429 with a "service worker
// gateway only" notice since 2026). URIs pointing at them are sent to `ipfsGateway` instead.
const RETIRED_IPFS_HOSTS = new Set(["ipfs.io", "gateway.ipfs.io", "dweb.link", "cloudflare-ipfs.com", "cf-ipfs.com"]);

/**
 * Turn a token URI into an https URL: ipfs:// and ar:// go through public gateways, and links to retired IPFS
 * gateways are moved to `ipfsGateway`. Returns null for anything that is not http(s) after that, or that names a
 * local or private-network host.
 */
export function resolveUri(uri, { ipfsGateway = DEFAULT_IPFS_GATEWAY, arweaveGateway = "https://arweave.net/" } = {}) {
  if (typeof uri !== "string") return null;
  let u = uri.trim();
  if (!u) return null;
  if (/^ipfs:\/\//i.test(u)) u = ipfsGateway + u.replace(/^ipfs:\/\/(ipfs\/)?/i, "");
  else if (/^ar:\/\//i.test(u)) u = arweaveGateway + u.replace(/^ar:\/\//i, "");
  let url;
  try { url = new URL(u); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  // A trailing dot names the same host ("localhost." is localhost), and a single-label name resolves on the local network.
  const host = url.hostname.replace(/\.+$/, "");
  if (!host || PRIVATE_HOST.test(host) || isPrivateIp(host) || (!host.includes(".") && !host.includes(":"))) return null;
  if (RETIRED_IPFS_HOSTS.has(url.hostname.toLowerCase()) && url.pathname.startsWith("/ipfs/")) {
    try { url = new URL(ipfsGateway + url.pathname.slice("/ipfs/".length) + url.search); } catch { return null; }
  }
  return url.toString();
}

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Pick the commonly used fields out of a token JSON (Metaplex standard, pump.fun, and the `extensions` convention). */
export function pickOffchainFields(json) {
  const j = json && typeof json === "object" ? json : {};
  const ext = j.extensions && typeof j.extensions === "object" ? j.extensions : {};
  return {
    name: str(j.name),
    symbol: str(j.symbol),
    description: str(j.description),
    image: str(j.image),
    website: str(j.website) ?? str(ext.website) ?? str(j.external_url),
    twitter: str(j.twitter) ?? str(ext.twitter),
    telegram: str(j.telegram) ?? str(ext.telegram),
    discord: str(j.discord) ?? str(ext.discord),
  };
}

async function readCapped(res, maxBytes) {
  const declared = Number(res.headers.get("content-length"));
  if (declared > maxBytes) throw new Error(`body is ${declared} bytes, over the ${maxBytes} byte cap`);
  if (!res.body) return Buffer.from(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { await reader.cancel().catch(() => {}); throw new Error(`body is over the ${maxBytes} byte cap`); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Fetch and parse a token's off-chain JSON.
 * @param {string} uri the on-chain uri (https, http, ipfs:// or ar://)
 * @param {{ fetch?: typeof fetch, timeoutMs?: number, maxBytes?: number, ipfsGateway?: string, arweaveGateway?: string }} [opts]
 * @returns {Promise<{ ok: true, url: string, name: string|null, symbol: string|null, description: string|null, image: string|null, website: string|null, twitter: string|null, telegram: string|null, discord: string|null, json: unknown } | { ok: false, url: string|null, error: string }>}
 */
export async function fetchOffchainJson(uri, { fetch: fetchFn = globalThis.fetch, timeoutMs = 5_000, maxBytes = 256 * 1024, ...gw } = {}) {
  let url = resolveUri(uri, gw);
  if (!url) return { ok: false, url: null, error: uri ? "uri is not a public http(s), ipfs:// or ar:// address" : "no uri" };
  const timer = timeoutSignal(timeoutMs);
  const signal = timer.signal;
  try {
    let res;
    for (let hop = 0; ; hop++) {
      res = await fetchFn(url, { headers: { accept: "application/json" }, redirect: "manual", signal });
      if (res.status < 300 || res.status >= 400) break;
      const next = res.headers.get("location");
      if (!next || hop >= 3) return { ok: false, url, error: `too many redirects or no location (HTTP ${res.status})` };
      const resolved = resolveUri(new URL(next, url).toString(), gw);
      if (!resolved) return { ok: false, url, error: "redirected to a non-public address" };
      url = resolved;
    }
    if (!res.ok) return { ok: false, url, error: `HTTP ${res.status}` };
    const body = await readCapped(res, maxBytes);
    let json;
    try { json = JSON.parse(body.toString("utf8")); } catch { return { ok: false, url, error: "not JSON" }; }
    return { ok: true, url, ...pickOffchainFields(json), json };
  } catch (e) {
    return { ok: false, url, error: e?.name === "TimeoutError" || e?.name === "AbortError" ? `no answer within ${timeoutMs} ms` : String(e?.message || e) };
  } finally {
    timer.clear();
  }
}

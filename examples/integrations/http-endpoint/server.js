// A tiny token-info API over solana-token-meta, with nothing but node:http.
//
//   node examples/integrations/http-endpoint/server.js
//   curl http://localhost:8788/token/<mint>                 -> metadata, authorities, extensions and risk flags
//   curl "http://localhost:8788/tokens?mints=<mint>,<mint>"  -> up to 50 mints, one RPC call
//
// PORT (default 8788) and SOLANA_RPC_URL (default: the public mainnet RPC) are read from the environment.
// Authorities and metadata can change, so answers are cached for 60 seconds only.
import http from "node:http";
import { getTokenMetas, riskFlags, InvalidInputError, RpcTimeoutError, RpcError } from "solana-token-meta";

const PORT = Number(process.env.PORT) || 8788;
const TTL_MS = 60_000;
const MAX_MINTS = 50;
const cache = new Map(); // mint -> { at, value }

async function lookup(mints) {
  const now = Date.now();
  const missing = [...new Set(mints)].filter((m) => !(cache.get(m)?.at > now - TTL_MS));
  if (missing.length) {
    const metas = await getTokenMetas(missing); // reads SOLANA_RPC_URL, else the public RPC
    for (const m of metas) cache.set(m.mint, { at: now, value: m.exists ? { ...m, riskFlags: riskFlags(m) } : m });
    if (cache.size > 5_000) for (const [k, v] of cache) if (v.at <= now - TTL_MS) cache.delete(k);
  }
  return mints.map((m) => cache.get(m).value);
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body, null, 2));
}

function statusFor(e) {
  if (e instanceof InvalidInputError) return 400;
  if (e instanceof RpcTimeoutError) return 504;
  if (e instanceof RpcError) return e.status === 429 ? 503 : 502;
  return 500;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    const one = /^\/token\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && one) {
      const [meta] = await lookup([decodeURIComponent(one[1])]);
      return send(res, meta.exists ? 200 : 404, meta);
    }
    if (req.method === "GET" && url.pathname === "/tokens") {
      const mints = (url.searchParams.get("mints") || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (!mints.length || mints.length > MAX_MINTS) return send(res, 400, { error: `pass 1 to ${MAX_MINTS} comma-separated mints in ?mints=` });
      return send(res, 200, await lookup(mints));
    }
    send(res, 404, { error: "use GET /token/<mint> or GET /tokens?mints=<mint>,<mint>" });
  } catch (e) {
    send(res, statusFor(e), { error: e.name, message: e.message });
  }
});

server.listen(PORT, () => console.log(`solana-token-meta endpoint on http://localhost:${PORT}/token/<mint>`));

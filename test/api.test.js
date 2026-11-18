import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getTokenMeta, getTokenMetas, riskFlags, resolveUri, fetchOffchainJson, InvalidInputError, RpcError, RpcTimeoutError, PUBLIC_RPC } from "../src/index.js";
import { fakeFetch, MINTS } from "./helpers.js";

test("getTokenMeta is one getMultipleAccounts call: [mint, Metaplex PDA], base64", async () => {
  const calls = [];
  const m = await getTokenMeta(MINTS.usdc, { fetch: fakeFetch({ calls }), rpcUrl: "http://rpc.test" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "getMultipleAccounts");
  assert.deepEqual(calls[0].params[0], [MINTS.usdc, "5x38Kp4hvdomTCnCrAny4UtMUt5rQBdB6px2K1Ui45Wq"]);
  assert.equal(calls[0].params[1].encoding, "base64");
  assert.equal(m.metadata.name, "USD Coin");
  assert.equal(typeof m.slot, "number");
  assert.equal(m.offchain, undefined, "off-chain JSON is off by default");
});

test("getTokenMetas keeps order and reads all five fixture mints in one call", async () => {
  const calls = [];
  const names = ["pump2022", "usdc", "pyusd", "bonk", "pump"];
  const metas = await getTokenMetas(names.map((n) => MINTS[n]), { fetch: fakeFetch({ calls }) });
  assert.equal(calls.length, 1);
  assert.deepEqual(metas.map((m) => m.metadata.symbol), ["DEED", "USDC", "PYUSD", "Bonk", "GOAT"]);
  assert.deepEqual(metas.map((m) => m.program), ["token-2022", "spl-token", "token-2022", "spl-token", "spl-token"]);
});

test("getTokenMetas chunks at 100 addresses per call; metaplex:false skips the PDA", async () => {
  const many = Array.from({ length: 120 }, (_, i) => Object.values(MINTS)[i % 5]);
  const calls = [];
  const metas = await getTokenMetas(many, { fetch: fakeFetch({ calls }) });
  assert.deepEqual(calls.map((c) => c.params[0].length), [100, 100, 40]);
  assert.equal(metas.length, 120);
  assert.equal(metas[119].metadata.symbol, "DEED");
  const calls2 = [];
  const lean = await getTokenMetas(many, { fetch: fakeFetch({ calls: calls2 }), metaplex: false });
  assert.deepEqual(calls2.map((c) => c.params[0].length), [100, 20]);
  assert.equal(lean.find((m) => m.mint === MINTS.usdc).metadata, null);
  assert.equal(lean.find((m) => m.mint === MINTS.pyusd).metadata.symbol, "PYUSD", "Token-2022 metadata needs no second account");
});

test("an address with no account comes back exists:false, not an error", async () => {
  const [m] = await getTokenMetas(["So11111111111111111111111111111111111111112".replace("2", "3")], { fetch: fakeFetch() });
  assert.equal(m.exists, false);
  assert.equal(m.reason, "no account at this address");
  assert.deepEqual(riskFlags(m).mintAuthorityActive, false);
});

test("bad input throws InvalidInputError before any network call", async () => {
  const calls = [];
  await assert.rejects(getTokenMeta("hello", { fetch: fakeFetch({ calls }) }), InvalidInputError);
  await assert.rejects(getTokenMetas([MINTS.usdc, "0x123"], { fetch: fakeFetch({ calls }) }), InvalidInputError);
  await assert.rejects(getTokenMetas("not-an-array"), InvalidInputError);
  assert.equal(calls.length, 0);
  assert.deepEqual(await getTokenMetas([]), []);
});

test("RPC failures: JSON-RPC error carries its code, 429 and HTTP errors carry the status, timeouts are RpcTimeoutError", async () => {
  const rpcErr = fakeFetch({ rpcOverride: () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Invalid param" } })) });
  await assert.rejects(getTokenMeta(MINTS.usdc, { fetch: rpcErr }), (e) => e instanceof RpcError && e.code === -32602 && /Invalid param/.test(e.message));
  const limited = fakeFetch({ rpcOverride: () => new Response("slow down", { status: 429 }) });
  await assert.rejects(getTokenMeta(MINTS.usdc, { fetch: limited }), (e) => e instanceof RpcError && e.status === 429);
  const down = fakeFetch({ rpcOverride: () => new Response("bad gateway", { status: 502 }) });
  await assert.rejects(getTokenMeta(MINTS.usdc, { fetch: down }), (e) => e instanceof RpcError && e.status === 502);
  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)));
  await assert.rejects(getTokenMeta(MINTS.usdc, { fetch: hang, timeoutMs: 50 }), RpcTimeoutError);
  const wrongShape = fakeFetch({ rpcOverride: () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { value: [] } })) });
  await assert.rejects(getTokenMeta(MINTS.usdc, { fetch: wrongShape }), RpcError);
});

test("resolveUri: gateways for ipfs:// and ar://, retired ipfs.io links moved, private hosts refused", () => {
  assert.equal(resolveUri("ipfs://QmX/meta.json"), "https://gateway.pinata.cloud/ipfs/QmX/meta.json");
  assert.equal(resolveUri("ipfs://ipfs/QmX"), "https://gateway.pinata.cloud/ipfs/QmX");
  assert.equal(resolveUri("ar://abc"), "https://arweave.net/abc");
  assert.equal(resolveUri("https://ipfs.io/ipfs/bafy123"), "https://gateway.pinata.cloud/ipfs/bafy123");
  assert.equal(resolveUri("https://ipfs.io/ipfs/bafy123", { ipfsGateway: "https://my.gw/ipfs/" }), "https://my.gw/ipfs/bafy123");
  assert.equal(resolveUri("https://arweave.net/x"), "https://arweave.net/x");
  for (const bad of ["", "file:///etc/passwd", "http://localhost:3000/x", "http://127.0.0.1/x", "http://10.0.0.5/x", "http://192.168.1.1/x", "http://169.254.169.254/latest", "http://[::1]/x", "https://user:pw@host/x", "javascript:alert(1)", null]) {
    assert.equal(resolveUri(bad), null, String(bad));
  }
});

const JSON_URL = "https://example.test/meta.json";

test("fetchOffchainJson picks image, description and socials (pump.fun and `extensions` styles)", async () => {
  const pump = await fetchOffchainJson(JSON_URL, { fetch: fakeFetch({ http: { [JSON_URL]: { name: "Deed", symbol: "DEED", description: "d", image: "https://img", twitter: "https://x.com/a", website: "https://w" } } }) });
  assert.deepEqual([pump.ok, pump.image, pump.twitter, pump.website, pump.telegram], [true, "https://img", "https://x.com/a", "https://w", null]);
  const ext = await fetchOffchainJson(JSON_URL, { fetch: fakeFetch({ http: { [JSON_URL]: { image: "i", extensions: { discord: "https://discord.gg/x", telegram: "https://t.me/y" } } } }) });
  assert.deepEqual([ext.discord, ext.telegram], ["https://discord.gg/x", "https://t.me/y"]);
});

test("fetchOffchainJson never throws: size cap, non-JSON, 404, private redirect, timeout", async () => {
  const big = await fetchOffchainJson(JSON_URL, { maxBytes: 100, fetch: fakeFetch({ http: { [JSON_URL]: JSON.stringify({ description: "x".repeat(5000) }) } }) });
  assert.equal(big.ok, false); assert.match(big.error, /cap/);
  const html = await fetchOffchainJson(JSON_URL, { fetch: fakeFetch({ http: { [JSON_URL]: "<html>" } }) });
  assert.deepEqual([html.ok, html.error], [false, "not JSON"]);
  const missing = await fetchOffchainJson("https://example.test/none", { fetch: fakeFetch() });
  assert.deepEqual([missing.ok, missing.error], [false, "HTTP 404"]);
  const redirect = await fetchOffchainJson(JSON_URL, { fetch: fakeFetch({ http: { [JSON_URL]: () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }) } }) });
  assert.deepEqual([redirect.ok, redirect.error], [false, "redirected to a non-public address"]);
  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)));
  const slow = await fetchOffchainJson(JSON_URL, { fetch: hang, timeoutMs: 50 });
  assert.equal(slow.ok, false); assert.match(slow.error, /50 ms/);
  assert.equal((await fetchOffchainJson("")).ok, false);
});

test("fetchJson:true adds `offchain` to every result with metadata (one GET each)", async () => {
  const bonkJson = "https://arweave.net/QPC6FYdUn-3V8ytFNuoCS85S2tHAuiDblh6u3CIZLsw";
  const calls = [];
  const metas = await getTokenMetas([MINTS.bonk, MINTS.usdc], { fetchJson: true, fetch: fakeFetch({ calls, http: { [bonkJson]: { name: "Bonk", description: "The Official Bonk Inu token", image: "https://arweave.net/img" } } }) });
  assert.equal(metas[0].offchain.ok, true);
  assert.equal(metas[0].offchain.description, "The Official Bonk Inu token");
  assert.deepEqual([metas[1].offchain.ok, metas[1].offchain.error], [false, "no uri"], "USDC's Metaplex uri is empty");
  assert.equal(calls.filter((c) => c.url).length, 1);
});

test("CLI: --help exits 0, a bad address exits 1 with a clear message", () => {
  const cli = fileURLToPath(new URL("../bin/cli.js", import.meta.url));
  const help = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /solana-token-meta <mint\.\.\.>/);
  const bad = spawnSync(process.execPath, [cli, "nope"], { encoding: "utf8", env: { ...process.env, SOLANA_RPC_URL: "http://127.0.0.1:9" } });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /not a Solana address/);
});

test("CLI: invalid options report the problem before looking up a mint", () => {
  const cli = fileURLToPath(new URL("../bin/cli.js", import.meta.url));
  const env = { ...process.env, SOLANA_RPC_URL: "http://127.0.0.1:9" };
  for (const [options, message] of [
    [["--jsn"], /unknown option: --jsn/],
    [["--rpc"], /--rpc requires a URL/],
    [["--rpc", "--json"], /--rpc requires a URL/],
    [["--rpc", "not-a-url"], /--rpc must be an HTTP\(S\) URL/],
    [["--rpc", "ftp://example.test"], /--rpc must be an HTTP\(S\) URL/],
  ]) {
    const result = spawnSync(process.execPath, [cli, MINTS.usdc, ...options], { encoding: "utf8", env });
    assert.equal(result.status, 1, options.join(" "));
    assert.match(result.stderr, message, options.join(" "));
  }
});

test("CLI: valid options and duplicate help flags still show help", () => {
  const cli = fileURLToPath(new URL("../bin/cli.js", import.meta.url));
  const result = spawnSync(process.execPath,
    [cli, "-h", "--help", "--json", "--uri", "--rpc", "https://example.test/rpc"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /solana-token-meta <mint\.\.\.>/);
});

test("live: USDC and PYUSD on the public RPC (LIVE=1 only)", { skip: process.env.LIVE !== "1" }, async () => {
  const [usdc, pyusd] = await getTokenMetas([MINTS.usdc, MINTS.pyusd], { rpcUrl: process.env.SOLANA_RPC_URL || PUBLIC_RPC });
  assert.equal(usdc.metadata.symbol, "USDC");
  assert.equal(usdc.decimals, 6);
  assert.equal(pyusd.program, "token-2022");
  assert.ok(pyusd.extensionTypes.includes(19));
});

test("resolveUri: trailing-dot, single-label and reserved-range hosts are refused (#15)", () => {
  for (const u of ["http://localhost./x", "http://foo.internal./x", "http://box.local./x", "http://intranet/x", "http://224.0.0.1/x",
    "http://255.255.255.255/x", "http://198.18.0.1/x", "http://192.0.0.8/x", "http://2130706433/x", "http://[::ffff:127.0.0.1]/x"])
    assert.equal(resolveUri(u), null, u);
  assert.equal(resolveUri("https://example.com./meta.json"), "https://example.com./meta.json");
  assert.equal(resolveUri("https://arweave.net/abc"), "https://arweave.net/abc");
});

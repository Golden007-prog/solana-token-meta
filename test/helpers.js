// Shared test helpers: fixtures captured from mainnet, and a fake fetch that serves them.
import { readFileSync } from "node:fs";

export const MINTS = {
  usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  bonk: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  pyusd: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
  pump: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump",
  pump2022: "DxYWLXgKJpQmfhTG7ikK6oX6oDhxMhN5wCs5BJekpump",
};

export const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

/** Every account in the fixtures, by address. */
export function accountTable() {
  const table = new Map();
  for (const name of Object.keys(MINTS)) {
    const f = fixture(name);
    f.params[0].forEach((addr, i) => table.set(addr, { account: f.result.value[i], slot: f.result.context.slot }));
  }
  return table;
}

/**
 * A fetch that answers getMultipleAccounts from the fixtures (unknown addresses are null) and any other URL from `http`.
 * Records each call in `calls`.
 */
export function fakeFetch({ calls = [], http = {}, rpcOverride } = {}) {
  const table = accountTable();
  return async (url, init = {}) => {
    if (init.method === "POST") {
      const body = JSON.parse(init.body);
      calls.push({ method: body.method, params: body.params });
      if (rpcOverride) return rpcOverride(body, init);
      const addrs = body.params[0];
      const value = addrs.map((a) => table.get(a)?.account ?? null);
      const slot = addrs.map((a) => table.get(a)?.slot).find(Boolean) ?? 470_000_000;
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { context: { slot }, value } }), { status: 200 });
    }
    calls.push({ url });
    const h = http[url];
    if (!h) return new Response("not found", { status: 404 });
    return typeof h === "function" ? h(url, init) : new Response(typeof h === "string" ? h : JSON.stringify(h), { status: 200, headers: { "content-type": "application/json" } });
  };
}

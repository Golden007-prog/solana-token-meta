#!/usr/bin/env node
// Re-capture the offline test fixtures from mainnet: one getMultipleAccounts call per mint ([mint, metadata PDA]),
// sequential with a pause between calls. The raw JSON-RPC result is saved as-is to test/fixtures/<name>.json.
//
//   node scripts/capture-fixtures.js            # all fixtures
//   node scripts/capture-fixtures.js usdc bonk  # some
import { writeFileSync } from "node:fs";
import { metadataAddress } from "../src/metaplex.js";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
export const FIXTURES = {
  usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  bonk: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  pyusd: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
  pump: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump",          // GOAT: an early pump.fun coin, classic SPL + Metaplex
  pump2022: "DxYWLXgKJpQmfhTG7ikK6oX6oDhxMhN5wCs5BJekpump",      // a newer pump.fun coin: Token-2022 + TokenMetadata
};

const want = process.argv.slice(2);
for (const [name, mint] of Object.entries(FIXTURES)) {
  if (!mint || (want.length && !want.includes(name))) continue;
  const params = [[mint, metadataAddress(mint)], { encoding: "base64", commitment: "confirmed" }];
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params }), signal: AbortSignal.timeout(15_000) });
  const j = await res.json();
  if (j.error) throw new Error(`${name}: ${j.error.message}`);
  writeFileSync(new URL(`../test/fixtures/${name}.json`, import.meta.url), JSON.stringify({ mint, method: "getMultipleAccounts", params, capturedAt: new Date().toISOString(), result: j.result }, null, 2) + "\n");
  console.log(`${name}: slot ${j.result.context.slot}, mint ${j.result.value[0]?.data[0].length ?? 0} b64 chars, metadata ${j.result.value[1] ? "yes" : "no"}`);
  await new Promise((r) => setTimeout(r, 1500));
}

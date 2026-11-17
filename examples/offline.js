// No network: decode accounts you already have (from your own RPC call, a websocket, a cache).
// Here: the USDC accounts captured in test/fixtures.
//   node examples/offline.js
import { readFileSync } from "node:fs";
import { buildTokenMeta, metadataAddress, riskFlags } from "../src/index.js";

const f = JSON.parse(readFileSync(new URL("../test/fixtures/usdc.json", import.meta.url), "utf8"));
const [mintAccount, metadataAccount] = f.result.value;
console.log("metadata PDA:", metadataAddress(f.mint));
const m = buildTokenMeta(f.mint, mintAccount, metadataAccount, { slot: f.result.context.slot });
console.log(m.metadata.name, m.metadata.symbol, m.uiSupply);
console.log(riskFlags(m));

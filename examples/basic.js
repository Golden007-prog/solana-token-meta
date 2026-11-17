// One mint, one RPC call: program, decimals, supply, authorities, metadata.
//   node examples/basic.js [mint]
import { getTokenMeta } from "../src/index.js";

const mint = process.argv[2] || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
const m = await getTokenMeta(mint);

console.log(`${m.metadata?.name} (${m.metadata?.symbol}) on ${m.program}`);
console.log(`decimals ${m.decimals}, supply ${m.uiSupply}`);
console.log(`mint authority:   ${m.mintAuthority ?? "none (renounced)"}`);
console.log(`freeze authority: ${m.freezeAuthority ?? "none (renounced)"}`);
console.log(`metadata from ${m.metadata?.source}, ${m.metadata?.isMutable ? "mutable" : "immutable"}`);

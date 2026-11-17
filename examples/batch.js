// Many mints at once, with the risk flags each one carries. 50 mints per getMultipleAccounts call.
//   node examples/batch.js
import { getTokenMetas, riskFlags } from "../src/index.js";

const mints = [
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD (Token-2022)
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump", // GOAT (pump.fun, classic SPL)
];
for (const m of await getTokenMetas(mints)) {
  const on = Object.entries(riskFlags(m)).filter(([, v]) => v).map(([k]) => k);
  console.log(`${(m.metadata?.symbol ?? "?").padEnd(6)} ${m.program.padEnd(10)} ${on.join(", ") || "no flags"}`);
}

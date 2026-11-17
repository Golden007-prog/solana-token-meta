// Token-2022 extensions, decoded: PYUSD carries eight of them.
//   node examples/token-2022.js [mint]
import { getTokenMeta } from "../src/index.js";

const m = await getTokenMeta(process.argv[2] || "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo");
console.log("extension types:", m.extensionTypes.join(", "));
for (const [name, value] of Object.entries(m.extensions)) {
  if (name === "tokenMetadata") continue;
  console.log(`${name}:`, JSON.stringify(value));
}
console.log("current transfer fee:", m.transferFee);
console.log("unknown extension types:", m.unknownExtensions);

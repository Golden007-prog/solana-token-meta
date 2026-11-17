// Opt-in: also fetch the JSON the metadata uri points to (image, description, socials).
//   node examples/offchain.js [mint]
import { getTokenMeta } from "../src/index.js";

const m = await getTokenMeta(process.argv[2] || "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", { fetchJson: true }); // BONK
console.log(m.metadata.uri);
if (m.offchain.ok) console.log({ description: m.offchain.description, image: m.offchain.image, website: m.offchain.website, twitter: m.offchain.twitter });
else console.log("off-chain JSON unavailable:", m.offchain.error);

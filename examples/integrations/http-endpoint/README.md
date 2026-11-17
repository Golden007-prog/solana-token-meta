# HTTP endpoint: `GET /token/<mint>`

A token-info API in about 60 lines, using only `node:http`: metadata, authorities, Token-2022 extensions and risk flags for any Solana mint, ready for a frontend, a bot or a spreadsheet.

```bash
node examples/integrations/http-endpoint/server.js
```

```bash
curl http://localhost:8788/token/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
curl "http://localhost:8788/tokens?mints=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
```

| | |
|---|---|
| `GET /token/<mint>` | The `getTokenMeta` result plus `riskFlags`. 404 with `exists: false` and a `reason` when the address is not a mint |
| `GET /tokens?mints=a,b,c` | Up to 50 mints, answered from one `getMultipleAccounts` call, in the order asked |
| 400 | Not a Solana address, or no / too many mints |
| 502 / 503 / 504 | RPC error / RPC rate limit (429) / RPC timeout |

Configuration: `PORT` (default `8788`), `SOLANA_RPC_URL` (default: the free public mainnet RPC; it serves `getMultipleAccounts`, but rate limits under load).

Authorities and metadata can change, so results are cached for 60 seconds only. CORS is open (`access-control-allow-origin: *`); tighten it if you deploy this.

## In your own project

```bash
npm install github:blixvip/solana-token-meta
```

Copy `server.js`; the import `from "solana-token-meta"` works as is. Node 20 or newer.

How this was checked: see [VERIFY.md](../../../VERIFY.md#integrations).

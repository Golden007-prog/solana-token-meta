# solana-token-meta

**Solana token metadata and rug check: everything about a token mint, from one RPC call.** Which token program it uses (SPL Token or Token-2022), decimals, supply, mint and freeze authority, every Token-2022 extension, and the name, symbol and uri from either the Token-2022 metadata extension or Metaplex. Zero dependencies.

![dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen)
![node: 20+](https://img.shields.io/badge/node-20%2B-blue)
[![license: MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/grokbot)
[![GitHub stars](https://img.shields.io/github/stars/blixvip/solana-token-meta?style=social)](https://github.com/blixvip/solana-token-meta/stargazers)

<a href="https://blixvip.com"><img src="assets/blix-hero.jpg" width="100%" alt="BLIX: AI-powered Solana memecoin terminal. Trade memes first."></a>

**[Start trading at blixvip.com →](https://blixvip.com)** &nbsp;·&nbsp; [Public API](https://blixvip.com/api) &nbsp;·&nbsp; [MCP server](https://blixvip.com/mcp) &nbsp;·&nbsp; [Discord](https://discord.gg/grokbot)

Built by the team behind **[Blix](https://blixvip.com)**, the Solana memecoin terminal. Reading a coin's mint is the first thing any token page needs; this is that step on its own.

If solana-token-meta saves you time, **[give it a ⭐](https://github.com/blixvip/solana-token-meta)**. It helps other Solana developers find it.

## The problem

To answer "what is this token?" you usually end up with three libraries. `@solana/spl-token` decodes the mint, but its `getTokenMetadata` only reads the Token-2022 metadata extension. Classic SPL tokens (USDC, BONK, every pump.fun coin launched before pump.fun moved to Token-2022) keep their name in a separate Metaplex account, and reading that takes `@metaplex-foundation/umi` plus `@metaplex-foundation/mpl-token-metadata`. Both stacks pull in `@solana/web3.js` or Umi and their dependency trees, and neither one tells you, in one place, whether the mint authority is still live or whether the token has a transfer fee, a permanent delegate or a transfer hook.

This library reads the mint and its Metaplex metadata account together, in a single `getMultipleAccounts` call, and decodes both formats itself.

## Features

- **Program**: SPL Token or Token-2022, from the account owner.
- **Mint basics**: decimals, supply (exact, as a string, plus a decimal `uiSupply`), mint authority, freeze authority. `null` means renounced.
- **Token-2022 extensions** decoded: TransferFeeConfig (with the fee in force now), MetadataPointer, TokenMetadata (name, symbol, uri, additional metadata), PermanentDelegate, NonTransferable, DefaultAccountState, InterestBearingConfig, MintCloseAuthority, TransferHook, GroupPointer, GroupMemberPointer, TokenGroup, TokenGroupMember, ScaledUiAmount, Pausable. Other known types are named with their size; unknown types are listed by number.
- **Metaplex Token Metadata** for any mint: the metadata PDA is derived locally, and the account is decoded: name, symbol, uri (NUL padding stripped), seller fee, creators (verified, share), primary sale, mutability, update authority, edition nonce, token standard, collection, uses.
- **Risk flags** that only state facts: `mintAuthorityActive`, `freezeAuthorityActive`, `metadataMutable`, `hasTransferFee`, `hasPermanentDelegate`, `hasTransferHook`, plus `nonTransferable`, `defaultAccountsFrozen`, `paused`. No scores.
- **Batch**: `getTokenMetas(mints)` reads 50 mints per call (100 accounts: each mint plus its metadata PDA).
- **Off-chain JSON**, opt-in: image, description, website, X, Telegram, Discord from the uri, with a timeout, a size cap and private-address blocking.
- **Offline decoding**: `buildTokenMeta`, `decodeMint`, `decodeMetaplexMetadata` take raw account data you already have.
- base58, ed25519 on-curve check and program-derived addresses in plain JavaScript (`node:crypto` + `BigInt`).
- TypeScript declarations included.

## Install

```bash
npm install github:blixvip/solana-token-meta
```

Node 20 or newer. No dependencies.

## Quick start

CLI:

```bash
npx github:blixvip/solana-token-meta 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo
```

```
2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo
  PayPal USD (PYUSD)  metadata: token-2022, mutable
  program          token-2022
  decimals         6
  supply           686389555.350014
  mint authority   AxJkHRY3puoofyj7Pn512M1SGBgWroXMkEdNPQypkzbu
  freeze authority 2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk
  uri              https://token-metadata.paxos.com/pyusd_metadata/prod/solana/pyusd_metadata.json
  extensions       mintCloseAuthority, permanentDelegate, transferFeeConfig, confidentialTransferMint, confidentialTransferFeeConfig, transferHook, metadataPointer, tokenMetadata
  transfer fee     0 bps, max 0 raw units
  perm. delegate   2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk
  transfer hook    none
  flags            mintAuthorityActive, freezeAuthorityActive, metadataMutable, hasPermanentDelegate
```

Several mints at once, `--uri` to fetch the off-chain JSON, `--json` for the full result, `--rpc <url>` for your own endpoint.

Library:

```js
import { getTokenMeta, riskFlags } from "solana-token-meta";

const m = await getTokenMeta("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"); // BONK

m.program;           // "spl-token"
m.decimals;          // 5
m.uiSupply;          // "87994293321566.95219"
m.mintAuthority;     // null  (renounced)
m.metadata;          // { source: "metaplex", name: "Bonk", symbol: "Bonk", uri: "https://arweave.net/…", isMutable: true, … }
m.metaplex;          // the full Metaplex account: creators, tokenStandard "Fungible", updateAuthority, …
riskFlags(m);        // { mintAuthorityActive: false, freezeAuthorityActive: false, metadataMutable: true, hasTransferFee: false, … }
```

## Examples

Each runs with `node examples/<name>.js` (all but `offline.js` call the public RPC):

| | |
|---|---|
| [basic.js](examples/basic.js) | One mint: program, decimals, supply, authorities, metadata source |
| [batch.js](examples/batch.js) | Four mints in one call, with their risk flags |
| [token-2022.js](examples/token-2022.js) | Every extension PYUSD carries, decoded |
| [offchain.js](examples/offchain.js) | `fetchJson: true`: description, image and socials from the uri |
| [offline.js](examples/offline.js) | No network: decode accounts you already fetched |

## API

| | |
|---|---|
| `getTokenMeta(mint, opts?)` | One mint. One RPC call (plus one HTTP GET with `fetchJson`). |
| `getTokenMetas(mints, opts?)` | Many mints, in order. 100 accounts per call, calls made one after another. |
| `riskFlags(meta)` | The boolean facts listed above. |
| `buildTokenMeta(mint, mintAccount, metadataAccount?, ctx?)` | The same result from raw base64 accounts. No network. |
| `decodeMint(data, owner?)` | Mint layout + Token-2022 TLV extensions. |
| `decodeMetaplexMetadata(data)` | Metaplex metadata account (Borsh). |
| `metadataAddress(mint)` | Metaplex metadata PDA. |
| `fetchOffchainJson(uri, opts?)` | The uri's JSON. Never throws; returns `{ ok: false, error }` instead. |
| `findProgramAddress`, `createProgramAddress`, `isOnCurve`, `base58Encode`, `base58Decode`, `isAddress` | The primitives underneath. |

Errors are `TokenMetaError` subclasses: `InvalidInputError` (bad address, before any network call), `RpcError` (with `code` and `status`), `RpcTimeoutError`, `DecodeError`. A mint that does not exist is not an error: it comes back with `exists: false` and a `reason`.

Full reference with every field: [docs/API.md](docs/API.md).

## Configuration

| Option | Default | |
|---|---|---|
| `rpcUrl` | `SOLANA_RPC_URL`, else `https://api.mainnet-beta.solana.com` | Any Solana JSON-RPC endpoint |
| `commitment` | `"confirmed"` | |
| `timeoutMs` | `15000` | Per RPC call |
| `metaplex` | `true` | `false` skips the Metaplex PDA (100 mints per call instead of 50) |
| `epoch` | from the response slot | Epoch used to pick the current transfer fee |
| `fetchJson` | `false` | Fetch the off-chain JSON |
| `uriTimeoutMs` / `uriMaxBytes` | `5000` / `262144` | Per off-chain fetch |
| `ipfsGateway` / `arweaveGateway` | `https://gateway.pinata.cloud/ipfs/` / `https://arweave.net/` | |
| `fetch` | `globalThis.fetch` | For tests or proxies |

Services this can talk to, and who runs them:

- **Solana public RPC** (`api.mainnet-beta.solana.com`, free, third party, rate limited). It serves `getMultipleAccounts`, which is the only RPC method used, so the defaults work with no key.
- **Free tiers of Helius, QuickNode and similar** (third party): set `SOLANA_RPC_URL` for higher limits.
- **IPFS and Arweave gateways** (third party), only with `fetchJson`.
- Nothing from Blix is required. Blix separately offers a [public API](https://blixvip.com/api) and an [MCP server](https://blixvip.com/mcp); this library does not use them.

## How it works

1. For each mint, derive its Metaplex metadata address: `findProgramAddress(["metadata", metadataProgramId, mint], metadataProgramId)`. That is SHA-256 over the seeds, a bump byte and `"ProgramDerivedAddress"`, trying bumps from 255 down until the hash is not a valid ed25519 point (checked with `BigInt` arithmetic mod 2^255 − 19).
2. One `getMultipleAccounts` call, base64, for `[mint, metadataPda, mint, metadataPda, …]`, 100 accounts per call.
3. The mint's owner says which program it is. The first 82 bytes are the classic mint layout. A Token-2022 mint is padded to 165 bytes, then has an account-type byte, then type-length-value extensions, which are walked and decoded one by one.
4. The metadata account is used only if it is owned by the Metaplex program and its `mint` field matches. Name and display fields come from the Token-2022 TokenMetadata extension when the mint's metadata pointer points at itself, otherwise from Metaplex.
5. The transfer fee in force is the newer fee once its epoch is reached, else the older one. The epoch is the response slot divided by 432,000, which is mainnet's fixed epoch length.

## Limitations

- **Metadata pointers to other accounts are not followed.** When a Token-2022 mint's metadata pointer names an account other than the mint itself or its Metaplex PDA, the address is reported in `extensions.metadataPointer` but that account is not read.
- **Some extensions are named, not decoded**: the confidential-transfer family (`confidentialTransferMint`, `confidentialTransferFeeConfig`, `confidentialMintBurn`) comes back as `{ decoded: false, size }`.
- **Metaplex fields after `uses`** (`collectionDetails`, `programmableConfig`) are not decoded. Compressed NFTs have no metadata account and are not covered.
- **The current transfer fee assumes 432,000-slot epochs.** That is true on mainnet; on another cluster, pass `epoch` yourself.
- **Off-chain JSON is best effort.** Public gateways rate limit and some hosts refuse scripted requests: in testing, the PYUSD uri answered HTTP 403 and an older `Qm…` IPFS link timed out on the default gateway. Links to `ipfs.io`, `dweb.link` and Cloudflare's retired gateway are moved to `ipfsGateway`, because those gateways no longer serve plain HTTP clients. The private-address check looks at the URL's host as written; it does not resolve DNS, so a public name that resolves to a private IP is not caught. Leave `fetchJson` off on servers that can reach internal services, or put it behind your own egress rules.
- **Facts only.** No holders, prices, liquidity or rug scores. A live mint authority on USDC and on a fresh memecoin mean different things; the flags do not tell them apart.

## Contributing

Pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), run `npm test` (fully offline), and come talk it through on **[Discord](https://discord.gg/grokbot)** before larger changes. `node scripts/capture-fixtures.js` re-captures the test fixtures from mainnet.

## Related projects

| | |
|---|---|
| [sol-holders](https://github.com/blixvip/sol-holders) | Top holders of a Solana token by wallet, pools and bonding curves left out |
| [pump-curve](https://github.com/blixvip/pump-curve) | Read a pump.fun bonding curve: price, market cap, progress, migration |
| [solana-rpc-pool](https://github.com/blixvip/solana-rpc-pool) | Several RPC endpoints behind one client, rate limits respected, failover |
| [solana-tx-parse](https://github.com/blixvip/solana-tx-parse) | Explain a transaction: fees, errors, transfers, balance changes |
| [solana-readonly-mcp](https://github.com/blixvip/solana-readonly-mcp) | The same kind of reads, exposed to AI agents over MCP |

## Contributors

Every merged pull request is credited in the release notes. Pick a [good first issue](https://github.com/blixvip/solana-token-meta/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) or say hi in the [Discord](https://discord.gg/grokbot).

<a href="https://github.com/blixvip/solana-token-meta/graphs/contributors"><img src="https://contrib.rocks/image?repo=blixvip/solana-token-meta" alt="Contributors to solana-token-meta"></a>

## License

MIT

# API reference

```js
import { getTokenMeta, getTokenMetas, riskFlags /* … */ } from "solana-token-meta";
```

TypeScript declarations: [`index.d.ts`](../index.d.ts).

## getTokenMeta(mint, opts?) → Promise&lt;TokenMeta&gt;

Reads one mint. One `getMultipleAccounts` call for `[mint, metadataPda]`; with `fetchJson: true`, one HTTP GET for the uri as well. Throws `InvalidInputError` if `mint` is not a base58 32-byte address (before any network call).

## getTokenMetas(mints, opts?) → Promise&lt;TokenMeta[]&gt;

Reads many mints, returned in the same order (duplicates allowed). Addresses go 100 per `getMultipleAccounts` call (50 mints with Metaplex, 100 with `metaplex: false`); calls are made one after another, not in parallel. With `fetchJson`, at most 4 off-chain fetches run at a time. An empty array returns `[]` with no call.

### Options

| Option | Type | Default | |
|---|---|---|---|
| `rpcUrl` | string | `process.env.SOLANA_RPC_URL` or `https://api.mainnet-beta.solana.com` | |
| `commitment` | `"processed" \| "confirmed" \| "finalized"` | `"confirmed"` | |
| `timeoutMs` | number | `15000` | Per RPC call (`AbortSignal.timeout`) |
| `metaplex` | boolean | `true` | Also read the Metaplex metadata PDA |
| `epoch` | number | from the response slot ÷ 432,000 | Picks the transfer fee in force |
| `fetchJson` | boolean | `false` | Fetch the uri's JSON into `offchain` |
| `uriTimeoutMs` | number | `5000` | Per off-chain fetch, redirects included |
| `uriMaxBytes` | number | `262144` | Body size cap |
| `ipfsGateway` | string | `https://gateway.pinata.cloud/ipfs/` | Used for `ipfs://` and retired-gateway links |
| `arweaveGateway` | string | `https://arweave.net/` | Used for `ar://` |
| `fetch` | function | `globalThis.fetch` | |

## TokenMeta

| Field | Type | |
|---|---|---|
| `mint` | string | As passed in |
| `exists` | boolean | A token mint account exists at this address |
| `reason` | string \| null | Why `exists` is false: `"no account at this address"`, `"not a token mint: the account is owned by …"`, or a decode problem |
| `slot` | number \| null | Slot of the RPC response |
| `program` | `"spl-token" \| "token-2022" \| null` | |
| `programId` | string \| null | |
| `decimals` | number \| null | |
| `supply` | string \| null | Raw u64 as a decimal string |
| `uiSupply` | string \| null | `supply / 10^decimals`, exact |
| `mintAuthority` | string \| null | `null` = no one can mint more |
| `freezeAuthority` | string \| null | `null` = no one can freeze accounts |
| `isInitialized` | boolean \| null | |
| `extensionTypes` | number[] | Token-2022 extension type numbers, in account order |
| `extensions` | object | Keyed by name, see below |
| `unknownExtensions` | number[] | Type numbers this version has no name for |
| `transferFee` | `{ basisPoints, maximumFee, sinceEpoch }` \| null | The fee in force, when TransferFeeConfig is present |
| `metadata` | object \| null | `{ source, name, symbol, uri, updateAuthority, isMutable, additionalMetadata }` |
| `metaplex` | object \| null | The full Metaplex account plus its `address` |
| `offchain` | object \| null \| undefined | Only with `fetchJson`; see `fetchOffchainJson` |

`metadata.source` is `"token-2022"` when the mint carries a TokenMetadata extension and its metadata pointer is absent or points at the mint itself (or there is no Metaplex account); otherwise `"metaplex"` when a Metaplex account exists. For Token-2022 metadata, `isMutable` is `updateAuthority !== null`.

### Extensions

u64 values are decimal strings. An all-zero authority is `null`. A known extension that is not decoded is `{ decoded: false, size }`; one whose bytes do not match the expected layout is `{ decoded: false, size, error }`.

| Type | Key | Fields |
|---|---|---|
| 1 | `transferFeeConfig` | `transferFeeConfigAuthority`, `withdrawWithheldAuthority`, `withheldAmount`, `olderTransferFee`, `newerTransferFee` (each `{ epoch, maximumFee, transferFeeBasisPoints }`) |
| 3 | `mintCloseAuthority` | `closeAuthority` |
| 4 | `confidentialTransferMint` | not decoded |
| 6 | `defaultAccountState` | `state`: `"Uninitialized" \| "Initialized" \| "Frozen"` |
| 9 | `nonTransferable` | `{}` |
| 10 | `interestBearingConfig` | `rateAuthority`, `initializationTimestamp`, `preUpdateAverageRate`, `lastUpdateTimestamp`, `currentRate` (bps/year) |
| 12 | `permanentDelegate` | `delegate` |
| 14 | `transferHook` | `authority`, `programId` |
| 16 | `confidentialTransferFeeConfig` | not decoded |
| 18 | `metadataPointer` | `authority`, `metadataAddress` |
| 19 | `tokenMetadata` | `updateAuthority`, `mint`, `name`, `symbol`, `uri`, `additionalMetadata` (`[key, value][]`) |
| 20 | `groupPointer` | `authority`, `groupAddress` |
| 21 | `tokenGroup` | `updateAuthority`, `mint`, `size`, `maxSize` |
| 22 | `groupMemberPointer` | `authority`, `memberAddress` |
| 23 | `tokenGroupMember` | `mint`, `group`, `memberNumber` |
| 24 | `confidentialMintBurn` | not decoded |
| 25 | `scaledUiAmountConfig` | `authority`, `multiplier`, `newMultiplierEffectiveTimestamp`, `newMultiplier` |
| 26 | `pausableConfig` | `authority`, `paused` |

Account-only types (2, 5, 7, 8, 11, 13, 15, 17, 27) are named in `EXTENSION_NAMES` but do not appear on mints.

### Metaplex fields

`address`, `updateAuthority`, `mint`, `name`, `symbol`, `uri`, `sellerFeeBasisPoints`, `creators` (`[{ address, verified, share }]` or `null`), `primarySaleHappened`, `isMutable`, `editionNonce`, `tokenStandard` (`"NonFungible" | "FungibleAsset" | "Fungible" | "NonFungibleEdition" | "ProgrammableNonFungible" | "ProgrammableNonFungibleEdition"` or `null` on older accounts), `collection` (`{ verified, key }` or `null`), `uses` (`{ useMethod, remaining, total }` or `null`). NUL padding is stripped from name, symbol and uri.

## riskFlags(meta) → RiskFlags

| Flag | True when |
|---|---|
| `mintAuthorityActive` | `mintAuthority` is set |
| `freezeAuthorityActive` | `freezeAuthority` is set |
| `metadataMutable` | the metadata can still be changed (`null` when there is no metadata) |
| `hasTransferFee` | the fee in force is above 0 bps |
| `hasPermanentDelegate` | PermanentDelegate is present with a delegate set |
| `hasTransferHook` | TransferHook is present with a program set |
| `nonTransferable` | NonTransferable is present |
| `defaultAccountsFrozen` | DefaultAccountState is `Frozen` |
| `paused` | Pausable is present and paused |

## buildTokenMeta(mint, mintAccount, metadataAccount?, ctx?) → TokenMeta

Pure. `mintAccount` and `metadataAccount` are entries of a `getMultipleAccounts` / `getAccountInfo` result with `encoding: "base64"` (`{ owner, data: [base64, "base64"] }`), or `null`. `ctx` is `{ slot?, epoch? }`.

## decodeMint(data, owner?) → DecodedMint

`data` is bytes or a base64 string. Extensions are read only when the data is longer than 82 bytes and `owner` is Token-2022 or not given. Throws `DecodeError` on data shorter than 82 bytes, a wrong account-type byte or a TLV entry running past the end.

## decodeMetaplexMetadata(data) → MetaplexMetadata

Throws `DecodeError` if the first byte is not 4 (MetadataV1) or the data ends before `isMutable`.

## metadataAddress(mint) → string

The Metaplex metadata PDA. Pure.

## fetchOffchainJson(uri, opts?) → Promise&lt;OffchainResult&gt;

`opts`: `fetch`, `timeoutMs` (5000), `maxBytes` (262144), `ipfsGateway`, `arweaveGateway`. Never throws. On success: `{ ok: true, url, name, symbol, description, image, website, twitter, telegram, discord, json }` (fields read from the top level, then from `extensions`; `website` falls back to `external_url`). On failure: `{ ok: false, url, error }`. Follows up to 3 redirects, re-checking each target.

## resolveUri(uri, opts?) → string | null

`ipfs://` and `ar://` to gateway URLs, retired IPFS gateways to `ipfsGateway`; `null` for non-http(s), credentials in the URL, `localhost`, `*.local`, `*.internal`, and private, loopback, link-local and CGNAT IP literals.

## Primitives

- `base58Encode(bytes)`, `base58Decode(text)` (throws `InvalidInputError` on a bad character), `isAddress(value)`.
- `isOnCurve(bytes)`: whether 32 bytes are a valid compressed ed25519 point.
- `findProgramAddress(seeds, programId)` → `[address, bump]`; `createProgramAddress(seeds, programId)` → address or `null` if on the curve. Seeds are bytes or UTF-8 strings, at most 32 bytes each.
- `formatUnits(raw, decimals)`, `epochFromSlot(slot)`, `currentTransferFee(config, epoch)`.
- Constants: `PUBLIC_RPC`, `TOKEN_PROGRAM_ID`, `TOKEN_2022_PROGRAM_ID`, `METAPLEX_PROGRAM_ID`, `EXTENSION_NAMES`, `TOKEN_STANDARDS`, `SLOTS_PER_EPOCH`.

## Errors

All extend `TokenMetaError`.

| Class | When | Extra |
|---|---|---|
| `InvalidInputError` | Bad address or argument | |
| `RpcError` | JSON-RPC error, HTTP error, 429, unreachable, malformed answer | `code` (JSON-RPC code or HTTP status), `status` |
| `RpcTimeoutError` | No answer within `timeoutMs` | |
| `DecodeError` | Data that does not match the layout (from the `decode*` functions) | |

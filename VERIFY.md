# Verification, 2026-11-17

Node v24.15.0 on Windows 11. Live calls went to the free public endpoint `https://api.mainnet-beta.solana.com` only, sequential, a second or two apart, about 25 calls in total. Nothing was signed or sent.

## Tests

`npm test` (offline, no network):

```
ℹ tests 32
ℹ pass 31
ℹ fail 0
ℹ skipped 1
```

30 real tests; the 32nd entry is `test/helpers.js` (picked up by `node --test`, contains no tests) and the skipped one is the live test. `LIVE=1 node --test test/api.test.js`:

```
✔ live: USDC and PYUSD on the public RPC (LIVE=1 only) (326.9475ms)
ℹ pass 12
ℹ fail 0
```

Fixtures in `test/fixtures/` are raw `getMultipleAccounts` results captured from mainnet at slots 470678581 to 470678688 with `node scripts/capture-fixtures.js`: USDC (classic SPL + Metaplex), BONK (classic SPL + Metaplex, Fungible standard), GOAT `CzLSujWB…pump` (early pump.fun coin, classic SPL + Metaplex, immutable), PYUSD (Token-2022, 8 extensions), DEED `DxYWLXgK…pump` (newer pump.fun coin, Token-2022 + MetadataPointer + TokenMetadata).

PDA and base58 checks against values not produced by this code:
- base58: Bitcoin Core's 12 encode/decode test vectors.
- `isOnCurve`: 25 freshly generated `node:crypto` ed25519 public keys are on the curve; a PDA, a non-canonical y and the x = 0 / sign-bit case are rejected.
- `metadataAddress(USDC)` = `5x38Kp4hvdomTCnCrAny4UtMUt5rQBdB6px2K1Ui45Wq`, the well-known USDC metadata account.
- For USDC, BONK and GOAT the derived PDA holds, on mainnet, an account owned by the Metaplex program whose `mint` field is that mint.
- `findProgramAddress(["bonding-curve", mint], pump program)` reproduces the curve address `6FrLSW5z…` used in sol-holders' tests.

TypeScript: `index.d.ts` plus a small consumer file compiled clean with `tsc --noEmit --strict` (TypeScript borrowed from another local project; not a dependency here, so no `typecheck` script).

## README and examples, run

README quick start CLI (run as `npx --yes . <mint>` inside the repo, since the package is not on GitHub yet):

```
2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo
  PayPal USD (PYUSD)  metadata: token-2022, mutable
  program          token-2022
  decimals         6
  supply           686289566.817965
  mint authority   AxJkHRY3puoofyj7Pn512M1SGBgWroXMkEdNPQypkzbu
  freeze authority 2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk
  uri              https://token-metadata.paxos.com/pyusd_metadata/prod/solana/pyusd_metadata.json
  extensions       mintCloseAuthority, permanentDelegate, transferFeeConfig, confidentialTransferMint, confidentialTransferFeeConfig, transferHook, metadataPointer, tokenMetadata
  transfer fee     0 bps, max 0 raw units
  perm. delegate   2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk
  transfer hook    none
  flags            mintAuthorityActive, freezeAuthorityActive, metadataMutable, hasPermanentDelegate
exit 0
```

README library snippet (BONK; run as a temporary `.mjs` inside the repo, importing `"solana-token-meta"` through the package's self-reference):

```
spl-token 5 87994293321566.95219 null
{ source: 'metaplex', name: 'Bonk', symbol: 'Bonk', uri: 'https://arweave.net/QPC6FYdUn-3V8ytFNuoCS85S2tHAuiDblh6u3CIZLsw',
  updateAuthority: '9AhKqLR67hwapvG8SA2JFXaCshXc9nALJjpKaHZrsbkw', isMutable: true, additionalMetadata: [] }
Fungible null 9AhKqLR67hwapvG8SA2JFXaCshXc9nALJjpKaHZrsbkw
{ mintAuthorityActive: false, freezeAuthorityActive: false, metadataMutable: true, hasTransferFee: false,
  hasPermanentDelegate: false, hasTransferHook: false, nonTransferable: false, defaultAccountsFrozen: false, paused: false }
```

`node examples/offline.js` (no network):

```
metadata PDA: 5x38Kp4hvdomTCnCrAny4UtMUt5rQBdB6px2K1Ui45Wq
USD Coin USDC 9168330668.217383
{ mintAuthorityActive: true, freezeAuthorityActive: true, metadataMutable: true, hasTransferFee: false, hasPermanentDelegate: false, hasTransferHook: false, nonTransferable: false, defaultAccountsFrozen: false, paused: false }
```

`node examples/basic.js`:

```
USD Coin (USDC) on spl-token
decimals 6, supply 9162860438.965993
mint authority:   BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG
freeze authority: 7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar
metadata from metaplex, mutable
```

`node examples/batch.js`:

```
USDC   spl-token  mintAuthorityActive, freezeAuthorityActive, metadataMutable
PYUSD  token-2022 mintAuthorityActive, freezeAuthorityActive, metadataMutable, hasPermanentDelegate
Bonk   spl-token  metadataMutable
GOAT   spl-token  no flags
```

`node examples/token-2022.js`:

```
extension types: 3, 12, 1, 4, 16, 14, 18, 19
mintCloseAuthority: {"closeAuthority":"2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk"}
permanentDelegate: {"delegate":"2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk"}
transferFeeConfig: {"transferFeeConfigAuthority":"2apBGMsS…","withdrawWithheldAuthority":"2apBGMsS…","withheldAmount":"0","olderTransferFee":{"epoch":"605","maximumFee":"0","transferFeeBasisPoints":0},"newerTransferFee":{"epoch":"605","maximumFee":"0","transferFeeBasisPoints":0}}
confidentialTransferMint: {"decoded":false,"size":65}
confidentialTransferFeeConfig: {"decoded":false,"size":129}
transferHook: {"authority":"2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk","programId":null}
metadataPointer: {"authority":"2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk","metadataAddress":"2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"}
current transfer fee: { basisPoints: 0, maximumFee: '0', sinceEpoch: '605' }
unknown extension types: []
```

`node examples/offchain.js`:

```
https://arweave.net/QPC6FYdUn-3V8ytFNuoCS85S2tHAuiDblh6u3CIZLsw
{ description: 'The Official Bonk Inu token', image: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I', website: null, twitter: null }
```

Other CLI runs:
- `--uri` on DEED (Token-2022 pump.fun): description, image, website `https://deedmap.fun/` and X link read from IPFS after `ipfs.io` was rewritten to the default gateway.
- `--json` on GOAT: valid JSON with `metaplex.address` `5XupC6FA…` and `riskFlags` all false; exit 0.
- `nope`: `not a Solana address: "nope"`, exit 1. Unreachable RPC: `getMultipleAccounts: the RPC could not be reached (fetch failed)`, exit 1. Nonexistent address: `no account at this address`, exit 0.

## Live findings that shaped the code

- `ipfs.io` and `dweb.link` now answer HTTP 429 with "switching to a service worker gateway only" for plain HTTP clients. `gateway.pinata.cloud` served the same CID with 200, so it is the default and links to the retired gateways are rewritten.
- The PYUSD uri (`token-metadata.paxos.com`) answered HTTP 403 to both Node fetch and curl from this machine; reported as `{ ok: false, error: "HTTP 403" }`.
- GOAT's `Qm…` uri timed out (5 s) on the default gateway once; reported as an error, not thrown.
- On Windows, `process.exit()` right after a fetch triggered a libuv assertion (`UV_HANDLE_CLOSING`); the CLI now sets `process.exitCode` instead.

## Not verified

- `npx github:blixvip/solana-token-meta` and `npm install github:blixvip/solana-token-meta`: the repo is not published.
- Decoders for InterestBearingConfig, DefaultAccountState, NonTransferable, ScaledUiAmount, Pausable, group/member extensions, Metaplex creators, collection and uses were tested against synthetic bytes built from the published layouts, not against captured mainnet accounts.
- A mint with a non-zero transfer fee, an active transfer hook program, or a metadata pointer to an external account was not tested live.
- Node 20 and 22 were not run; only Node 24. The code uses nothing newer than Node 20 (`AbortSignal.timeout`, global `fetch`, `node:test`).
- Devnet/testnet epoch length was not checked; the docs say to pass `epoch` off mainnet.

## Known limitations

See the README's Limitations section: external metadata pointers not followed, confidential-transfer extensions not decoded, Metaplex fields after `uses` not decoded, off-chain fetch is best effort and its private-address check does not resolve DNS.

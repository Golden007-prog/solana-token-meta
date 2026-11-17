# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-11-17

### Fixed

- RPC and off-chain JSON timeouts now always fire. `AbortSignal.timeout()` runs on an unref'd timer, so when nothing else held the event loop open (a custom `fetch`, a stalled request) Node could exit before the timeout fired, leaving `getTokenMeta` / `getTokenMetas` / `fetchOffchainJson` unsettled instead of failing with `RpcTimeoutError` or `{ ok: false }`. The timeout now uses a ref'd timer that is cleared when the call finishes. Seen on Node 20 and 22.

### Changed

- CI runs every Node version in the matrix to completion (`fail-fast: false`).

## [1.0.0] - 2026-11-17

### Added

- `getTokenMeta` and `getTokenMetas`: mint and Metaplex metadata PDA in one `getMultipleAccounts` call, 100 accounts per call.
- Mint decoding for SPL Token and Token-2022: decimals, supply, mint and freeze authority.
- Token-2022 extension decoding (TransferFeeConfig, MetadataPointer, TokenMetadata, PermanentDelegate, NonTransferable, DefaultAccountState, InterestBearingConfig, MintCloseAuthority, TransferHook, group and member pointers, TokenGroup, TokenGroupMember, ScaledUiAmount, Pausable); other types named or listed by number.
- Metaplex Token Metadata decoding, with the PDA derived locally.
- `riskFlags`: factual booleans for authorities, mutability, transfer fee, permanent delegate, transfer hook, non-transferable, default-frozen and paused.
- Opt-in off-chain JSON fetch with timeout, size cap and private-address blocking.
- Zero-dependency base58, ed25519 on-curve check and program-derived addresses.
- CLI `solana-token-meta <mint...> [--json] [--uri] [--rpc <url>]`.
- TypeScript declarations.

[1.0.1]: https://github.com/blixvip/solana-token-meta/releases/tag/v1.0.1
[1.0.0]: https://github.com/blixvip/solana-token-meta/releases/tag/v1.0.0

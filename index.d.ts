// Type declarations for solana-token-meta.

export const PUBLIC_RPC: string;
export const TOKEN_PROGRAM_ID: string;
export const TOKEN_2022_PROGRAM_ID: string;
export const METAPLEX_PROGRAM_ID: string;
export const SLOTS_PER_EPOCH: number;
export const EXTENSION_NAMES: Record<number, string>;
export const TOKEN_STANDARDS: string[];

export interface TokenMetaOptions {
  /** Default: env SOLANA_RPC_URL, else https://api.mainnet-beta.solana.com */
  rpcUrl?: string;
  /** Default "confirmed". */
  commitment?: "processed" | "confirmed" | "finalized";
  /** Also fetch each mint's Metaplex metadata PDA in the same call. Default true. */
  metaplex?: boolean;
  /** Epoch used to pick the current Token-2022 transfer fee. Default: derived from the response slot (432,000 slots per epoch). */
  epoch?: number | null;
  /** Fetch the off-chain JSON at the metadata uri. Default false. */
  fetchJson?: boolean;
  /** Timeout per off-chain JSON fetch. Default 5000. */
  uriTimeoutMs?: number;
  /** Size cap per off-chain JSON. Default 262144. */
  uriMaxBytes?: number;
  /** Default https://gateway.pinata.cloud/ipfs/ */
  ipfsGateway?: string;
  /** Default https://arweave.net/ */
  arweaveGateway?: string;
  /** RPC timeout per call. Default 15000. */
  timeoutMs?: number;
  /** Custom fetch (tests, proxies). Default globalThis.fetch. */
  fetch?: typeof fetch;
}

export interface TransferFee { epoch: string; maximumFee: string; transferFeeBasisPoints: number }
export interface UndecodedExtension { decoded: false; size: number; error?: string }

export interface Extensions {
  transferFeeConfig?: { transferFeeConfigAuthority: string | null; withdrawWithheldAuthority: string | null; withheldAmount: string; olderTransferFee: TransferFee; newerTransferFee: TransferFee } | UndecodedExtension;
  mintCloseAuthority?: { closeAuthority: string | null } | UndecodedExtension;
  defaultAccountState?: { state: "Uninitialized" | "Initialized" | "Frozen" | string } | UndecodedExtension;
  nonTransferable?: {} | UndecodedExtension;
  interestBearingConfig?: { rateAuthority: string | null; initializationTimestamp: number; preUpdateAverageRate: number; lastUpdateTimestamp: number; currentRate: number } | UndecodedExtension;
  permanentDelegate?: { delegate: string | null } | UndecodedExtension;
  transferHook?: { authority: string | null; programId: string | null } | UndecodedExtension;
  metadataPointer?: { authority: string | null; metadataAddress: string | null } | UndecodedExtension;
  tokenMetadata?: { updateAuthority: string | null; mint: string; name: string; symbol: string; uri: string; additionalMetadata: [string, string][] } | UndecodedExtension;
  groupPointer?: { authority: string | null; groupAddress: string | null } | UndecodedExtension;
  groupMemberPointer?: { authority: string | null; memberAddress: string | null } | UndecodedExtension;
  tokenGroup?: { updateAuthority: string | null; mint: string; size: string; maxSize: string } | UndecodedExtension;
  tokenGroupMember?: { mint: string; group: string; memberNumber: string } | UndecodedExtension;
  scaledUiAmountConfig?: { authority: string | null; multiplier: number; newMultiplierEffectiveTimestamp: number; newMultiplier: number } | UndecodedExtension;
  pausableConfig?: { authority: string | null; paused: boolean } | UndecodedExtension;
  [name: string]: unknown;
}

export interface DecodedMint {
  mintAuthority: string | null;
  /** Raw integer amount as a string (u64). */
  supply: string;
  decimals: number;
  isInitialized: boolean;
  freezeAuthority: string | null;
  extensionTypes: number[];
  extensions: Extensions;
  unknownExtensions: number[];
}

export interface MetaplexMetadata {
  updateAuthority: string;
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: { address: string; verified: boolean; share: number }[] | null;
  primarySaleHappened: boolean | null;
  isMutable: boolean | null;
  editionNonce: number | null;
  tokenStandard: string | null;
  collection: { verified: boolean; key: string } | null;
  uses: { useMethod: string; remaining: string; total: string } | null;
}

export interface Metadata {
  source: "token-2022" | "metaplex";
  name: string;
  symbol: string;
  uri: string;
  updateAuthority: string | null;
  isMutable: boolean | null;
  additionalMetadata: [string, string][];
}

export interface OffchainFields {
  name: string | null; symbol: string | null; description: string | null; image: string | null;
  website: string | null; twitter: string | null; telegram: string | null; discord: string | null;
}
export type OffchainResult = ({ ok: true; url: string; json: unknown } & OffchainFields) | { ok: false; url: string | null; error: string };

export interface TokenMeta {
  mint: string;
  /** A token mint account exists at this address. */
  exists: boolean;
  /** Why `exists` is false. */
  reason: string | null;
  slot: number | null;
  program: "spl-token" | "token-2022" | null;
  programId: string | null;
  decimals: number | null;
  supply: string | null;
  /** Supply in whole tokens, as an exact decimal string. */
  uiSupply: string | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  isInitialized: boolean | null;
  extensionTypes: number[];
  extensions: Extensions;
  unknownExtensions: number[];
  transferFee: { basisPoints: number; maximumFee: string; sinceEpoch: string } | null;
  metadata: Metadata | null;
  metaplex: (MetaplexMetadata & { address: string }) | null;
  /** Present only with fetchJson: true. Null when there is no metadata. */
  offchain?: OffchainResult | null;
}

export interface RiskFlags {
  mintAuthorityActive: boolean;
  freezeAuthorityActive: boolean;
  /** null when no metadata was found. */
  metadataMutable: boolean | null;
  hasTransferFee: boolean;
  hasPermanentDelegate: boolean;
  hasTransferHook: boolean;
  nonTransferable: boolean;
  defaultAccountsFrozen: boolean;
  paused: boolean;
}

interface RawAccount { owner: string; data: [string, string] | string[] }

export function getTokenMeta(mint: string, opts?: TokenMetaOptions): Promise<TokenMeta>;
export function getTokenMetas(mints: string[], opts?: TokenMetaOptions): Promise<TokenMeta[]>;
export function buildTokenMeta(mint: string, mintAccount: RawAccount | null, metadataAccount?: RawAccount | null, ctx?: { slot?: number | null; epoch?: number | null }): TokenMeta;
export function riskFlags(meta: TokenMeta): RiskFlags;

export function decodeMint(data: Uint8Array | string, owner?: string): DecodedMint;
export function decodeMetaplexMetadata(data: Uint8Array | string): MetaplexMetadata;
export function metadataAddress(mint: string): string;
export function currentTransferFee(config: Extensions["transferFeeConfig"], epoch: number | bigint | string | null): { basisPoints: number; maximumFee: string; sinceEpoch: string } | null;
export function epochFromSlot(slot: number): number;
export function formatUnits(raw: string | bigint | number, decimals: number): string;

export function fetchOffchainJson(uri: string, opts?: { fetch?: typeof fetch; timeoutMs?: number; maxBytes?: number; ipfsGateway?: string; arweaveGateway?: string }): Promise<OffchainResult>;
export function resolveUri(uri: string, opts?: { ipfsGateway?: string; arweaveGateway?: string }): string | null;
export function pickOffchainFields(json: unknown): OffchainFields;

export function base58Encode(bytes: Uint8Array): string;
export function base58Decode(text: string): Uint8Array; // a Node Buffer at runtime
export function isAddress(value: unknown): boolean;
export function isOnCurve(bytes: Uint8Array): boolean;
export function findProgramAddress(seeds: (Uint8Array | string)[], programId: string | Uint8Array): [string, number];
export function createProgramAddress(seeds: (Uint8Array | string)[], programId: string | Uint8Array): string | null;

export class TokenMetaError extends Error {}
export class InvalidInputError extends TokenMetaError {}
export class RpcError extends TokenMetaError { code: number | null; status: number | null }
export class RpcTimeoutError extends TokenMetaError {}
export class DecodeError extends TokenMetaError {}

// SPL Token and Token-2022 mint accounts: the 82-byte base layout, and Token-2022's TLV extensions after it.
import { Reader } from "./reader.js";
import { DecodeError } from "./errors.js";

export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const MINT_SIZE = 82;
const ACCOUNT_SIZE = 165;          // Token-2022 pads a mint to the token-account size, then writes the account type byte
const ACCOUNT_TYPE_MINT = 1;

/** Token-2022 extension type numbers (spl-token-2022 `ExtensionType`), name used as the key in `extensions`. */
export const EXTENSION_NAMES = {
  1: "transferFeeConfig", 2: "transferFeeAmount", 3: "mintCloseAuthority", 4: "confidentialTransferMint",
  5: "confidentialTransferAccount", 6: "defaultAccountState", 7: "immutableOwner", 8: "memoTransfer",
  9: "nonTransferable", 10: "interestBearingConfig", 11: "cpiGuard", 12: "permanentDelegate",
  13: "nonTransferableAccount", 14: "transferHook", 15: "transferHookAccount", 16: "confidentialTransferFeeConfig",
  17: "confidentialTransferFeeAmount", 18: "metadataPointer", 19: "tokenMetadata", 20: "groupPointer",
  21: "tokenGroup", 22: "groupMemberPointer", 23: "tokenGroupMember", 24: "confidentialMintBurn",
  25: "scaledUiAmountConfig", 26: "pausableConfig", 27: "pausableAccount",
};
const ACCOUNT_STATES = ["Uninitialized", "Initialized", "Frozen"];

const fee = (r) => ({ epoch: r.u64().toString(), maximumFee: r.u64().toString(), transferFeeBasisPoints: r.u16() });

/** Decoders for the extensions this library understands. Each gets a Reader bounded to the extension's bytes. */
const DECODERS = {
  transferFeeConfig: (r) => ({
    transferFeeConfigAuthority: r.optPubkey(),
    withdrawWithheldAuthority: r.optPubkey(),
    withheldAmount: r.u64().toString(),
    olderTransferFee: fee(r),
    newerTransferFee: fee(r),
  }),
  mintCloseAuthority: (r) => ({ closeAuthority: r.optPubkey() }),
  defaultAccountState: (r) => { const s = r.u8(); return { state: ACCOUNT_STATES[s] ?? `Unknown(${s})` }; },
  nonTransferable: () => ({}),
  interestBearingConfig: (r) => ({
    rateAuthority: r.optPubkey(),
    initializationTimestamp: Number(r.i64()),
    preUpdateAverageRate: r.i16(),
    lastUpdateTimestamp: Number(r.i64()),
    currentRate: r.i16(),               // basis points per year
  }),
  permanentDelegate: (r) => ({ delegate: r.optPubkey() }),
  transferHook: (r) => ({ authority: r.optPubkey(), programId: r.optPubkey() }),
  metadataPointer: (r) => ({ authority: r.optPubkey(), metadataAddress: r.optPubkey() }),
  tokenMetadata: (r) => {
    const out = { updateAuthority: r.optPubkey(), mint: r.pubkey(), name: r.string(), symbol: r.string(), uri: r.string().trim(), additionalMetadata: [] };
    const n = r.u32();
    for (let i = 0; i < n; i++) out.additionalMetadata.push([r.string(), r.string()]);
    return out;
  },
  groupPointer: (r) => ({ authority: r.optPubkey(), groupAddress: r.optPubkey() }),
  groupMemberPointer: (r) => ({ authority: r.optPubkey(), memberAddress: r.optPubkey() }),
  tokenGroup: (r) => ({ updateAuthority: r.optPubkey(), mint: r.pubkey(), size: r.u64().toString(), maxSize: r.u64().toString() }),
  tokenGroupMember: (r) => ({ mint: r.pubkey(), group: r.pubkey(), memberNumber: r.u64().toString() }),
  scaledUiAmountConfig: (r) => ({ authority: r.optPubkey(), multiplier: r.f64(), newMultiplierEffectiveTimestamp: Number(r.i64()), newMultiplier: r.f64() }),
  pausableConfig: (r) => ({ authority: r.optPubkey(), paused: r.bool() }),
};

/**
 * Decode a mint account's data.
 * @param {Buffer|Uint8Array|string} data account data (base64 string or bytes)
 * @param {string} [owner] the owning program; Token-2022 extensions are read only for Token-2022 mints
 */
export function decodeMint(data, owner) {
  const b = typeof data === "string" ? Buffer.from(data, "base64") : Buffer.from(data);
  if (b.length < MINT_SIZE) throw new DecodeError(`a mint account is at least ${MINT_SIZE} bytes, got ${b.length}`);
  const r = new Reader(b, 0, MINT_SIZE);
  const mintAuthOpt = r.u32(); const mintAuth = r.pubkey();
  const supply = r.u64();
  const decimals = r.u8();
  const isInitialized = r.bool();
  const freezeOpt = r.u32(); const freezeAuth = r.pubkey();
  const out = {
    mintAuthority: mintAuthOpt ? mintAuth : null,
    supply: supply.toString(),
    decimals,
    isInitialized,
    freezeAuthority: freezeOpt ? freezeAuth : null,
    extensionTypes: [],
    extensions: {},
    unknownExtensions: [],
  };
  if (b.length === MINT_SIZE || (owner && owner !== TOKEN_2022_PROGRAM_ID)) return out;
  if (b.length <= ACCOUNT_SIZE) throw new DecodeError(`a Token-2022 mint with extensions is longer than ${ACCOUNT_SIZE} bytes, got ${b.length}`);
  if (b[ACCOUNT_SIZE] !== ACCOUNT_TYPE_MINT) throw new DecodeError(`account type byte is ${b[ACCOUNT_SIZE]}, not a mint`);
  let at = ACCOUNT_SIZE + 1;
  while (at + 4 <= b.length) {
    const type = b.readUInt16LE(at), len = b.readUInt16LE(at + 2);
    if (type === 0) break;                       // Uninitialized: the rest is free space
    const start = at + 4, end = start + len;
    if (end > b.length) throw new DecodeError(`extension ${type} runs past the end of the account`);
    out.extensionTypes.push(type);
    const name = EXTENSION_NAMES[type];
    if (!name) out.unknownExtensions.push(type);
    else if (DECODERS[name]) {
      try { out.extensions[name] = DECODERS[name](new Reader(b, start, end)); }
      catch (e) { out.extensions[name] = { decoded: false, size: len, error: e.message }; }
    } else out.extensions[name] = { decoded: false, size: len };
    at = end;
  }
  return out;
}

/** Mainnet epochs are a fixed 432,000 slots with no warm-up, so the epoch follows from the slot. */
export const SLOTS_PER_EPOCH = 432_000;
export const epochFromSlot = (slot) => Math.floor(Number(slot) / SLOTS_PER_EPOCH);

/** The transfer fee in force at `epoch`: the newer fee once its epoch is reached, the older one before. */
export function currentTransferFee(config, epoch) {
  if (!config || config.decoded === false) return null;
  const newer = config.newerTransferFee, older = config.olderTransferFee;
  const f = epoch == null || BigInt(epoch) >= BigInt(newer.epoch) ? newer : older;
  return { basisPoints: f.transferFeeBasisPoints, maximumFee: f.maximumFee, sinceEpoch: f.epoch };
}

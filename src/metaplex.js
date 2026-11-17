// Metaplex Token Metadata: the metadata account of a mint (a program-derived address), and its Borsh layout.
import { findProgramAddress, toPubkeyBytes } from "./solana.js";
import { Reader } from "./reader.js";
import { DecodeError } from "./errors.js";

export const METAPLEX_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

/** The Metaplex metadata account of a mint: seeds ["metadata", program id, mint]. Pure, no network. */
export function metadataAddress(mint) {
  return findProgramAddress([Buffer.from("metadata"), toPubkeyBytes(METAPLEX_PROGRAM_ID), toPubkeyBytes(mint)], METAPLEX_PROGRAM_ID)[0];
}

export const TOKEN_STANDARDS = ["NonFungible", "FungibleAsset", "Fungible", "NonFungibleEdition", "ProgrammableNonFungible", "ProgrammableNonFungibleEdition"];
const USE_METHODS = ["Burn", "Multiple", "Single"];

/** Metaplex stores name/symbol/uri padded with NUL bytes to a fixed length; drop them. */
export const stripNul = (s) => s.replace(/\0+$/g, "").replace(/\0/g, "");

/**
 * Decode a Metaplex Token Metadata account (key 4 = MetadataV1).
 * Fields after `isMutable` were added over the years; older accounts stop early, so each one is read only while bytes remain.
 * @param {Buffer|Uint8Array|string} data account data (base64 string or bytes)
 */
export function decodeMetaplexMetadata(data) {
  const b = typeof data === "string" ? Buffer.from(data, "base64") : Buffer.from(data);
  const r = new Reader(b);
  const key = r.u8();
  if (key !== 4) throw new DecodeError(`not a Metaplex metadata account (key ${key}, expected 4)`);
  const out = {
    updateAuthority: r.pubkey(),
    mint: r.pubkey(),
    name: stripNul(r.string()),
    symbol: stripNul(r.string()),
    uri: stripNul(r.string()).trim(),
    sellerFeeBasisPoints: r.u16(),
    creators: null,
    primarySaleHappened: null,
    isMutable: null,
    editionNonce: null,
    tokenStandard: null,
    collection: null,
    uses: null,
  };
  if (r.u8()) {
    const n = r.u32();
    if (n > 5) throw new DecodeError(`implausible creator count ${n}`);
    out.creators = [];
    for (let i = 0; i < n; i++) out.creators.push({ address: r.pubkey(), verified: r.bool(), share: r.u8() });
  }
  out.primarySaleHappened = r.bool();
  out.isMutable = r.bool();
  // Optional tail. A missing byte reads as "absent".
  if (r.left >= 1 && r.u8()) out.editionNonce = r.left >= 1 ? r.u8() : null;
  if (r.left >= 1 && r.u8() && r.left >= 1) { const t = r.u8(); out.tokenStandard = TOKEN_STANDARDS[t] ?? `Unknown(${t})`; }
  if (r.left >= 1 && r.u8() && r.left >= 33) out.collection = { verified: r.bool(), key: r.pubkey() };
  if (r.left >= 1 && r.u8() && r.left >= 17) { const m = r.u8(); out.uses = { useMethod: USE_METHODS[m] ?? `Unknown(${m})`, remaining: r.u64().toString(), total: r.u64().toString() }; }
  return out;
}

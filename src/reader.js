// A bounds-checked little-endian reader for account data.
import { base58Encode } from "./solana.js";
import { DecodeError } from "./errors.js";

export class Reader {
  constructor(buf, at = 0, end = buf.length) { this.b = buf; this.at = at; this.end = end; }
  get left() { return this.end - this.at; }
  need(n) { if (this.at + n > this.end) throw new DecodeError(`account data ends early (need ${n} bytes at offset ${this.at}, ${this.left} left)`); }
  u8() { this.need(1); return this.b[this.at++]; }
  bool() { return this.u8() !== 0; }
  u16() { this.need(2); const v = this.b.readUInt16LE(this.at); this.at += 2; return v; }
  i16() { this.need(2); const v = this.b.readInt16LE(this.at); this.at += 2; return v; }
  u32() { this.need(4); const v = this.b.readUInt32LE(this.at); this.at += 4; return v; }
  u64() { this.need(8); const v = this.b.readBigUInt64LE(this.at); this.at += 8; return v; }
  i64() { this.need(8); const v = this.b.readBigInt64LE(this.at); this.at += 8; return v; }
  f64() { this.need(8); const v = this.b.readDoubleLE(this.at); this.at += 8; return v; }
  bytes(n) { this.need(n); const v = this.b.subarray(this.at, this.at + n); this.at += n; return v; }
  pubkey() { return base58Encode(this.bytes(32)); }
  /** An OptionalNonZeroPubkey (Token-2022): all zeros means "none". */
  optPubkey() { const raw = this.bytes(32); return raw.every((x) => x === 0) ? null : base58Encode(raw); }
  /** A Borsh string: u32 length, then UTF-8 bytes. */
  string(max = 10_000) { const n = this.u32(); if (n > max) throw new DecodeError(`string length ${n} is implausible`); return this.bytes(n).toString("utf8"); }
}

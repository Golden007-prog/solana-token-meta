// The few Solana primitives this needs, with no dependencies: base58, "is this 32-byte value a point on the ed25519
// curve", and program-derived addresses.
import crypto from "node:crypto";
import { InvalidInputError } from "./errors.js";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

/** Base58 (Bitcoin alphabet) to bytes. Throws InvalidInputError on a character outside the alphabet. */
export function base58Decode(text) {
  const s = String(text);
  let n = 0n;
  for (const ch of s) {
    const i = INDEX.get(ch);
    if (i === undefined) throw new InvalidInputError(`not base58: unexpected character ${JSON.stringify(ch)}`);
    n = n * 58n + BigInt(i);
  }
  const out = [];
  while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
  for (const ch of s) { if (ch !== "1") break; out.unshift(0); }
  return Buffer.from(out);
}

/** Bytes to base58 (Bitcoin alphabet). */
export function base58Encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}

/** A Solana address as 32 bytes, or throws InvalidInputError. Accepts a base58 string or 32 bytes. */
export function toPubkeyBytes(value) {
  if (value instanceof Uint8Array) {
    if (value.length !== 32) throw new InvalidInputError(`an address is 32 bytes, got ${value.length}`);
    return Buffer.from(value);
  }
  if (typeof value !== "string" || value.length < 32 || value.length > 44) throw new InvalidInputError(`not a Solana address: ${JSON.stringify(String(value).slice(0, 50))}`);
  const b = base58Decode(value);
  if (b.length !== 32) throw new InvalidInputError(`not a Solana address (decodes to ${b.length} bytes): ${value}`);
  return b;
}

/** True for a well-formed base58 32-byte address. Never throws. */
export function isAddress(value) {
  try { toPubkeyBytes(value); return true; } catch { return false; }
}

// ed25519 over GF(2^255 - 19): decompress y and check that x^2 = (y^2 - 1) / (d y^2 + 1) has a square root.
const P = 2n ** 255n - 19n;
const mod = (a) => ((a % P) + P) % P;
function pow(base, exp) { let r = 1n, b = mod(base); for (let e = exp; e > 0n; e >>= 1n) { if (e & 1n) r = (r * b) % P; b = (b * b) % P; } return r; }
const D = mod(-121665n * pow(121666n, P - 2n));
const SQRT_M1 = pow(2n, (P - 1n) / 4n);

/**
 * Is this 32-byte value a valid compressed ed25519 point? Wallet addresses are; program-derived addresses never are.
 * Matches the decompression rules used by the Solana runtime (curve25519-dalek): y must be canonical (< p), and
 * x = 0 with the sign bit set is rejected.
 */
export function isOnCurve(bytes) {
  if (!bytes || bytes.length !== 32) return false;
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(i === 31 ? bytes[i] & 0x7f : bytes[i]);
  const sign = bytes[31] >> 7;
  if (y >= P) return false;
  const y2 = (y * y) % P, u = mod(y2 - 1n), v = mod(D * y2 + 1n);
  const v3 = (v * v % P) * v % P, v7 = (v3 * v3 % P) * v % P;
  let x = (u * v3 % P) * pow(u * v7 % P, (P - 5n) / 8n) % P;
  const vx2 = (v * x % P) * x % P;
  if (vx2 === u) { /* root found */ }
  else if (vx2 === mod(-u)) x = x * SQRT_M1 % P;
  else return false;
  if (x === 0n && sign === 1) return false;
  return true;
}

const PDA_MARKER = Buffer.from("ProgramDerivedAddress");

/** createProgramAddress: the address for exactly these seeds (bump included), or null if it lands on the curve. */
export function createProgramAddress(seeds, programId) {
  if (!Array.isArray(seeds) || seeds.length > 16) throw new InvalidInputError("seeds must be an array of at most 16 entries");
  const program = toPubkeyBytes(programId);
  const h = crypto.createHash("sha256");
  for (const s of seeds) {
    const b = typeof s === "string" ? Buffer.from(s, "utf8") : Buffer.from(s);
    if (b.length > 32) throw new InvalidInputError("each seed is at most 32 bytes");
    h.update(b);
  }
  const digest = h.update(program).update(PDA_MARKER).digest();
  return isOnCurve(digest) ? null : base58Encode(digest);
}

/** findProgramAddress: [address, bump] for the highest bump (255 down to 0) whose address is off the curve. */
export function findProgramAddress(seeds, programId) {
  if (!Array.isArray(seeds) || seeds.length > 15) throw new InvalidInputError("seeds must be an array of at most 15 entries (the bump is the 16th)");
  for (let bump = 255; bump >= 0; bump--) {
    const addr = createProgramAddress([...seeds, Buffer.from([bump])], programId);
    if (addr) return [addr, bump];
  }
  throw new Error("no program-derived address exists for these seeds");
}

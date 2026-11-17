import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { base58Encode, base58Decode, isAddress, isOnCurve, findProgramAddress, createProgramAddress, metadataAddress, InvalidInputError, METAPLEX_PROGRAM_ID } from "../src/index.js";
import { fixture, MINTS } from "./helpers.js";

// Bitcoin's base58 test vectors (bitcoin/src/test/data/base58_encode_decode.json).
const VECTORS = [
  ["", ""], ["61", "2g"], ["626262", "a3gV"], ["636363", "aPEr"],
  ["73696d706c792061206c6f6e6720737472696e67", "2cFupjhnEsSn59qHXstmK2ffpLv2"],
  ["00eb15231dfceb60925886b67d065299925915aeb172c06647", "1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L"],
  ["516b6fcd0f", "ABnLTmg"], ["bf4f89001e670274dd", "3SEo3LWLoPntC"], ["572e4794", "3EFU7m"],
  ["ecac89cad93923c02321", "EJDM8drfXA6uyA"], ["10c8511e", "Rt5zm"], ["00000000000000000000", "1111111111"],
];

test("base58 matches Bitcoin's test vectors both ways", () => {
  for (const [hex, b58] of VECTORS) {
    assert.equal(base58Encode(Buffer.from(hex, "hex")), b58, hex);
    assert.equal(base58Decode(b58).toString("hex"), hex, b58);
  }
});

test("base58 on Solana addresses: system program is 32 zero bytes, round trips are exact", () => {
  assert.deepEqual(base58Decode("11111111111111111111111111111111"), Buffer.alloc(32));
  for (const m of Object.values(MINTS)) assert.equal(base58Encode(base58Decode(m)), m);
  assert.throws(() => base58Decode("0OIl"), InvalidInputError);
  assert.equal(isAddress(MINTS.usdc), true);
  assert.equal(isAddress("not-an-address"), false);
  assert.equal(isAddress("3EFU7m"), false, "valid base58 but 4 bytes");
  assert.equal(isAddress(123), false);
});

test("isOnCurve: freshly generated ed25519 public keys are on the curve", () => {
  for (let i = 0; i < 25; i++) {
    const { publicKey } = crypto.generateKeyPairSync("ed25519");
    const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    assert.equal(isOnCurve(raw), true);
  }
});

test("isOnCurve: program-derived addresses are not; y >= p is rejected; wrong length is false", () => {
  assert.equal(isOnCurve(base58Decode("5x38Kp4hvdomTCnCrAny4UtMUt5rQBdB6px2K1Ui45Wq")), false);
  assert.equal(isOnCurve(Buffer.alloc(32, 0xff)), false, "y = 2^255 - 1 is not canonical");
  assert.equal(isOnCurve(Buffer.alloc(31)), false);
  const one = Buffer.alloc(32); one[0] = 1;  // y = 1 → x = 0, the identity point: on the curve
  assert.equal(isOnCurve(one), true);
  one[31] = 0x80;                              // x = 0 with the sign bit set: rejected, as in curve25519-dalek
  assert.equal(isOnCurve(one), false);
});

test("Metaplex metadata PDA of USDC is the well-known 5x38Kp4h… address", () => {
  assert.equal(metadataAddress(MINTS.usdc), "5x38Kp4hvdomTCnCrAny4UtMUt5rQBdB6px2K1Ui45Wq");
});

test("derived metadata PDAs hold, on mainnet, a Metaplex account for that exact mint", () => {
  for (const name of ["usdc", "bonk", "pump"]) {
    const f = fixture(name);
    assert.equal(f.params[0][1], metadataAddress(MINTS[name]));
    const acc = f.result.value[1];
    assert.equal(acc.owner, METAPLEX_PROGRAM_ID, name);
    // bytes 33..65 of a metadata account are the mint
    assert.equal(base58Encode(Buffer.from(acc.data[0], "base64").subarray(33, 65)), MINTS[name], name);
  }
});

test("findProgramAddress agrees with pump.fun's bonding-curve PDA (known from sol-holders) and returns the bump", () => {
  const [addr, bump] = findProgramAddress([Buffer.from("bonding-curve"), base58Decode("DxYWLXgKJpQmfhTG7ikK6oX6oDhxMhN5wCs5BJekpump")], "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
  assert.equal(addr, "6FrLSW5z5uNP3ovpFYUQCoY5d7sXF1mEMsFvvQdeu8dF");
  assert.ok(bump >= 0 && bump <= 255);
  assert.equal(createProgramAddress([Buffer.from("bonding-curve"), base58Decode("DxYWLXgKJpQmfhTG7ikK6oX6oDhxMhN5wCs5BJekpump"), Buffer.from([bump])], "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), addr);
});

test("findProgramAddress rejects seeds over 32 bytes and bad program ids", () => {
  assert.throws(() => findProgramAddress([Buffer.alloc(33)], METAPLEX_PROGRAM_ID), InvalidInputError);
  assert.throws(() => findProgramAddress([], "nope"), InvalidInputError);
  assert.throws(() => metadataAddress("nope"), InvalidInputError);
});

import test from "node:test";
import assert from "node:assert/strict";
import { decodeMint, decodeMetaplexMetadata, buildTokenMeta, currentTransferFee, epochFromSlot, formatUnits, riskFlags, base58Decode, DecodeError, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, METAPLEX_PROGRAM_ID } from "../src/index.js";
import { fixture, MINTS } from "./helpers.js";

const meta = (name) => { const f = fixture(name); return buildTokenMeta(f.mint, f.result.value[0], f.result.value[1], { slot: f.result.context.slot }); };

test("USDC: classic SPL, live authorities, Metaplex name with NUL padding stripped", () => {
  const m = meta("usdc");
  assert.equal(m.exists, true);
  assert.equal(m.program, "spl-token");
  assert.equal(m.programId, TOKEN_PROGRAM_ID);
  assert.equal(m.decimals, 6);
  assert.equal(m.supply, "9168330668217383");
  assert.equal(m.uiSupply, "9168330668.217383");
  assert.equal(m.mintAuthority, "BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG");
  assert.equal(m.freezeAuthority, "7dGbd2QZcCKcTndnHcTL8q7SMVXAkp688NTQYwrRCrar");
  assert.deepEqual(m.extensionTypes, []);
  assert.equal(m.metadata.source, "metaplex");
  assert.equal(m.metadata.name, "USD Coin");
  assert.equal(m.metadata.symbol, "USDC");
  assert.equal(m.metadata.uri, "");
  assert.equal(m.metaplex.address, "5x38Kp4hvdomTCnCrAny4UtMUt5rQBdB6px2K1Ui45Wq");
  assert.equal(m.metaplex.updateAuthority, "2wmVCSfPxGPjrnMMn7rchp4uaeoTqN39mXFC2zhPdri9");
  assert.equal(m.metaplex.isMutable, true);
  assert.equal(m.metaplex.primarySaleHappened, false);
  assert.equal(m.metaplex.tokenStandard, null, "USDC's metadata predates token standards");
  assert.deepEqual(riskFlags(m), { mintAuthorityActive: true, freezeAuthorityActive: true, metadataMutable: true, hasTransferFee: false, hasPermanentDelegate: false, hasTransferHook: false, nonTransferable: false, defaultAccountsFrozen: false, paused: false });
});

test("BONK: authorities renounced, Fungible token standard, arweave uri", () => {
  const m = meta("bonk");
  assert.equal(m.decimals, 5);
  assert.equal(m.mintAuthority, null);
  assert.equal(m.freezeAuthority, null);
  assert.equal(m.metadata.name, "Bonk");
  assert.equal(m.metadata.uri, "https://arweave.net/QPC6FYdUn-3V8ytFNuoCS85S2tHAuiDblh6u3CIZLsw");
  assert.equal(m.metaplex.tokenStandard, "Fungible");
  assert.equal(m.metaplex.primarySaleHappened, true);
  assert.equal(m.metaplex.sellerFeeBasisPoints, 0);
  assert.equal(m.metaplex.creators, null);
  assert.equal(riskFlags(m).metadataMutable, true);
  assert.equal(riskFlags(m).mintAuthorityActive, false);
});

test("pump.fun (GOAT, classic SPL): immutable Metaplex metadata, nothing flagged", () => {
  const m = meta("pump");
  assert.equal(m.program, "spl-token");
  assert.equal(m.metadata.name, "Goatseus Maximus");
  assert.equal(m.metadata.symbol, "GOAT");
  assert.equal(m.metaplex.isMutable, false);
  assert.equal(m.metaplex.updateAuthority, "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM");
  assert.ok(Object.values(riskFlags(m)).every((v) => v === false));
});

test("PYUSD: Token-2022 with eight extensions decoded or named", () => {
  const m = meta("pyusd");
  assert.equal(m.program, "token-2022");
  assert.equal(m.programId, TOKEN_2022_PROGRAM_ID);
  assert.deepEqual(m.extensionTypes, [3, 12, 1, 4, 16, 14, 18, 19]);
  assert.deepEqual(m.unknownExtensions, []);
  const AUTH = "2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk";
  assert.deepEqual(m.extensions.mintCloseAuthority, { closeAuthority: AUTH });
  assert.deepEqual(m.extensions.permanentDelegate, { delegate: AUTH });
  assert.deepEqual(m.extensions.transferHook, { authority: AUTH, programId: null });
  assert.deepEqual(m.extensions.metadataPointer, { authority: AUTH, metadataAddress: MINTS.pyusd });
  assert.equal(m.extensions.transferFeeConfig.newerTransferFee.transferFeeBasisPoints, 0);
  assert.equal(m.extensions.transferFeeConfig.newerTransferFee.epoch, "605");
  assert.deepEqual(m.extensions.confidentialTransferMint, { decoded: false, size: 65 });
  assert.deepEqual(m.transferFee, { basisPoints: 0, maximumFee: "0", sinceEpoch: "605" });
  assert.equal(m.metadata.source, "token-2022");
  assert.equal(m.metadata.name, "PayPal USD");
  assert.equal(m.metadata.symbol, "PYUSD");
  assert.equal(m.metadata.uri, "https://token-metadata.paxos.com/pyusd_metadata/prod/solana/pyusd_metadata.json");
  assert.equal(m.metadata.isMutable, true);
  const f = riskFlags(m);
  assert.equal(f.hasPermanentDelegate, true);
  assert.equal(f.hasTransferHook, false, "hook extension present but no program set");
  assert.equal(f.hasTransferFee, false, "fee config present at 0 bps");
});

test("pump.fun Token-2022 coin: TokenMetadata extension with no update authority", () => {
  const m = meta("pump2022");
  assert.equal(m.program, "token-2022");
  assert.deepEqual(m.extensionTypes, [18, 19]);
  assert.deepEqual(m.extensions.metadataPointer, { authority: null, metadataAddress: MINTS.pump2022 });
  assert.equal(m.extensions.tokenMetadata.name, "Deed");
  assert.equal(m.extensions.tokenMetadata.symbol, "DEED");
  assert.deepEqual(m.extensions.tokenMetadata.additionalMetadata, []);
  assert.equal(m.metadata.source, "token-2022");
  assert.equal(m.metadata.isMutable, false);
  assert.equal(m.metaplex, null);
  assert.ok(Object.values(riskFlags(m)).every((v) => v === false));
});

// --- synthetic accounts for paths the fixtures do not cover ---------------------------------------------------------
const pk = (n) => Buffer.alloc(32, n);
function mintBase({ mintAuth = null, freeze = null, supply = 1000n, decimals = 2 } = {}) {
  const b = Buffer.alloc(82);
  if (mintAuth) { b.writeUInt32LE(1, 0); mintAuth.copy(b, 4); }
  b.writeBigUInt64LE(supply, 36); b[44] = decimals; b[45] = 1;
  if (freeze) { b.writeUInt32LE(1, 46); freeze.copy(b, 50); }
  return b;
}
const tlv = (type, value) => { const h = Buffer.alloc(4); h.writeUInt16LE(type, 0); h.writeUInt16LE(value.length, 2); return Buffer.concat([h, value]); };
const t22 = (...exts) => Buffer.concat([mintBase(), Buffer.alloc(165 - 82), Buffer.from([1]), ...exts]);
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const feeBytes = (epoch, max, bps) => Buffer.concat([u64(epoch), u64(max), u16(bps)]);
const borshStr = (s, pad = 0) => { const v = Buffer.alloc(Math.max(Buffer.byteLength(s), pad)); v.write(s); const l = Buffer.alloc(4); l.writeUInt32LE(v.length); return Buffer.concat([l, v]); };

test("Token-2022: transfer fee switches from older to newer at its epoch; unknown types listed by number", () => {
  const data = t22(
    tlv(1, Buffer.concat([pk(1), pk(0), u64(5), feeBytes(500, 1000, 50), feeBytes(700, 9000, 250)])),
    tlv(9, Buffer.alloc(0)),
    tlv(6, Buffer.from([2])),
    tlv(10, Buffer.concat([pk(3), i64(1_700_000_000), Buffer.from([0x2c, 0x01]), i64(1_700_000_100), Buffer.from([0xf4, 0x01])])),
    tlv(14, Buffer.concat([pk(4), pk(5)])),
    tlv(99, Buffer.from([1, 2, 3])),
    tlv(26, Buffer.concat([pk(6), Buffer.from([1])])),
  );
  const d = decodeMint(data, TOKEN_2022_PROGRAM_ID);
  assert.deepEqual(d.extensionTypes, [1, 9, 6, 10, 14, 99, 26]);
  assert.deepEqual(d.unknownExtensions, [99]);
  assert.equal(d.extensions.transferFeeConfig.withdrawWithheldAuthority, null, "all-zero key = none");
  assert.equal(d.extensions.transferFeeConfig.withheldAmount, "5");
  assert.deepEqual(currentTransferFee(d.extensions.transferFeeConfig, 699), { basisPoints: 50, maximumFee: "1000", sinceEpoch: "500" });
  assert.deepEqual(currentTransferFee(d.extensions.transferFeeConfig, 700), { basisPoints: 250, maximumFee: "9000", sinceEpoch: "700" });
  assert.deepEqual(d.extensions.nonTransferable, {});
  assert.deepEqual(d.extensions.defaultAccountState, { state: "Frozen" });
  assert.equal(d.extensions.interestBearingConfig.preUpdateAverageRate, 300);
  assert.equal(d.extensions.interestBearingConfig.currentRate, 500);
  assert.equal(d.extensions.interestBearingConfig.lastUpdateTimestamp, 1_700_000_100);
  assert.deepEqual(base58Decode(d.extensions.transferHook.programId), pk(5));
  assert.deepEqual(d.extensions.pausableConfig.paused, true);

  const m = buildTokenMeta("x", { owner: TOKEN_2022_PROGRAM_ID, data: [data.toString("base64"), "base64"] }, null, { slot: 700 * 432_000 });
  assert.equal(m.transferFee.basisPoints, 250, "epoch taken from the slot");
  const f = riskFlags(m);
  assert.deepEqual([f.hasTransferFee, f.hasTransferHook, f.nonTransferable, f.defaultAccountsFrozen, f.paused], [true, true, true, true, true]);
  assert.equal(buildTokenMeta("x", { owner: TOKEN_2022_PROGRAM_ID, data: [data.toString("base64"), "base64"] }, null, { slot: 0, epoch: 600 }).transferFee.basisPoints, 50, "explicit epoch wins");
});

test("Token-2022 TokenMetadata with additional metadata pairs", () => {
  const val = Buffer.concat([pk(0), pk(9), borshStr("Name"), borshStr("SYM"), borshStr("https://x/y.json"), Buffer.from([2, 0, 0, 0]), borshStr("k1"), borshStr("v1"), borshStr("k2"), borshStr("v2")]);
  const d = decodeMint(t22(tlv(19, val)), TOKEN_2022_PROGRAM_ID);
  assert.deepEqual(d.extensions.tokenMetadata.additionalMetadata, [["k1", "v1"], ["k2", "v2"]]);
  assert.equal(d.extensions.tokenMetadata.updateAuthority, null);
});

test("a malformed extension is marked, not fatal; a TLV running past the end is a DecodeError", () => {
  const d = decodeMint(t22(tlv(12, Buffer.alloc(5))), TOKEN_2022_PROGRAM_ID);
  assert.equal(d.extensions.permanentDelegate.decoded, false);
  const bad = t22(tlv(12, pk(1))).subarray(0, -5);
  assert.throws(() => decodeMint(bad, TOKEN_2022_PROGRAM_ID), DecodeError);
  assert.throws(() => decodeMint(Buffer.alloc(40)), DecodeError);
});

test("Metaplex: creators, collection and uses decode; a non-metadata key is rejected", () => {
  const body = Buffer.concat([
    Buffer.from([4]), pk(1), pk(2), borshStr("Coin", 32), borshStr("C", 10), borshStr("https://u", 200), u16(500),
    Buffer.from([1, 2, 0, 0, 0]), pk(3), Buffer.from([1, 60]), pk(4), Buffer.from([0, 40]),
    Buffer.from([1, 0]),                // primary sale happened, immutable
    Buffer.from([1, 254]),              // edition nonce
    Buffer.from([1, 4]),                // ProgrammableNonFungible
    Buffer.from([1, 1]), pk(5),         // verified collection
    Buffer.from([1, 0]), u64(1), u64(3) // uses: Burn, 1 of 3
  ]);
  const md = decodeMetaplexMetadata(body);
  assert.equal(md.name, "Coin");
  assert.equal(md.uri, "https://u");
  assert.equal(md.sellerFeeBasisPoints, 500);
  assert.equal(md.creators.length, 2);
  assert.equal(md.creators[0].verified, true);
  assert.equal(md.creators[0].share, 60);
  assert.equal(md.creators[1].verified, false);
  assert.deepEqual([md.primarySaleHappened, md.isMutable, md.editionNonce, md.tokenStandard], [true, false, 254, "ProgrammableNonFungible"]);
  assert.equal(md.collection.verified, true);
  assert.deepEqual(md.uses, { useMethod: "Burn", remaining: "1", total: "3" });
  // An old account that ends right after isMutable still decodes.
  const old = decodeMetaplexMetadata(body.subarray(0, body.length - (2 + 2 + 34 + 18)));
  assert.equal(old.tokenStandard, null);
  assert.throws(() => decodeMetaplexMetadata(Buffer.from([1, 2, 3])), DecodeError);
});

test("buildTokenMeta: missing account, non-token owner, Metaplex account for another mint ignored", () => {
  assert.equal(buildTokenMeta("m", null).exists, false);
  assert.equal(buildTokenMeta("m", null).reason, "no account at this address");
  const notToken = buildTokenMeta("m", { owner: "11111111111111111111111111111111", data: ["", "base64"] });
  assert.match(notToken.reason, /not a token mint/);
  const f = fixture("usdc");
  const m = buildTokenMeta(MINTS.bonk, fixture("bonk").result.value[0], f.result.value[1]);
  assert.equal(m.metaplex, null, "USDC's metadata must not be attached to BONK");
  assert.equal(f.result.value[1].owner, METAPLEX_PROGRAM_ID);
});

test("classic mint data is never read for extensions; formatUnits is exact; epochs are 432,000 slots", () => {
  const d = decodeMint(mintBase({ mintAuth: pk(7), supply: 18446744073709551615n, decimals: 9 }), TOKEN_PROGRAM_ID);
  assert.equal(d.supply, "18446744073709551615");
  assert.equal(formatUnits(d.supply, 9), "18446744073.709551615");
  assert.equal(formatUnits("1000000", 6), "1");
  assert.equal(formatUnits("5", 6), "0.000005");
  assert.equal(formatUnits("0", 0), "0");
  assert.equal(epochFromSlot(470678581), 1089);
});

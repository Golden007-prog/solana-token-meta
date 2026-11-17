// solana-token-meta: everything about a Solana token mint from one getMultipleAccounts call. Program (SPL Token or
// Token-2022), decimals, supply, authorities, Token-2022 extensions and Metaplex metadata. Zero dependencies. Node 20+.
//
// A small, open piece of what powers Blix (https://blixvip.com), the Solana memecoin terminal.
import { rpc, PUBLIC_RPC } from "./rpc.js";
import { base58Encode, base58Decode, isOnCurve, isAddress, findProgramAddress, createProgramAddress } from "./solana.js";
import { decodeMint, currentTransferFee, epochFromSlot, EXTENSION_NAMES, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, SLOTS_PER_EPOCH } from "./token.js";
import { decodeMetaplexMetadata, metadataAddress, METAPLEX_PROGRAM_ID, TOKEN_STANDARDS } from "./metaplex.js";
import { fetchOffchainJson, resolveUri, pickOffchainFields } from "./offchain.js";
import { TokenMetaError, InvalidInputError, RpcError, RpcTimeoutError, DecodeError } from "./errors.js";

export {
  PUBLIC_RPC, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, METAPLEX_PROGRAM_ID, EXTENSION_NAMES, TOKEN_STANDARDS, SLOTS_PER_EPOCH,
  base58Encode, base58Decode, isOnCurve, isAddress, findProgramAddress, createProgramAddress,
  decodeMint, decodeMetaplexMetadata, metadataAddress, currentTransferFee, epochFromSlot,
  fetchOffchainJson, resolveUri, pickOffchainFields,
  TokenMetaError, InvalidInputError, RpcError, RpcTimeoutError, DecodeError,
};

const MAX_ACCOUNTS_PER_CALL = 100;   // getMultipleAccounts limit
const PROGRAMS = { [TOKEN_PROGRAM_ID]: "spl-token", [TOKEN_2022_PROGRAM_ID]: "token-2022" };

/** Raw integer amount (string) to a decimal string, exactly. formatUnits("1234500", 6) === "1.2345". */
export function formatUnits(raw, decimals) {
  const s = BigInt(raw).toString().padStart(decimals + 1, "0");
  if (!decimals) return s;
  const whole = s.slice(0, -decimals), frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * Build a TokenMeta from the two raw accounts (as returned by getMultipleAccounts with base64 encoding).
 * Pure: no network. Useful when you already have the accounts from your own RPC calls or a websocket.
 * @param {string} mint
 * @param {{ owner: string, data: [string, string] } | null} mintAccount
 * @param {{ owner: string, data: [string, string] } | null} [metadataAccount] the Metaplex metadata PDA account
 * @param {{ slot?: number|null, epoch?: number|null }} [ctx]
 */
export function buildTokenMeta(mint, mintAccount, metadataAccount = null, { slot = null, epoch = null } = {}) {
  const base = {
    mint, exists: false, reason: null, slot,
    program: null, programId: null,
    decimals: null, supply: null, uiSupply: null,
    mintAuthority: null, freezeAuthority: null, isInitialized: null,
    extensionTypes: [], extensions: {}, unknownExtensions: [],
    transferFee: null,
    metadata: null, metaplex: null,
  };
  if (!mintAccount) return { ...base, reason: "no account at this address" };
  const program = PROGRAMS[mintAccount.owner];
  if (!program) return { ...base, reason: `not a token mint: the account is owned by ${mintAccount.owner}` };
  let m;
  try { m = decodeMint(mintAccount.data[0], mintAccount.owner); }
  catch (e) { return { ...base, program, programId: mintAccount.owner, reason: `not a mint account: ${e.message}` }; }
  const out = { ...base, exists: true, program, programId: mintAccount.owner, ...m, uiSupply: formatUnits(m.supply, m.decimals) };
  const ep = epoch ?? (slot != null ? epochFromSlot(slot) : null);
  out.transferFee = currentTransferFee(m.extensions.transferFeeConfig, ep);

  if (metadataAccount && metadataAccount.owner === METAPLEX_PROGRAM_ID) {
    try {
      const md = decodeMetaplexMetadata(metadataAccount.data[0]);
      if (md.mint === mint) out.metaplex = { address: metadataAddress(mint), ...md };
    } catch { /* not decodable: leave metaplex null */ }
  }
  const tm = m.extensions.tokenMetadata, ptr = m.extensions.metadataPointer;
  const tmUsable = tm && tm.decoded !== false;
  const pointsHere = !ptr || ptr.metadataAddress === mint || ptr.metadataAddress == null;
  if (tmUsable && (pointsHere || !out.metaplex)) {
    out.metadata = { source: "token-2022", name: tm.name, symbol: tm.symbol, uri: tm.uri, updateAuthority: tm.updateAuthority, isMutable: tm.updateAuthority !== null, additionalMetadata: tm.additionalMetadata };
  } else if (out.metaplex) {
    const md = out.metaplex;
    out.metadata = { source: "metaplex", name: md.name, symbol: md.symbol, uri: md.uri, updateAuthority: md.updateAuthority, isMutable: md.isMutable, additionalMetadata: [] };
  }
  return out;
}

/**
 * Facts that matter when judging a token, as booleans. No scores, no opinions.
 * @param {ReturnType<typeof buildTokenMeta>} meta
 */
export function riskFlags(meta) {
  const x = meta?.extensions || {};
  return {
    mintAuthorityActive: meta?.mintAuthority != null,
    freezeAuthorityActive: meta?.freezeAuthority != null,
    metadataMutable: meta?.metadata ? meta.metadata.isMutable : null,
    hasTransferFee: (meta?.transferFee?.basisPoints ?? 0) > 0,
    hasPermanentDelegate: x.permanentDelegate?.delegate != null,
    hasTransferHook: x.transferHook?.programId != null,
    nonTransferable: "nonTransferable" in x,
    defaultAccountsFrozen: x.defaultAccountState?.state === "Frozen",
    paused: x.pausableConfig?.paused === true,
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

/**
 * Read many mints. getMultipleAccounts with [mint, Metaplex PDA] pairs, 100 addresses per call (50 mints), calls in sequence.
 * @param {string[]} mints
 * @param {import("../index").TokenMetaOptions} [opts]
 */
export async function getTokenMetas(mints, opts = {}) {
  if (!Array.isArray(mints)) throw new InvalidInputError("mints must be an array of addresses");
  const { rpcUrl = process.env.SOLANA_RPC_URL || PUBLIC_RPC, commitment = "confirmed", metaplex = true, epoch = null, fetchJson = false, uriTimeoutMs = 5_000, uriMaxBytes = 256 * 1024, ipfsGateway, arweaveGateway, fetch: fetchFn, timeoutMs } = opts;
  for (const m of mints) if (!isAddress(m)) throw new InvalidInputError(`not a Solana address: ${JSON.stringify(m)}`);
  if (!mints.length) return [];
  const per = metaplex ? 2 : 1;
  const addrs = mints.flatMap((m) => (metaplex ? [m, metadataAddress(m)] : [m]));
  const accounts = [], slots = [];
  for (let i = 0; i < addrs.length; i += MAX_ACCOUNTS_PER_CALL) {
    const chunk = addrs.slice(i, i + MAX_ACCOUNTS_PER_CALL);
    const r = await rpc(rpcUrl, "getMultipleAccounts", [chunk, { encoding: "base64", commitment }], { fetch: fetchFn, timeoutMs });
    if (!r || !Array.isArray(r.value) || r.value.length !== chunk.length) throw new RpcError("getMultipleAccounts: unexpected answer shape");
    for (const a of r.value) { accounts.push(a); slots.push(r.context?.slot ?? null); }
  }
  const metas = mints.map((m, i) => buildTokenMeta(m, accounts[i * per], metaplex ? accounts[i * per + 1] : null, { slot: slots[i * per], epoch }));
  if (fetchJson) {
    const net = { fetch: fetchFn, timeoutMs: uriTimeoutMs, maxBytes: uriMaxBytes, ...(ipfsGateway && { ipfsGateway }), ...(arweaveGateway && { arweaveGateway }) };
    await mapLimit(metas, 4, async (meta) => { if (meta.metadata) meta.offchain = await fetchOffchainJson(meta.metadata.uri, net); else meta.offchain = null; });
  }
  return metas;
}

/**
 * Read one mint: one getMultipleAccounts call (mint + Metaplex metadata PDA), plus one HTTP GET with `fetchJson: true`.
 * @param {string} mint
 * @param {import("../index").TokenMetaOptions} [opts]
 */
export async function getTokenMeta(mint, opts = {}) {
  if (!isAddress(mint)) throw new InvalidInputError(`not a Solana address: ${JSON.stringify(mint)}`);
  return (await getTokenMetas([mint], opts))[0];
}

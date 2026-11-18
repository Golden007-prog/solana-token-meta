#!/usr/bin/env node
// solana-token-meta <mint...> [--json] [--uri] [--rpc <url>]
import { getTokenMetas, riskFlags, PUBLIC_RPC, TokenMetaError } from "../src/index.js";

function parseArgs(args) {
  const options = { mints: [], json: false, uri: false, help: false, rpcUrl: process.env.SOLANA_RPC_URL || PUBLIC_RPC };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--uri") options.uri = true;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "--rpc") {
      const value = args[++i];
      if (!value || value.startsWith("-")) throw new Error("--rpc requires a URL");
      if (!URL.canParse(value) || !["http:", "https:"].includes(new URL(value).protocol)) {
        throw new Error("--rpc must be an HTTP(S) URL");
      }
      options.rpcUrl = value;
    } else if (arg.startsWith("--")) throw new Error(`unknown option: ${arg}`);
    else options.mints.push(arg);
  }
  return options;
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const { mints, json, uri, help, rpcUrl } = options;
if (help || !mints.length) {
  console.log(`solana-token-meta: everything about a Solana token mint, from one RPC call

  solana-token-meta <mint...>          program, decimals, supply, authorities, extensions, metadata, risk flags
  solana-token-meta <mint...> --uri    also fetch the off-chain JSON (image, description, socials)
  solana-token-meta <mint...> --json   the raw result

  --rpc <url> or SOLANA_RPC_URL        your RPC (default: ${PUBLIC_RPC}, rate limited)

  Made by Blix, the Solana memecoin terminal: https://blixvip.com   Discord: https://discord.gg/grokbot`);
  process.exit(help ? 0 : 1);
}

const short = (a) => (a ? `${a}` : "none");
try {
  const metas = await getTokenMetas(mints, { rpcUrl, fetchJson: uri });
  if (json) console.log(JSON.stringify(metas.map((m) => ({ ...m, riskFlags: m.exists ? riskFlags(m) : null })), null, 2));
  else for (const m of metas) {
    console.log(m.mint);
    if (!m.exists) { console.log(`  ${m.reason}\n`); continue; }
    const md = m.metadata;
    if (md) console.log(`  ${md.name || "(no name)"} (${md.symbol || "?"})  metadata: ${md.source}${md.isMutable ? ", mutable" : ", immutable"}`);
    else console.log("  no metadata found (no TokenMetadata extension, no Metaplex account)");
    console.log(`  program          ${m.program}`);
    console.log(`  decimals         ${m.decimals}`);
    console.log(`  supply           ${m.uiSupply}`);
    console.log(`  mint authority   ${m.mintAuthority ? m.mintAuthority : "none (renounced)"}`);
    console.log(`  freeze authority ${m.freezeAuthority ? m.freezeAuthority : "none (renounced)"}`);
    if (md?.uri) console.log(`  uri              ${md.uri}`);
    if (m.metaplex) console.log(`  metaplex         update authority ${m.metaplex.updateAuthority}, seller fee ${m.metaplex.sellerFeeBasisPoints} bps${m.metaplex.tokenStandard ? `, ${m.metaplex.tokenStandard}` : ""}${m.metaplex.creators ? `, ${m.metaplex.creators.length} creator(s)` : ""}`);
    const ext = Object.keys(m.extensions);
    if (ext.length || m.unknownExtensions.length) console.log(`  extensions       ${[...ext, ...m.unknownExtensions.map((t) => `unknown(${t})`)].join(", ")}`);
    if (m.transferFee) console.log(`  transfer fee     ${m.transferFee.basisPoints} bps, max ${m.transferFee.maximumFee} raw units`);
    if (m.extensions.permanentDelegate) console.log(`  perm. delegate   ${short(m.extensions.permanentDelegate.delegate)}`);
    if (m.extensions.transferHook) console.log(`  transfer hook    ${short(m.extensions.transferHook.programId)}`);
    const f = riskFlags(m);
    const on = Object.entries(f).filter(([, v]) => v === true).map(([k]) => k);
    console.log(`  flags            ${on.length ? on.join(", ") : "none"}`);
    if (m.offchain) {
      if (m.offchain.ok) for (const k of ["description", "image", "website", "twitter", "telegram", "discord"]) { if (m.offchain[k]) console.log(`  ${k.padEnd(16)} ${String(m.offchain[k]).replace(/\s+/g, " ").slice(0, 160)}`); }
      else console.log(`  off-chain json   unavailable: ${m.offchain.error}`);
    }
    console.log("");
  }
} catch (e) {
  console.error(e instanceof TokenMetaError ? e.message : `unexpected error: ${e?.message || e}`);
  process.exitCode = 1;
}

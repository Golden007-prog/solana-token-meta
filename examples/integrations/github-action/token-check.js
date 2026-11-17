// Fail a CI job when a Solana token has powers you do not accept: a live mint or freeze authority, a permanent
// delegate, a transfer fee or hook, paused transfers, frozen-by-default accounts.
//
//   node examples/integrations/github-action/token-check.js <mint...> [--allow flag,flag]
//
// Exit code 0 when every mint passes, 1 when any fails or does not exist, 2 on bad usage or an RPC failure.
// Inside GitHub Actions it also writes a table to the job summary ($GITHUB_STEP_SUMMARY).
import { appendFileSync } from "node:fs";
import { getTokenMetas, riskFlags } from "solana-token-meta";

// Flags that fail the check unless --allow names them. metadataMutable is reported but never fails on its own.
const FAIL_ON = ["mintAuthorityActive", "freezeAuthorityActive", "hasPermanentDelegate", "hasTransferFee", "hasTransferHook", "paused", "defaultAccountsFrozen", "nonTransferable"];

const args = process.argv.slice(2);
const allowAt = args.indexOf("--allow");
const allow = new Set(allowAt >= 0 ? (args.splice(allowAt, 2)[1] || "").split(",").map((s) => s.trim()) : []);
const mints = args.flatMap((a) => a.split(/[\s,]+/)).filter(Boolean);
if (!mints.length) {
  console.error("usage: node token-check.js <mint...> [--allow mintAuthorityActive,freezeAuthorityActive]");
  process.exit(2);
}
for (const a of allow) if (!FAIL_ON.includes(a)) { console.error(`unknown flag in --allow: ${a} (known: ${FAIL_ON.join(", ")})`); process.exit(2); }

// After a network call, set process.exitCode instead of calling process.exit(): exiting while fetch's sockets are
// still closing can crash Node on Windows (a libuv assertion, exit code 127).
let metas = [];
try {
  metas = await getTokenMetas(mints); // reads SOLANA_RPC_URL, else the public RPC
} catch (e) {
  console.error(`${e.name}: ${e.message}`);
  process.exitCode = 2;
}

const rows = [];
let failed = 0;
for (const m of metas) {
  const name = m.metadata ? `${m.metadata.name} (${m.metadata.symbol})` : "";
  if (!m.exists) { failed++; rows.push({ mint: m.mint, name, ok: false, why: m.reason }); continue; }
  const f = riskFlags(m);
  const bad = FAIL_ON.filter((k) => f[k] && !allow.has(k));
  const note = f.metadataMutable ? " (metadata mutable)" : "";
  if (bad.length) failed++;
  rows.push({ mint: m.mint, name, ok: !bad.length, why: (bad.join(", ") || "no flagged powers") + note });
}

if (rows.length) {
  for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.mint}  ${r.name}  ${r.why}`);
  console.log(`\n${rows.length - failed} of ${rows.length} passed${allow.size ? ` (allowed: ${[...allow].join(", ")})` : ""}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = ["### Token check", "", "| | Mint | Token | Result |", "|---|---|---|---|",
      ...rows.map((r) => `| ${r.ok ? "✅" : "❌"} | \`${r.mint}\` | ${r.name.replace(/\|/g, "\\|")} | ${r.why} |`), ""].join("\n");
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
  }
  process.exitCode = failed ? 1 : 0;
}

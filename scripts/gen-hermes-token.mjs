// Gera o token do squad Hermes (mesmo formato de src/lib/ai/tokens.ts),
// grava o token CRU direto no .env do Hermes, e imprime APENAS o hash
// (o hash nao serve como token). O agente em si e inserido no banco via
// Supabase MCP usando o hash impresso. Token cru nunca aparece no chat.
//   node scripts/gen-hermes-token.mjs
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const AGENT_ID = "hermes-squad";
const HERMES_ENV = "C:\\Users\\barao\\AppData\\Local\\hermes\\.env";

const raw = `zmb_${AGENT_ID}_${randomBytes(24).toString("hex")}`;
const hash = createHash("sha256").update(raw.trim()).digest("hex");

const lines = existsSync(HERMES_ENV)
  ? readFileSync(HERMES_ENV, "utf8").replace(/\r\n/g, "\n").split("\n")
  : [];
const idx = lines.findIndex((l) => l.startsWith("ZIMBANET_AGENT_TOKEN="));
const entry = `ZIMBANET_AGENT_TOKEN=${raw}`;
if (idx >= 0) lines[idx] = entry;
else {
  if (lines.length && lines[lines.length - 1] !== "") lines.push("");
  lines.push(entry);
}
writeFileSync(HERMES_ENV, lines.join("\n").replace(/\n+$/, "\n"), "utf8");

console.log("TOKEN_HASH=" + hash);
console.log("OK: token cru gravado em " + HERMES_ENV + " (ZIMBANET_AGENT_TOKEN). Nao impresso.");

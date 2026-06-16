// rodar com: npx tsx src/lib/ai/tokens.test.ts
import assert from "node:assert";
import { generateToken, hashToken, verifyToken } from "./tokens";

const { raw, hash } = generateToken("editor_ia");
assert.ok(raw.startsWith("zmb_editor_ia_"), "token tem prefixo do agente");
assert.equal(hash, hashToken(raw), "hash é determinístico");
assert.equal(verifyToken(raw, hash), true, "verifica token certo");
assert.equal(verifyToken("zmb_errado", hash), false, "rejeita token errado");
console.log("tokens.test OK");

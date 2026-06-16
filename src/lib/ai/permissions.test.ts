// rodar com: npx tsx src/lib/ai/permissions.test.ts
import assert from "node:assert";
import { checkPermission, type AgentPermissions } from "./permissions";

const editor: AgentPermissions = { read: ["articles", "drafts"], write: ["article_content"] };
assert.equal(checkPermission(editor, "read", "articles"), true);
assert.equal(checkPermission(editor, "write", "article_content"), true);
assert.equal(checkPermission(editor, "write", "homepage"), false, "nega fora do escopo");

const director: AgentPermissions = { read: ["all"], write: [] };
assert.equal(checkPermission(director, "read", "qualquer_coisa"), true, "'all' libera leitura");
assert.equal(checkPermission(director, "write", "articles"), false, "write vazio nega");
console.log("permissions.test OK");

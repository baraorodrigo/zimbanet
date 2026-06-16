// rodar com: npx tsx scripts/seed-agent.ts
// Cria/atualiza um agente e imprime o token cru UMA vez (guardar no Hermes).
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken } from "@/lib/ai/tokens";

async function main() {
  const id = process.argv[2] ?? "ping_test";
  const { raw, hash } = generateToken(id);
  const sb = createAdminClient();
  const { error } = await sb.from("agents").upsert(
    {
      id,
      name: id,
      type: "director",
      token_hash: hash,
      permissions: { read: ["all"], write: [] },
      rate_limit_per_hour: 120,
      active: true,
      revoked_at: null,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
  console.log("AGENT:", id);
  console.log("TOKEN (guarde — só aparece aqui):", raw);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

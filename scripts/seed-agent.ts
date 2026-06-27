// rodar com: npx tsx scripts/seed-agent.ts <id> <preset>
// Cria/atualiza um agente e imprime o token cru UMA vez (guardar no Hermes).
// preset (default 'publisher') vem de AGENT_PRESETS — assim o agente nasce com
// os escopos que as rotas exigem (publish/homepage/community/bazar). Sem isso
// os agentes davam 403 nessas tools.
// ATENÇÃO: re-rodar com um id existente ROTACIONA o token (upsert sobrescreve o
// hash). Pra só ajustar permissões de um agente vivo sem invalidar o token,
// faça UPDATE em agents.permissions direto.
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken } from "@/lib/ai/tokens";
import { AGENT_PRESETS } from "@/lib/ai/agent-presets";

async function main() {
  const id = process.argv[2] ?? "ping_test";
  const presetName = process.argv[3] ?? "publisher";
  const preset = AGENT_PRESETS[presetName];
  if (!preset) {
    console.error(
      `preset desconhecido: '${presetName}'. Use: ${Object.keys(AGENT_PRESETS).join(", ")}`,
    );
    process.exit(1);
  }
  const { raw, hash } = generateToken(id);
  const sb = createAdminClient();
  const { error } = await sb.from("agents").upsert(
    {
      id,
      name: id,
      type: preset.type,
      token_hash: hash,
      permissions: preset.permissions,
      rate_limit_per_hour: 1000,
      active: true,
      revoked_at: null,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
  console.log("AGENT:", id, "| preset:", presetName);
  console.log("TOKEN (guarde — só aparece aqui):", raw);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

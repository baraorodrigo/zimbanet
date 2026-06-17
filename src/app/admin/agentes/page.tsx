import { Header } from "../_components/header";
import { listAgents, setAgentRevoked, deleteAgent, type AgentSummary } from "@/lib/actions/agents";
import { CreateAgentForm } from "./create-form";

export const dynamic = "force-dynamic";

export default async function AgentesPage() {
  const agents = await listAgents();
  return (
    <>
      <Header
        kicker="Painel"
        title="Agentes de IA"
        sub="Crie os tokens que o Hermes usa pra falar com o Zimbanet. O token aparece UMA vez — copie e cole na config do Hermes. Pode revogar a qualquer momento; o agente perde o acesso na hora."
      />

      <section className="mt-8">
        <CreateAgentForm />
      </section>

      <section className="mt-10">
        <p className="font-display font-black text-fs-16 text-navy mb-3">
          Agentes cadastrados ({agents.length})
        </p>
        {agents.length === 0 ? (
          <div className="rounded-md border-2 border-dashed border-border-subtle bg-white p-8 text-center text-fs-14 text-ink-500">
            Nenhum agente ainda. Crie o primeiro acima.
          </div>
        ) : (
          <ul className="grid gap-3">
            {agents.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function AgentCard({ agent }: { agent: AgentSummary }) {
  const revoked = !!agent.revoked_at || !agent.active;
  return (
    <li className="rounded-md border-2 border-border-subtle bg-white p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display font-black text-fs-16 text-navy">{agent.name}</span>
          <code className="font-mono text-fs-12 text-ink-500">{agent.id}</code>
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-0.5 bg-off-white text-ink-700">
            {agent.type}
          </span>
          {revoked ? (
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-0.5 bg-alert-red/10 text-alert-red border border-alert-red/40">
              revogado
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold rounded px-2 py-0.5 bg-eco-green/10 text-eco-green border border-eco-green/40">
              ativo
            </span>
          )}
        </div>
        <p className="mt-1 text-fs-12 text-ink-400">
          {agent.rate_limit_per_hour}/h ·{" "}
          {agent.last_used_at
            ? `último uso ${new Date(agent.last_used_at).toLocaleString("pt-BR")}`
            : "nunca usado"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <form action={setAgentRevoked}>
          <input type="hidden" name="id" value={agent.id} />
          <input type="hidden" name="revoke" value={revoked ? "0" : "1"} />
          <button
            type="submit"
            className="h-9 px-3 rounded-md border-2 border-zimba-gold/40 text-navy font-display font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-zimba-gold hover:border-zimba-gold transition-colors"
          >
            {revoked ? "Reativar" : "Revogar"}
          </button>
        </form>
        <form action={deleteAgent}>
          <input type="hidden" name="id" value={agent.id} />
          <button
            type="submit"
            className="h-9 px-3 rounded-md border-2 border-alert-red/30 text-alert-red font-display font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-alert-red hover:text-white transition-colors"
            title="Apaga o agente e seu histórico"
          >
            Apagar
          </button>
        </form>
      </div>
    </li>
  );
}

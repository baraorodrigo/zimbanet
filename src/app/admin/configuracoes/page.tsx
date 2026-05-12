// Configurações — admin escolhe modelo + chave por slot de tarefa
// (text_main, text_fast, image, video). Persiste em app_settings;
// resolve.ts lê dali a cada chamada (sem restart).

import { Header } from "../_components/header";
import { listSlotsConfig, saveSlotConfig, type SlotConfig } from "@/lib/actions/settings";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const slots = await listSlotsConfig();
  return (
    <>
      <Header
        kicker="Painel"
        title="Configurações de IA"
        sub="Cada slot é uma tarefa do Estúdio. Escolha qual modelo usar e cole a chave do provider correspondente. Se o modelo não estiver entregando, troque por outro aqui — vale na próxima chamada, sem deploy."
      />

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        {slots.map((slot) => (
          <SlotCard key={slot.slot} slot={slot} />
        ))}
      </section>

      <section className="mt-10 rounded-md border-2 border-dashed border-border-subtle bg-white p-5">
        <p className="font-display font-black text-fs-16 text-navy">Como funciona</p>
        <ul className="mt-3 space-y-1.5 text-fs-13 text-ink-700 list-disc pl-5">
          <li>
            Cada slot guarda <em>2 valores</em>: o modelo escolhido e a chave do
            provider daquele modelo. Os dois ficam em <code className="font-mono">app_settings</code>.
          </li>
          <li>
            Trocar de modelo dentro do mesmo provider mantém a chave atual. Trocar de
            provider, você precisa colar a chave nova.
          </li>
          <li>
            O Estúdio lê do banco a cada chamada — rotação imediata, zero restart.
          </li>
          <li>
            <strong>Limpar chave</strong> mantém a escolha de modelo mas cai pro
            valor em <code className="font-mono">.env.local</code> (fallback de dev).
          </li>
          <li>
            A tabela <code className="font-mono">app_settings</code> tem RLS sem
            policies — só o servidor (service_role) lê/escreve.
          </li>
        </ul>
      </section>
    </>
  );
}

function SlotCard({ slot }: { slot: SlotConfig }) {
  const hasOptions = slot.options.length > 0;
  const configured = slot.selectedModelId && slot.hasKey;
  const partial = slot.selectedModelId && !slot.hasKey;

  return (
    <article className="rounded-md border-2 border-border-subtle bg-white p-5 flex flex-col">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold">
            Slot · {slot.slot}
          </p>
          <h2 className="font-display font-black text-fs-20 text-navy mt-0.5">
            {slot.label}
          </h2>
        </div>
        <StatusPill configured={!!configured} partial={!!partial} empty={!hasOptions} />
      </header>

      <p className="mt-2 text-fs-13 text-ink-700 max-w-[60ch]">
        {slot.description}
      </p>

      {!hasOptions ? (
        <div className="mt-4 rounded-md bg-off-white p-4 text-fs-13 text-ink-500">
          Sem provider implementado pra esse slot ainda — adiciona em{" "}
          <code className="font-mono">src/lib/ai/catalog.ts</code>.
        </div>
      ) : (
        <form action={saveSlotConfig} className="mt-4 grid gap-3 flex-1">
          <input type="hidden" name="slot" value={slot.slot} />
          <input type="hidden" name="action" value="save" />

          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mb-1">
              Modelo
            </span>
            <select
              name="model"
              required
              defaultValue={slot.selectedModelId ?? ""}
              className="w-full h-11 px-3 rounded-md border-2 border-border-subtle font-mono text-fs-13 focus:outline-none focus:border-navy bg-off-white"
            >
              <option value="" disabled>
                Selecione um modelo…
              </option>
              {slot.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mb-1">
              <span>Chave do provider</span>
              {slot.selectedKeyHint && (
                <span className="text-ink-400 normal-case tracking-normal font-normal text-fs-11">
                  formato: <span className="font-mono">{slot.selectedKeyHint}</span>
                </span>
              )}
            </span>
            <input
              type="password"
              name="key"
              placeholder={
                slot.hasKey
                  ? `Atual: ${slot.maskedKey ?? "—"} — deixa vazio pra manter`
                  : slot.selectedKeyHint ?? "Cola a chave do provider escolhido"
              }
              autoComplete="off"
              className="w-full h-11 px-3 rounded-md border-2 border-border-subtle font-mono text-fs-13 focus:outline-none focus:border-navy bg-off-white"
            />
            {slot.updatedAt && (
              <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-400 mt-1">
                Atualizada {new Date(slot.updatedAt).toLocaleString("pt-BR")}
              </span>
            )}
          </label>

          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button
              type="submit"
              className="h-10 px-5 rounded-md bg-navy text-zimba-gold font-display font-bold text-[11px] uppercase tracking-[0.22em] hover:bg-zimba-gold hover:text-navy transition-colors"
            >
              Salvar
            </button>
            {slot.hasKey && <ClearKeyButton slot={slot.slot} />}
            {(slot.selectedModelId || slot.hasKey) && <ClearAllButton slot={slot.slot} />}
            {slot.selectedKeyUrl && (
              <a
                href={slot.selectedKeyUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-fs-12 font-bold text-zimba-blue hover:text-navy underline-offset-2 hover:underline ml-auto"
              >
                Gerar chave →
              </a>
            )}
          </div>
        </form>
      )}
    </article>
  );
}

function StatusPill({
  configured,
  partial,
  empty,
}: {
  configured: boolean;
  partial: boolean;
  empty: boolean;
}) {
  if (empty) {
    return (
      <span className="text-[10px] uppercase tracking-[0.22em] font-bold rounded px-2 py-1 bg-ink-100 text-ink-500">
        Em breve
      </span>
    );
  }
  if (configured) {
    return (
      <span className="text-[10px] uppercase tracking-[0.22em] font-bold rounded px-2 py-1 bg-eco-green/10 text-eco-green border border-eco-green/40">
        Pronto
      </span>
    );
  }
  if (partial) {
    return (
      <span className="text-[10px] uppercase tracking-[0.22em] font-bold rounded px-2 py-1 bg-zimba-gold/15 text-navy border border-zimba-gold">
        Falta chave
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-[0.22em] font-bold rounded px-2 py-1 bg-ink-100 text-ink-500">
      Não configurado
    </span>
  );
}

function ClearKeyButton({ slot }: { slot: string }) {
  return (
    <form action={saveSlotConfig} className="inline">
      <input type="hidden" name="slot" value={slot} />
      <input type="hidden" name="action" value="clear_key" />
      <button
        type="submit"
        className="h-10 px-4 rounded-md border-2 border-zimba-gold/40 text-navy font-display font-bold text-[11px] uppercase tracking-[0.22em] hover:bg-zimba-gold hover:border-zimba-gold transition-colors"
        title="Mantém o modelo escolhido mas apaga a chave — cai pra env"
      >
        Limpar chave
      </button>
    </form>
  );
}

function ClearAllButton({ slot }: { slot: string }) {
  return (
    <form action={saveSlotConfig} className="inline">
      <input type="hidden" name="slot" value={slot} />
      <input type="hidden" name="action" value="clear" />
      <button
        type="submit"
        className="h-10 px-4 rounded-md border-2 border-alert-red/30 text-alert-red font-display font-bold text-[11px] uppercase tracking-[0.22em] hover:bg-alert-red hover:text-white transition-colors"
        title="Apaga modelo e chave do slot"
      >
        Resetar slot
      </button>
    </form>
  );
}

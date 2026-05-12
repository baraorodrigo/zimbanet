import Link from "next/link";
import { Header } from "../_components/header";
import { listAllTickerMessages } from "@/lib/db/ticker";
import {
  createTickerMessage,
  updateTickerMessage,
  toggleTickerMessage,
  deleteTickerMessage,
} from "@/lib/actions/ticker";

export const dynamic = "force-dynamic";

type SP = { ok?: string; erro?: string; editar?: string };

export default async function TickerAdminPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const items = await listAllTickerMessages();
  const editing = searchParams.editar
    ? items.find((m) => m.id === searchParams.editar) ?? null
    : null;
  const active = items.filter((m) => m.is_active);

  return (
    <>
      <Header
        kicker="Portal"
        title="Ticker (barra vermelha)"
        sub={`${active.length} mensagem${active.length === 1 ? "" : "ns"} ativa${active.length === 1 ? "" : "s"}. Quando há ativas, o ticker mostra só elas; quando vazio, cai automático nas últimas matérias do dia.`}
      />

      {searchParams.ok && (
        <div className="mt-6 rounded-md border border-eco-green/30 bg-eco-green/10 px-4 py-3 text-fs-13 text-eco-green">
          Salvo ✓
        </div>
      )}
      {searchParams.erro && (
        <div className="mt-6 rounded-md border border-alert-red/30 bg-alert-red/10 px-4 py-3 text-fs-13 text-alert-red">
          {searchParams.erro}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Lista */}
        <section>
          <h2 className="font-display font-bold text-fs-18 text-navy mb-4">
            Mensagens ({items.length})
          </h2>

          {items.length === 0 ? (
            <div className="rounded-md border border-border-subtle bg-white p-10 text-center">
              <p className="font-display font-black text-fs-18 text-navy">
                Nenhuma mensagem ainda
              </p>
              <p className="mt-1 text-fs-13 text-ink-500 max-w-[44ch] mx-auto">
                Cadastra a primeira aí ao lado. Enquanto não tiver nenhuma ativa,
                o ticker mostra as matérias publicadas no dia.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-md border bg-white p-4 ${
                    m.is_active ? "border-navy/30" : "border-border-subtle opacity-70"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        {m.kicker && (
                          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zimba-gold">
                            {m.kicker}
                          </span>
                        )}
                        <span
                          className={`text-[10px] uppercase tracking-[0.18em] font-bold ${
                            m.is_active ? "text-eco-green" : "text-ink-400"
                          }`}
                        >
                          {m.is_active ? "● ativa" : "○ pausada"}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-ink-400">
                          ordem {m.sort_order}
                        </span>
                      </div>
                      <p className="font-display text-fs-15 text-navy leading-snug">
                        {m.text}
                      </p>
                      {m.link && (
                        <p className="mt-1 text-fs-12 text-zimba-blue truncate">
                          → {m.link}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <form action={toggleTickerMessage}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          className="text-[10px] uppercase tracking-[0.18em] font-bold px-3 h-8 border border-navy/30 hover:bg-navy hover:text-off-white rounded-sm transition-colors"
                        >
                          {m.is_active ? "Pausar" : "Ativar"}
                        </button>
                      </form>
                      <Link
                        href={`/admin/ticker?editar=${m.id}`}
                        className="text-[10px] uppercase tracking-[0.18em] font-bold px-3 h-8 border border-navy/30 hover:bg-navy hover:text-off-white rounded-sm transition-colors inline-flex items-center justify-center"
                      >
                        Editar
                      </Link>
                      <form action={deleteTickerMessage}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          className="text-[10px] uppercase tracking-[0.18em] font-bold px-3 h-8 border border-alert-red/40 text-alert-red hover:bg-alert-red hover:text-off-white rounded-sm transition-colors w-full"
                          formNoValidate
                        >
                          Excluir
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Form (criar OU editar) */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-md border border-border-subtle bg-white p-5">
            <h2 className="font-display font-bold text-fs-18 text-navy mb-4">
              {editing ? "Editar mensagem" : "Nova mensagem"}
            </h2>

            <form
              action={editing ? updateTickerMessage : createTickerMessage}
              className="space-y-3"
            >
              {editing && <input type="hidden" name="id" value={editing.id} />}

              <label className="block">
                <span className="text-fs-12 font-semibold text-navy block mb-1">
                  Texto <span className="text-alert-red">*</span>
                </span>
                <textarea
                  name="text"
                  className="input min-h-[80px]"
                  required
                  maxLength={240}
                  defaultValue={editing?.text ?? ""}
                  placeholder="Ex.: Carnaval da Barra 2026 — confira a programação"
                />
                <span className="text-fs-12 text-ink-400">Até 240 caracteres.</span>
              </label>

              <label className="block">
                <span className="text-fs-12 font-semibold text-navy block mb-1">
                  Rótulo (opcional)
                </span>
                <input
                  name="kicker"
                  className="input"
                  maxLength={40}
                  defaultValue={editing?.kicker ?? ""}
                  placeholder="Ex.: CARNAVAL · AVISO · URGENTE"
                />
                <span className="text-fs-12 text-ink-400">
                  Aparece em dourado antes do texto. Maiúsculas funcionam melhor.
                </span>
              </label>

              <label className="block">
                <span className="text-fs-12 font-semibold text-navy block mb-1">
                  Link (opcional)
                </span>
                <input
                  name="link"
                  type="text"
                  className="input"
                  defaultValue={editing?.link ?? ""}
                  placeholder="/cidade/carnaval-da-barra-2026 ou https://..."
                />
              </label>

              <label className="block">
                <span className="text-fs-12 font-semibold text-navy block mb-1">
                  Ordem
                </span>
                <input
                  name="sort_order"
                  type="number"
                  className="input"
                  defaultValue={editing?.sort_order ?? 0}
                />
                <span className="text-fs-12 text-ink-400">
                  Menor número aparece primeiro. Use 0 se tanto faz.
                </span>
              </label>

              <label className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={editing?.is_active ?? true}
                  className="h-4 w-4 accent-navy"
                />
                <span className="text-fs-13 font-semibold text-navy">
                  Ativa (aparece no portal)
                </span>
              </label>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="h-10 px-5 inline-flex items-center rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors"
                >
                  {editing ? "Salvar" : "Adicionar"}
                </button>
                {editing && (
                  <Link
                    href="/admin/ticker"
                    className="text-fs-13 font-semibold text-ink-500 hover:text-navy"
                  >
                    Cancelar
                  </Link>
                )}
              </div>
            </form>
          </div>

          <div className="mt-4 rounded-md border border-border-subtle bg-off-white p-4 text-fs-12 text-ink-700 leading-relaxed">
            <p className="font-semibold text-navy mb-1">Como funciona</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Com mensagens ativas, o ticker mostra só elas (em ordem).</li>
              <li>Sem nenhuma ativa, cai automático nas matérias do dia.</li>
              <li>Pausar uma mensagem não apaga — só tira do ar.</li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}

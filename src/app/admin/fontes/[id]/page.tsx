import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../_components/header";
import SourceForm from "../form";
import { createClient } from "@/lib/supabase/server";
import { deleteSource, resetSourceErrors, toggleSource } from "@/lib/actions/sources";
import type { SourceType, SourcePriority } from "@/lib/db/sources";

export const dynamic = "force-dynamic";

type SourceFull = {
  id: string;
  name: string;
  type: string;
  city: string;
  priority: string;
  active: boolean;
  last_fetched_at: string | null;
  error_count: number;
  created_at: string;
  config: { url?: string; filters?: { keywords?: string[] } } | null;
};

export default async function EditarFontePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: source } = await supabase
    .from("sources")
    .select("id, name, type, city, priority, active, last_fetched_at, error_count, created_at, config")
    .eq("id", params.id)
    .maybeSingle<SourceFull>();

  if (!source) notFound();

  // Conta itens já coletados — guia da decisão de delete
  const { count: rawCount } = await supabase
    .from("raw_items")
    .select("*", { count: "exact", head: true })
    .eq("source_id", source.id);

  const rawItems = rawCount ?? 0;

  return (
    <>
      <Header
        kicker={`Editar · ${source.id}`}
        title={source.name}
        sub={`${rawItems} ${rawItems === 1 ? "item coletado" : "itens coletados"} · cadastrada em ${new Date(
          source.created_at,
        ).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`}
      />

      <div className="mt-6 flex items-center gap-3 text-fs-12">
        <Link href="/admin/fontes" className="font-bold text-zimba-blue hover:text-navy">
          ← Voltar pra Fontes
        </Link>
      </div>

      {/* Status / metadata strip */}
      <div className="mt-6 grid sm:grid-cols-3 gap-3">
        <MetaCard
          label="Status"
          value={source.active ? "ATIVA" : "PAUSADA"}
          accent={source.active ? "eco" : "ink"}
        />
        <MetaCard
          label="Última coleta"
          value={
            source.last_fetched_at
              ? new Date(source.last_fetched_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "nunca"
          }
        />
        <MetaCard
          label="Erros consecutivos"
          value={String(source.error_count)}
          accent={source.error_count > 0 ? "red" : "ink"}
        />
      </div>

      {source.error_count > 0 && (
        <form action={resetSourceErrors} className="mt-3">
          <input type="hidden" name="id" value={source.id} />
          <button
            type="submit"
            className="text-fs-12 font-bold text-alert-red hover:text-navy underline underline-offset-2"
          >
            Zerar contador de erros
          </button>
        </form>
      )}

      <div className="mt-8">
        <SourceForm
          mode="edit"
          id={source.id}
          initial={{
            id: source.id,
            name: source.name,
            type: source.type as SourceType,
            priority: source.priority as SourcePriority,
            city: source.city,
            active: source.active,
            url: source.config?.url ?? "",
            keywords: source.config?.filters?.keywords ?? [],
          }}
        />
      </div>

      {/* Zona perigosa */}
      <section className="mt-12 rounded-md border border-alert-red/40 bg-alert-red/5 p-5">
        <h2 className="font-display font-black text-fs-18 text-alert-red uppercase tracking-wide">
          Zona perigosa
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-border-subtle bg-white p-4">
            <p className="font-display font-bold text-fs-15 text-navy">Pausar fonte</p>
            <p className="text-fs-12 text-ink-500 mt-1 leading-snug">
              Mantém o histórico, mas o Curador para de coletar. Pode reativar depois.
            </p>
            <form action={toggleSource} className="mt-3">
              <input type="hidden" name="id" value={source.id} />
              <button
                type="submit"
                className="h-9 px-4 rounded-md border border-navy bg-white text-navy font-bold text-fs-12 uppercase tracking-[0.18em] hover:bg-navy hover:text-zimba-gold transition-colors"
              >
                {source.active ? "Pausar" : "Reativar"}
              </button>
            </form>
          </div>

          <div className="rounded-md border border-border-subtle bg-white p-4">
            <p className="font-display font-bold text-fs-15 text-navy">Apagar fonte</p>
            <p className="text-fs-12 text-ink-500 mt-1 leading-snug">
              {rawItems > 0 ? (
                <>
                  Bloqueado: já tem <strong>{rawItems}</strong>{" "}
                  {rawItems === 1 ? "item coletado" : "itens coletados"}. Pause em vez de apagar pra
                  preservar o histórico.
                </>
              ) : (
                <>Sem histórico, pode remover. Essa ação é permanente.</>
              )}
            </p>
            <form action={deleteSource} className="mt-3">
              <input type="hidden" name="id" value={source.id} />
              <button
                type="submit"
                disabled={rawItems > 0}
                className="h-9 px-4 rounded-md border border-alert-red bg-white text-alert-red font-bold text-fs-12 uppercase tracking-[0.18em] hover:bg-alert-red hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Apagar
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}

// ---- helpers ---------------------------------------------------------------

function MetaCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "eco" | "ink" | "red";
}) {
  const valueClass =
    accent === "eco"
      ? "text-eco-green"
      : accent === "red"
        ? "text-alert-red"
        : "text-navy";
  return (
    <div className="rounded-md border border-border-subtle bg-white p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500">{label}</p>
      <p className={`mt-1 font-display font-black text-fs-18 ${valueClass}`}>{value}</p>
    </div>
  );
}

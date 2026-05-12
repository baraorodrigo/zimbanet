import Link from "next/link";
import { Header } from "../_components/header";
import { listAllPersonas } from "@/lib/db/personas";
import { togglePersona, deletePersona } from "@/lib/actions/personas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PersonasPage() {
  const personas = await listAllPersonas();

  // Conta matérias por persona (mostra volume + trava o delete)
  const admin = createAdminClient();
  const counts: Record<string, number> = {};
  await Promise.all(
    personas.map(async (p) => {
      const { count } = await admin
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("persona_id", p.id);
      counts[p.id] = count ?? 0;
    }),
  );

  const active = personas.filter((p) => p.is_active);
  const inactive = personas.filter((p) => !p.is_active);

  return (
    <>
      <Header
        kicker="Redação"
        title="Personas editoriais"
        sub={`${active.length} ativa${active.length === 1 ? "" : "s"} · ${inactive.length} pausada${inactive.length === 1 ? "" : "s"}. Cada persona é uma voz da ZIMBANET — quando reescrever uma matéria você escolhe uma delas.`}
      />

      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-fs-13 text-ink-500 max-w-[60ch]">
          A persona define o tom, o ângulo e o que entra/não entra na matéria.
          Edita o prompt-sistema com cuidado — é ele que segura a voz.
        </p>
        <Link
          href="/admin/personas/nova"
          className="h-10 px-4 inline-flex items-center rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-13 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors"
        >
          + Nova persona
        </Link>
      </div>

      {personas.length === 0 ? (
        <div className="mt-8 rounded-md border border-border-subtle bg-white p-10 text-center">
          <p className="font-display font-black text-fs-18 text-navy">
            Nenhuma persona cadastrada
          </p>
          <p className="mt-1 text-fs-13 text-ink-500">
            Sem persona, não tem como reescrever matéria — comece criando uma.
          </p>
          <Link
            href="/admin/personas/nova"
            className="mt-4 inline-block text-fs-13 font-bold text-zimba-blue hover:text-navy underline underline-offset-2"
          >
            Criar primeira persona →
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {personas.map((p) => (
            <PersonaCard
              key={p.id}
              persona={p}
              usageCount={counts[p.id] ?? 0}
            />
          ))}
        </div>
      )}
    </>
  );
}

function PersonaCard({
  persona: p,
  usageCount,
}: {
  persona: {
    id: string;
    slug: string;
    name: string;
    headline: string | null;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    updated_at: string;
  };
  usageCount: number;
}) {
  return (
    <article
      className={`rounded-md border bg-white p-5 transition-colors ${
        p.is_active
          ? "border-border-subtle"
          : "border-border-subtle/60 bg-off-white/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-500">
              #{p.sort_order}
            </span>
            {p.is_active ? (
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold rounded px-1.5 py-0.5 bg-eco-green/10 text-eco-green">
                ativa
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold rounded px-1.5 py-0.5 bg-ink-100 text-ink-500">
                pausada
              </span>
            )}
          </div>
          <Link
            href={`/admin/personas/${p.id}`}
            className={`mt-1.5 block font-display font-black text-fs-22 leading-tight hover:text-zimba-blue ${
              p.is_active ? "text-navy" : "text-ink-500"
            }`}
          >
            {p.name}
          </Link>
          <p className="font-mono text-fs-11 text-ink-500 mt-0.5">
            slug: {p.slug}
          </p>
          {p.headline && (
            <p className="mt-2 text-fs-14 text-ink-700 leading-snug">
              {p.headline}
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink-500">
            Usada em
          </p>
          <p className="font-display font-black text-fs-22 text-navy">
            {usageCount}
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
            matéria{usageCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {p.description && (
        <p className="mt-3 text-fs-13 text-ink-700 leading-relaxed line-clamp-3">
          {p.description}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-border-subtle flex items-center gap-2 flex-wrap">
        <Link
          href={`/admin/personas/${p.id}`}
          className="h-8 px-3 inline-flex items-center rounded-md border border-navy bg-white text-navy font-bold text-fs-11 uppercase tracking-[0.16em] hover:bg-navy hover:text-zimba-gold transition-colors"
        >
          Editar
        </Link>
        <form action={togglePersona}>
          <input type="hidden" name="id" value={p.id} />
          <button
            type="submit"
            className={`h-8 px-3 inline-flex items-center rounded-md border font-bold text-fs-11 uppercase tracking-[0.16em] transition-colors ${
              p.is_active
                ? "border-border-subtle bg-white text-ink-500 hover:bg-ink-100 hover:text-navy"
                : "border-eco-green bg-white text-eco-green hover:bg-eco-green hover:text-white"
            }`}
          >
            {p.is_active ? "Pausar" : "Reativar"}
          </button>
        </form>
        {usageCount === 0 && (
          <form action={deletePersona} className="ml-auto">
            <input type="hidden" name="id" value={p.id} />
            <button
              type="submit"
              className="h-8 px-3 inline-flex items-center rounded-md border border-alert-red bg-white text-alert-red font-bold text-fs-11 uppercase tracking-[0.16em] hover:bg-alert-red hover:text-white transition-colors"
            >
              Apagar
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

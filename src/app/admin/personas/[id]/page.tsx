import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../_components/header";
import { getPersonaById } from "@/lib/db/personas";
import { deletePersona } from "@/lib/actions/personas";
import PersonaForm from "../form";

export const dynamic = "force-dynamic";

export default async function EditPersonaPage({
  params,
}: {
  params: { id: string };
}) {
  const persona = await getPersonaById(params.id);
  if (!persona) notFound();

  return (
    <>
      <Header
        kicker={`Persona · ${persona.is_active ? "ativa" : "pausada"}`}
        title={persona.name}
        sub={
          persona.headline ??
          `Editando "${persona.slug}" — criada em ${new Date(persona.created_at).toLocaleString("pt-BR")}`
        }
      />

      <div className="mt-6 flex items-center gap-2 flex-wrap">
        <Link
          href="/admin/personas"
          className="h-9 px-4 rounded-md border border-border-subtle text-ink-700 text-[11px] uppercase tracking-[0.22em] font-bold inline-flex items-center hover:border-navy hover:text-navy transition-colors"
        >
          ← Voltar
        </Link>
        <span className="text-fs-12 text-ink-500 font-mono">
          slug: {persona.slug}
        </span>
        <div className="ml-auto">
          <form action={deletePersona}>
            <input type="hidden" name="id" value={persona.id} />
            <button
              type="submit"
              className="h-9 px-3 rounded-md border border-alert-red text-alert-red text-[11px] uppercase tracking-[0.22em] font-bold inline-flex items-center hover:bg-alert-red hover:text-white transition-colors"
              title="Só permite apagar se a persona não tiver matéria vinculada."
            >
              Apagar
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6">
        <PersonaForm mode="edit" id={persona.id} initial={persona} />
      </div>
    </>
  );
}

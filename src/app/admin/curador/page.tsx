import Link from "next/link";
import { Header } from "../_components/header";
import { getActiveRubric } from "@/lib/db/curator";
import CuradorForm from "./form";

export const dynamic = "force-dynamic";

export default async function CuradorPage() {
  const rubric = await getActiveRubric();

  return (
    <>
      <Header
        kicker="Calibração do Curador"
        title="O que o Haiku procura"
        sub="Edite a rubrica que o Curador usa pra decidir o que vale matéria. Cada save bumpa a versão e o motor re-scoreia os ítens em backlog."
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {rubric ? (
          <>
            <span className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.22em] font-bold">
              versão {rubric.prompt_version}
            </span>
            <span className="text-fs-12 text-ink-500 font-mono">
              salva em {new Date(rubric.updated_at).toLocaleString("pt-BR")}
              {rubric.updated_by && ` por ${rubric.updated_by}`}
            </span>
          </>
        ) : (
          <span className="h-9 px-3 inline-flex items-center rounded-md border border-alert-red bg-alert-red/5 text-alert-red text-[11px] uppercase tracking-[0.22em] font-bold">
            Sem rubrica — o Curador roda no fallback
          </span>
        )}
        <Link
          href="/admin/auditoria?entity_type=curator_rubric"
          className="ml-auto h-9 px-4 rounded-md border border-border-subtle text-ink-700 text-[11px] uppercase tracking-[0.22em] font-bold inline-flex items-center hover:border-navy hover:text-navy transition-colors"
        >
          Histórico
        </Link>
      </div>

      <div className="mt-6">
        <CuradorForm initial={rubric} />
      </div>
    </>
  );
}

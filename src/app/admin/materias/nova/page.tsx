import { Header } from "../../_components/header";
import ArticleForm from "./form";
import { createClient } from "@/lib/supabase/server";
import {
  EDITORIA_SLUGS,
  type ArticleRow,
  type EditoriaSlug,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

type SearchParams = { from?: string };

type RawRow = {
  id: string;
  title: string;
  body: string | null;
  url: string;
  image_url: string | null;
  source_id: string;
};

type ScoredRow = {
  editoria: string | null;
  ai_reasoning: string | null;
};

type SourceRow = { id: string; name: string };

export default async function NovaMateriaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let initial: Partial<ArticleRow> | undefined;
  let sourceContext: { name: string; url: string; reasoning: string | null } | null = null;

  if (searchParams.from) {
    const supabase = createClient();
    const rawId = searchParams.from;

    const { data: raw } = await supabase
      .from("raw_items")
      .select("id, title, body, url, image_url, source_id")
      .eq("id", rawId)
      .maybeSingle<RawRow>();

    if (raw) {
      const [{ data: scored }, { data: source }] = await Promise.all([
        supabase
          .from("scored_items")
          .select("editoria, ai_reasoning")
          .eq("raw_item_id", rawId)
          .maybeSingle<ScoredRow>(),
        supabase
          .from("sources")
          .select("id, name")
          .eq("id", raw.source_id)
          .maybeSingle<SourceRow>(),
      ]);

      const ed = scored?.editoria ?? "";
      const editoria: EditoriaSlug = (EDITORIA_SLUGS as string[]).includes(ed)
        ? (ed as EditoriaSlug)
        : "cidade";

      initial = {
        title: raw.title,
        body: raw.body ?? "",
        hero_image_url: raw.image_url ?? "",
        editoria,
      };
      sourceContext = {
        name: source?.name ?? raw.source_id,
        url: raw.url,
        reasoning: scored?.ai_reasoning ?? null,
      };
    }
  }

  return (
    <>
      <Header
        kicker={sourceContext ? "Nova matéria · a partir da pauta" : "Nova matéria"}
        title={sourceContext ? "Reescrever com voz própria" : "Escrever do zero"}
        sub={
          sourceContext
            ? `Os campos vieram pré-preenchidos pela fonte. Reescreva com a voz da ZIMBANET — não copie.`
            : "Salva como rascunho pra revisar depois ou publica direto. Sem AI por enquanto — você no controle."
        }
      />

      {sourceContext && (
        <div className="mt-6 rounded-md border border-zimba-blue bg-zimba-blue/5 p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-blue">
                Fonte original
              </p>
              <a
                href={sourceContext.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1 font-display font-bold text-fs-15 text-navy hover:text-zimba-blue underline underline-offset-2 break-all"
              >
                {sourceContext.name} ↗
              </a>
            </div>
            {sourceContext.reasoning && (
              <p className="text-fs-12 text-ink-500 font-mono max-w-[44ch]">
                {sourceContext.reasoning}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-8">
        <ArticleForm mode="create" initial={initial} />
      </div>
    </>
  );
}

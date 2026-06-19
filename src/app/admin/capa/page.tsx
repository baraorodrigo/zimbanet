import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EDITORIA_LABEL, type EditoriaSlug } from "@/lib/db/types";
import { setArticleAsCover, toggleArticleHighlight } from "@/lib/actions/articles";
import { Header } from "../_components/header";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  slug: string;
  editoria: string;
  hero_image_url: string | null;
  is_cover: boolean;
  is_highlight: boolean;
  published_at: string | null;
};

const MAX_HIGHLIGHTS = 4;

export default async function CapaPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug, editoria, hero_image_url, is_cover, is_highlight, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(60);

  const published = (data ?? []) as Row[];

  // Mesma lógica da home: pino primeiro, automático por data como reserva.
  const pinnedCover = published.find((a) => a.is_cover) ?? null;
  const cover = pinnedCover ?? published[0] ?? null;
  const coverPinned = !!pinnedCover;

  const pinnedHighlights = published.filter((a) => a.is_highlight && a.id !== cover?.id);
  const autoHighlights = published
    .filter((a) => !a.is_highlight && a.id !== cover?.id)
    .slice(0, Math.max(0, MAX_HIGHLIGHTS - pinnedHighlights.length));
  const highlights = [...pinnedHighlights, ...autoHighlights].slice(0, MAX_HIGHLIGHTS);

  return (
    <>
      <Header
        kicker="Portal · primeira página"
        title="Capa do portal"
        sub="Por padrão a home é automática (as mais recentes). Aqui você fixa o que não pode sair: 📌 fixado trava no lugar; 🔄 automático muda sozinho conforme você publica."
      />

      {error && (
        <div className="mt-6 rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
          Erro carregando: {error.message}
        </div>
      )}

      {/* ---- Como está a home agora ---- */}
      <section className="mt-8">
        <h2 className="font-display font-black text-fs-16 text-navy uppercase tracking-[0.12em]">
          Capa
        </h2>
        <div className="mt-3">
          {cover ? (
            <SlotCard row={cover} pinned={coverPinned} kind="cover" />
          ) : (
            <p className="text-fs-14 text-ink-500">Nenhuma matéria publicada ainda.</p>
          )}
        </div>

        <h2 className="mt-8 font-display font-black text-fs-16 text-navy uppercase tracking-[0.12em]">
          Destaques <span className="text-ink-400 font-bold">(até {MAX_HIGHLIGHTS})</span>
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {highlights.length === 0 ? (
            <p className="text-fs-14 text-ink-500">Sem destaques.</p>
          ) : (
            highlights.map((a) => (
              <SlotCard key={a.id} row={a} pinned={a.is_highlight} kind="highlight" />
            ))
          )}
        </div>
      </section>

      {/* ---- Escolher das publicadas ---- */}
      <section className="mt-12">
        <h2 className="font-display font-black text-fs-16 text-navy uppercase tracking-[0.12em]">
          Publicadas recentes
        </h2>
        <p className="mt-1 text-fs-13 text-ink-500">
          Fixe uma como capa (só uma por vez) ou ligue/desligue como destaque.
        </p>
        <ul className="mt-4 divide-y divide-border-subtle border border-border-subtle rounded-md bg-white">
          {published.map((a) => (
            <PickRow key={a.id} row={a} />
          ))}
        </ul>
      </section>
    </>
  );
}

function Thumb({ row, className }: { row: Row; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md border border-border-subtle bg-navy ${className ?? ""}`}>
      {row.hero_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.hero_image_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-off-white/40 text-fs-18">📰</div>
      )}
    </div>
  );
}

function SlotCard({ row, pinned, kind }: { row: Row; pinned: boolean; kind: "cover" | "highlight" }) {
  return (
    <div className="flex items-center gap-4 rounded-md border border-border-subtle bg-white p-3">
      <Link href={`/admin/materias/${row.id}`} className="shrink-0">
        <Thumb row={row} className="w-[88px] aspect-[16/10]" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-gold">
            {EDITORIA_LABEL[row.editoria as EditoriaSlug] ?? row.editoria}
          </span>
          <span
            className={`text-[10px] uppercase tracking-[0.16em] font-bold rounded px-2 py-0.5 ${
              pinned ? "bg-zimba-blue/10 text-zimba-blue" : "bg-ink-100 text-ink-500"
            }`}
          >
            {pinned ? "📌 fixado" : "🔄 automático"}
          </span>
        </div>
        <h3 className="font-display font-bold text-fs-15 text-navy leading-tight mt-1 line-clamp-2">
          {row.title}
        </h3>
      </div>
      {pinned && (
        <form
          action={kind === "cover" ? setArticleAsCover : toggleArticleHighlight}
          className="shrink-0"
        >
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            className="h-9 px-3 rounded-md border border-border-subtle text-ink-600 text-[11px] uppercase tracking-[0.18em] font-bold hover:border-alert-red hover:text-alert-red transition-colors"
            title="Soltar — volta a ser automático"
          >
            Soltar
          </button>
        </form>
      )}
    </div>
  );
}

function PickRow({ row }: { row: Row }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Link href={`/admin/materias/${row.id}`} className="shrink-0">
        <Thumb row={row} className="w-[56px] aspect-square" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-zimba-gold">
          {EDITORIA_LABEL[row.editoria as EditoriaSlug] ?? row.editoria}
        </p>
        <p className="font-display font-bold text-fs-14 text-navy leading-tight line-clamp-1">
          {row.title}
        </p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <form action={setArticleAsCover}>
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            className={`h-9 px-3 rounded-md text-[11px] uppercase tracking-[0.16em] font-bold transition-colors border ${
              row.is_cover
                ? "bg-navy text-zimba-gold border-navy"
                : "border-border-subtle text-navy hover:border-navy"
            }`}
            title={row.is_cover ? "É a capa — clique pra soltar" : "Fixar como capa"}
          >
            {row.is_cover ? "★ capa" : "☆ capa"}
          </button>
        </form>
        <form action={toggleArticleHighlight}>
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            className={`h-9 px-3 rounded-md text-[11px] uppercase tracking-[0.16em] font-bold transition-colors border ${
              row.is_highlight
                ? "bg-zimba-blue text-white border-zimba-blue"
                : "border-border-subtle text-zimba-blue hover:border-zimba-blue"
            }`}
            title={row.is_highlight ? "É destaque — clique pra desligar" : "Marcar destaque"}
          >
            {row.is_highlight ? "● destaque" : "○ destaque"}
          </button>
        </form>
      </div>
    </li>
  );
}

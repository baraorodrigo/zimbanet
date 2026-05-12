import Link from "next/link";
import { Header } from "../../_components/header";
import SourceForm from "../form";

export const dynamic = "force-dynamic";

export default function NovaFontePage() {
  return (
    <>
      <Header
        kicker="Nova fonte"
        title="Cadastrar fonte de coleta"
        sub="RSS, scraper ou API. O Curador vai puxar dela na próxima rodada se ela ficar ativa."
      />

      <div className="mt-6 flex items-center gap-3 text-fs-12">
        <Link
          href="/admin/fontes"
          className="font-bold text-zimba-blue hover:text-navy"
        >
          ← Voltar pra Fontes
        </Link>
      </div>

      <div className="mt-6 rounded-md border border-zimba-blue bg-zimba-blue/5 p-4">
        <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-zimba-blue">
          Dica rápida
        </p>
        <p className="mt-1 text-fs-13 text-ink-700">
          RSS é o mais fácil — é só achar o feed (geralmente <code className="font-mono">/feed</code> ou
          <code className="font-mono"> /rss</code> no fim da URL). Scraper e API requerem código no
          pipeline e por enquanto ficam só cadastrados.
        </p>
      </div>

      <div className="mt-8">
        <SourceForm mode="create" />
      </div>
    </>
  );
}

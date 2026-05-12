import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

export const metadata = {
  title: "Página não encontrada — ZIMBANET",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <SiteHeader />

      <main className="zb-container flex-1 grid place-items-center py-20">
        <div className="max-w-[60ch] text-center">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-zimba-gold mb-3">
            Erro 404
          </p>
          <h1 className="font-display text-fs-56 lg:text-fs-72 font-black tracking-tight2 text-navy mb-4 leading-none">
            Não achamos
            <br />
            essa matéria.
          </h1>
          <p className="text-fs-16 text-ink-700 mb-8">
            Pode ter saído do ar, mudado de URL ou nunca ter existido. Se chegou aqui por
            um link antigo, talvez o que você procura esteja em outra editoria.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-navy text-zimba-gold text-[11px] uppercase tracking-[0.24em] font-bold px-6 h-11 hover:bg-zimba-gold hover:text-navy transition-colors"
            >
              Voltar pra capa
            </Link>
            <Link
              href="/buscar"
              className="inline-flex items-center gap-2 bg-white border border-navy/15 text-navy text-[11px] uppercase tracking-[0.24em] font-bold px-6 h-11 hover:border-zimba-gold transition-colors"
            >
              Buscar matérias
            </Link>
          </div>

          <div className="mt-10 pt-8 border-t border-border-subtle">
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 mb-3">
              Editorias
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-fs-12 font-semibold">
              {[
                ["cidade", "Cidade"],
                ["politica", "Política"],
                ["esporte", "Esporte"],
                ["cultura", "Cultura"],
                ["policia", "Polícia"],
                ["praias", "Praias"],
                ["zimbamilgrau", "#Zimbamilgrau"],
                ["bazardazimba", "#Bazardazimba"],
              ].map(([slug, label]) => (
                <Link
                  key={slug}
                  href={`/${slug}`}
                  className="rounded-xs bg-white border border-navy/15 px-3 py-1.5 text-navy/70 hover:border-zimba-gold hover:text-navy transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

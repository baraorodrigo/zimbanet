import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";
import BazarNovoForm from "./form";

export const metadata: Metadata = {
  title: "Anunciar grátis no #bazardazimba · ZIMBANET",
  description:
    "Em 30 segundos seu anúncio entra no ar. Foto, preço, WhatsApp — pronto.",
};

export default async function NovoAnuncioPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />

      <main className="zb-container pb-16">
        <nav
          aria-label="Caminho"
          className="pt-6 pb-3 font-sans text-fs-12 uppercase tracking-[0.16em] text-ink-500"
        >
          <Link href="/" className="hover:text-navy">
            Início
          </Link>
          <span className="px-2 text-ink-300">/</span>
          <Link href="/bazardazimba" className="hover:text-navy">
            #bazardazimba
          </Link>
          <span className="px-2 text-ink-300">/</span>
          <span className="text-navy">Novo anúncio</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 lg:gap-12">
          <article className="min-w-0">
            <header className="mb-8 border-b border-border-subtle pb-6">
              <p className="font-sans text-fs-12 font-bold uppercase tracking-[0.22em] text-zimba-gold mb-3">
                Anúncio comunitário
              </p>
              <h1 className="font-display font-black text-fs-44 lg:text-fs-56 leading-tight tracking-tight2 text-navy text-balance">
                Em 30s seu anúncio entra no ar.
              </h1>
              <p className="mt-3 max-w-[60ch] text-fs-16 leading-relaxed text-ink-700">
                Sem cadastro, sem taxa. Quem quiser falar com você chama
                direto no WhatsApp.
              </p>
            </header>

            <BazarNovoForm isLoggedIn={isLoggedIn} />
          </article>

          <aside className="min-w-0 space-y-6">
            <div className="zb-side-card">
              <h3 className="zb-side-card-title">Dicas pra vender rápido</h3>
              <ul className="space-y-3 text-fs-13 text-ink-700 leading-relaxed">
                <li>📸 Foto com boa luz é o que mais vende.</li>
                <li>💬 Título direto: o que é + condição.</li>
                <li>💰 Preço claro vende melhor que &ldquo;tratar&rdquo;.</li>
                <li>📍 Bairro ajuda quem mora perto.</li>
              </ul>
            </div>

            <div className="rounded-md bg-navy text-off-white p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold mb-3">
                {isLoggedIn ? "Antes de publicar" : "Sem cadastro chato"}
              </p>
              <p className="font-display text-fs-16 leading-snug mb-3">
                {isLoggedIn
                  ? "Você já tá logado — solta o anúncio e ele entra no ar na hora."
                  : "Anuncia direto. Pedimos só seu email pra confirmar — link mágico, sem senha."}
              </p>
              <p className="text-fs-13 text-off-white/70">
                Upload de foto sai na próxima — por enquanto o anúncio vai sem
                imagem mesmo. WhatsApp resolve.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

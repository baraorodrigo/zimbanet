import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";
import { signInWithGoogle, signInAsDev } from "@/lib/actions/auth";
import LoginEmailForm from "./email-form";
import LoginPhoneForm from "./phone-form";

const isDev = process.env.NODE_ENV !== "production";

export const metadata: Metadata = {
  title: "Entrar · ZIMBANET",
  description: "Entre com Google ou pelo seu email pra postar no #zimbamilgrau e anunciar no #bazardazimba.",
};

type Props = {
  searchParams?: { next?: string; erro?: string };
};

export default async function LoginPage({ searchParams }: Props) {
  const next = searchParams?.next && searchParams.next.startsWith("/") ? searchParams.next : "/";
  const erro = searchParams?.erro ?? null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next);
  }

  async function googleAction() {
    "use server";
    await signInWithGoogle(next);
  }
  async function devAction(formData: FormData) {
    "use server";
    await signInAsDev(formData);
  }

  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />

      <main className="zb-container pb-20">
        <nav
          aria-label="Caminho"
          className="pt-6 pb-3 font-sans text-fs-12 uppercase tracking-[0.16em] text-ink-500"
        >
          <Link href="/" className="hover:text-navy">
            Início
          </Link>
          <span className="px-2 text-ink-300">/</span>
          <span className="text-navy">Entrar</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:gap-14 items-start">
          <article className="min-w-0 max-w-[560px]">
            <header className="mb-8 border-b border-border-subtle pb-6">
              <p className="font-sans text-fs-12 font-bold uppercase tracking-[0.22em] text-zimba-gold mb-3">
                Sua conta no ZIMBANET
              </p>
              <h1 className="font-display font-black text-fs-44 lg:text-fs-56 leading-[1.02] tracking-tight2 text-navy text-balance">
                Entrar pra postar.
              </h1>
              <p className="mt-3 max-w-[52ch] text-fs-16 leading-relaxed text-ink-700">
                Sem cadastro chato, sem senha. Você usa pra postar no
                <Link href="/zimbamilgrau" className="text-zimba-blue hover:underline"> #zimbamilgrau</Link> e anunciar no
                <Link href="/bazardazimba" className="text-zimba-blue hover:underline"> #bazardazimba</Link>.
              </p>
            </header>

            {erro && (
              <div className="mb-6 rounded-md border border-alert-red bg-alert-red/5 p-4 text-fs-14 text-alert-red">
                {erro}
              </div>
            )}

            {/* Google em destaque */}
            <form action={googleAction} className="mb-5">
              <button
                type="submit"
                className="w-full h-14 rounded-md border-2 border-navy bg-navy text-off-white hover:bg-zimba-blue hover:border-zimba-blue transition-colors flex items-center justify-center gap-3 font-display font-bold text-fs-16"
              >
                <GoogleMark />
                Entrar com Google
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4" role="separator">
              <span className="h-px flex-1 bg-border-subtle" />
              <span className="text-[10px] uppercase tracking-[0.32em] font-bold text-ink-400">
                ou pelo email
              </span>
              <span className="h-px flex-1 bg-border-subtle" />
            </div>

            <LoginEmailForm next={next} />

            {/* Outras opções (SMS) */}
            <details className="mt-8 group">
              <summary className="text-fs-13 font-semibold text-ink-600 hover:text-navy cursor-pointer list-none flex items-center gap-2 select-none">
                <span className="text-zimba-gold">+</span>
                <span className="group-open:hidden">Outras opções de entrada</span>
                <span className="hidden group-open:inline">Esconder outras opções</span>
              </summary>
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <p className="text-fs-12 text-ink-500 mb-3">
                  Sem email? Entra com seu celular — chega um código por SMS.
                </p>
                <LoginPhoneForm next={next} />
              </div>
            </details>

            {isDev && (
              <div className="mt-8 rounded-md border-2 border-dashed border-zimba-gold/60 bg-zimba-gold/5 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-gold-700 mb-2">
                  Modo desenvolvimento
                </p>
                <p className="text-fs-13 text-ink-700 mb-3">
                  Bypass dos providers — entra como usuário de teste. Não aparece em produção.
                </p>
                <form action={devAction}>
                  <input type="hidden" name="next" value={next} />
                  <button
                    type="submit"
                    className="w-full h-12 rounded-md bg-navy text-zimba-gold font-display font-bold text-fs-14 uppercase tracking-[0.18em] hover:bg-zimba-gold hover:text-navy transition-colors"
                  >
                    Entrar como dev (teste)
                  </button>
                </form>
              </div>
            )}

            <p className="mt-8 text-fs-12 text-ink-500 leading-relaxed max-w-[52ch]">
              Ao entrar você concorda em seguir as regras da comunidade.
              Não compartilhamos seu email ou telefone publicamente — eles só servem pra autenticação.
              Posts no mural podem ser feitos como anônimo.
            </p>
          </article>

          <aside className="min-w-0 space-y-6">
            <div className="zb-side-card">
              <h3 className="zb-side-card-title">Pra que serve a conta?</h3>
              <ul className="space-y-3 text-fs-13 text-ink-700 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-zimba-gold font-bold">·</span>
                  Postar no #zimbamilgrau (com nome ou anônimo).
                </li>
                <li className="flex gap-2">
                  <span className="text-zimba-gold font-bold">·</span>
                  Anunciar no #bazardazimba — vende, doa, troca, procura.
                </li>
                <li className="flex gap-2">
                  <span className="text-zimba-gold font-bold">·</span>
                  Curtir e comentar no mural.
                </li>
                <li className="flex gap-2">
                  <span className="text-zimba-gold font-bold">·</span>
                  Receber alertas de breaking de Imbituba.
                </li>
              </ul>
            </div>

            <div className="rounded-md bg-navy text-off-white p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold mb-3">
                Sem complicação
              </p>
              <p className="font-display text-fs-16 leading-snug mb-3">
                Você nem precisa logar pra postar a 1ª vez.
              </p>
              <p className="text-fs-13 text-off-white/70">
                Solta o post, a gente manda um link no email pra confirmar.
                Da 2ª vez em diante já entra direto.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.5 34.7 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8L6 33.1C9.3 39.5 16 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.5 5.5C42 35.6 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

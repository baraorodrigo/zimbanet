import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { trending } from "@/lib/mock-data";
import {
  fetchMuralComments,
  fetchMuralLikedSet,
  getMuralPostsWithFallback,
  type MuralCommentRow,
} from "@/lib/db/community";
import { createClient } from "@/lib/supabase/server";
import MuralComposer from "./composer";
import PostCard from "./post-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "#zimbamilgrau — A voz do povo de Imbituba · ZIMBANET",
  description:
    "Mural comunitário aberto: reclamações, achados, perdidos, dicas, denúncias. Imbituba conversando com Imbituba.",
};

const bairros = [
  "Tudo",
  "Centro",
  "Mirim",
  "Vila Nova",
  "Praia da Vila",
  "Praia do Rosa",
  "Ibiraquera",
  "Garopaba",
];

function initialsFromUser(name: string | null, fallback: string | null) {
  const src = (name && name.trim()) || (fallback ? fallback.split("@")[0] : "") || "VC";
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default async function ZimbaMilGrauPage() {
  const supabase = createClient();
  const [{ posts, source }, userResult] = await Promise.all([
    getMuralPostsWithFallback(36),
    supabase.auth.getUser(),
  ]);
  const user = userResult.data.user;
  const composerInitials = user
    ? initialsFromUser(
        (user.user_metadata?.full_name as string | undefined) ?? null,
        user.email ?? user.phone ?? null,
      )
    : "VC";
  // Se vier do mock, multiplica pra parecer cheio. Se for Supabase, usa o que tem.
  const feed = source === "supabase" ? posts : [...posts, ...posts, ...posts].slice(0, 24);

  // Carrega likes do user atual + comentários (só pra posts reais)
  const realIds = source === "supabase" ? feed.map((p) => p.id) : [];
  const [likedSet, commentsByPost] = await Promise.all([
    user && realIds.length ? fetchMuralLikedSet(user.id, realIds) : Promise.resolve(new Set<string>()),
    realIds.length ? fetchMuralComments(realIds) : Promise.resolve(new Map()),
  ]);

  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />

      {/* HERO em navy com textura grid gold */}
      <section className="relative bg-navy text-off-white overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(0deg, rgba(232,177,0,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(232,177,0,0.6) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            maskImage:
              "radial-gradient(ellipse at 75% 30%, #000 35%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 75% 30%, #000 35%, transparent 80%)",
          }}
        />
        <div className="zb-container relative py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-12 items-end">
            <div>
              <div className="eyebrow eyebrow-light mb-5">
                <span>Comunidade</span>
              </div>
              <h1 className="font-display font-black leading-[0.9] tracking-[-0.04em] text-[64px] md:text-[96px] lg:text-[120px]">
                <span className="block">#zimba</span>
                <span className="block text-zimba-gold italic font-normal -mt-2">
                  milgrau
                </span>
              </h1>
              <p className="mt-6 font-display italic text-off-white/75 text-[22px] md:text-[26px] leading-[1.3] max-w-[44ch]">
                A voz do povo de Imbituba — reclama, denuncia, pergunta, acha,
                perde, encontra.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] font-bold text-off-white/45 mb-3">
                  Em alta
                </p>
                <ul className="flex flex-wrap gap-2">
                  {trending.map((t) => (
                    <li key={t}>
                      <span className="text-[12px] font-semibold text-zimba-gold border border-zimba-gold/40 px-3 py-1.5 inline-flex items-center">
                        {t}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="zb-container pb-16">
        <MuralComposer initials={composerInitials} isLoggedIn={!!user} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-10">
          <div className="min-w-0">
            {/* Filtros bairro */}
            <div className="mb-6 flex flex-wrap gap-2 pb-4 border-b border-border-subtle">
              {bairros.map((b, i) => (
                <button
                  key={b}
                  className={`text-[11px] uppercase tracking-[0.2em] font-bold px-3.5 h-9 border transition-colors ${
                    i === 0
                      ? "border-navy bg-navy text-off-white"
                      : "border-navy/15 text-navy hover:border-navy"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            {/* Feed */}
            <ul className="space-y-3">
              {feed.map((p, i) => {
                const cs = ((commentsByPost.get(p.id) as MuralCommentRow[] | undefined) ?? []).map(
                  (c) => ({
                    id: c.id,
                    author_name: c.author_name,
                    is_anon: c.is_anon,
                    body: c.body,
                    created_at: c.created_at,
                  }),
                );
                return (
                  <PostCard
                    key={`${p.id}-${i}`}
                    id={p.id}
                    author={p.author}
                    bairro={p.bairro}
                    postedAt={p.postedAt}
                    body={p.body}
                    isAnon={p.isAnon ?? false}
                    likes={p.likes}
                    comments={p.comments}
                    initialLiked={likedSet.has(p.id)}
                    isLoggedIn={!!user}
                    initialComments={cs}
                  />
                );
              })}
            </ul>

            <div className="mt-8 text-center">
              <button className="border border-navy/20 hover:border-navy text-navy text-[11px] uppercase tracking-[0.24em] font-bold px-8 h-12 inline-flex items-center transition-colors">
                Carregar mais posts
              </button>
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="min-w-0 space-y-6">
            <div className="zb-side-card">
              <h3 className="zb-side-card-title">Regras do mural</h3>
              <ul className="space-y-3 text-fs-13 text-ink-700 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-zimba-gold font-bold">1.</span>
                  Ataques pessoais e xingamento são removidos.
                </li>
                <li className="flex gap-2">
                  <span className="text-zimba-gold font-bold">2.</span>
                  Denúncia: descreva o que viu, não acuse sem prova.
                </li>
                <li className="flex gap-2">
                  <span className="text-zimba-gold font-bold">3.</span>
                  Anônimo é direito — abuso vira banimento.
                </li>
                <li className="flex gap-2">
                  <span className="text-zimba-gold font-bold">4.</span>
                  Spam comercial → use o{" "}
                  <Link href="/bazardazimba" className="text-zimba-blue underline">
                    #bazardazimba
                  </Link>
                  .
                </li>
              </ul>
            </div>

            <div className="zb-side-card">
              <h3 className="zb-side-card-title">Hashtags em alta</h3>
              <ul className="space-y-2">
                {trending.map((t) => (
                  <li key={t}>
                    <span className="font-display font-bold text-fs-15 text-navy">
                      {t}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md bg-navy text-off-white p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-zimba-gold mb-3">
                Notificações
              </p>
              <p className="font-display text-fs-18 leading-snug mb-4">
                Quer ser avisado quando rolar reclamação grave ou breaking?
              </p>
              <Link
                href="/push"
                className="inline-flex items-center justify-center gap-2 bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.24em] font-bold px-5 h-10 hover:bg-off-white transition-colors w-full"
              >
                Ativar alertas
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}


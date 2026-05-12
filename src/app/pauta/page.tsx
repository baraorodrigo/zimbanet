import type { Metadata } from "next";
import InstitutionalShell from "@/components/institutional-shell";

export const metadata: Metadata = {
  title: "Envie uma pauta",
  description: "Tem uma denúncia, sugestão de pauta ou pedido de cobertura? Manda pra redação ZIMBANET.",
};

export default function PautaPage() {
  return (
    <InstitutionalShell
      kicker="Pauta"
      title="Manda essa pauta."
      intro="Denúncia, dica, sugestão de cobertura, festa que ninguém divulga, problema do bairro, alerta de praia, irregularidade na prefeitura — tudo passa pela redação primeiro."
    >
      <h2 className="font-display font-bold text-fs-26 text-navy mt-8 mb-3">Como mandar</h2>
      <p className="mb-4">
        Por enquanto a gente recebe pauta nos canais abaixo — em breve teremos um
        formulário direto aqui na página, com upload de foto/vídeo e checklist.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        <div className="rounded-md bg-white border border-border-subtle p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-gold mb-2">E-mail</p>
          <a
            href="mailto:redacao@zimbanet.com"
            className="font-display text-fs-22 font-bold text-navy hover:text-zimba-gold"
          >
            redacao@zimbanet.com
          </a>
          <p className="text-fs-13 text-ink-500 mt-2">Pauta extensa, com documento ou áudio anexo.</p>
        </div>
        <div className="rounded-md bg-white border border-border-subtle p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-gold mb-2">WhatsApp</p>
          <p className="font-display text-fs-22 font-bold text-navy">(48) 9 9999-9999</p>
          <p className="text-fs-13 text-ink-500 mt-2">Foto, vídeo, alerta rápido. Atende 24/7 em breaking.</p>
        </div>
      </div>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">Sigilo de fonte</h2>
      <p className="mb-4">
        Se você precisa enviar uma denúncia mas teme retaliação, fala isso de cara.
        Sigilo de fonte é direito constitucional do jornalista — a gente protege
        identidade quando há razão legítima e o material está bem apurado.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">O que ajuda</h2>
      <ul className="mb-4 list-disc pl-6 space-y-1">
        <li>Onde e quando aconteceu (rua, bairro, data, hora aproximada)</li>
        <li>Quem está envolvido — se for órgão público, qual</li>
        <li>Foto, vídeo, áudio ou documento original</li>
        <li>Outras pessoas que viram ou podem confirmar</li>
        <li>Seu nome e contato (mantemos sigiloso se você pedir)</li>
      </ul>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">O que não vira matéria</h2>
      <p className="mb-4">
        Boato sem fonte, briga particular, vingança pessoal, conteúdo difamatório
        sem prova, fake news. A gente não vira instrumento pra acerto de conta —
        mas investiga toda denúncia que chega.
      </p>
    </InstitutionalShell>
  );
}

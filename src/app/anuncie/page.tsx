import type { Metadata } from "next";
import Link from "next/link";
import InstitutionalShell from "@/components/institutional-shell";

export const metadata: Metadata = {
  title: "Anuncie no Zimbanet",
  description: "Anuncie sua marca, evento ou serviço pra Imbituba e região via ZIMBANET — site + newsletter + push + redes sociais.",
};

export default function AnunciePage() {
  return (
    <InstitutionalShell
      kicker="Anuncie"
      title="Imbituba inteira lê o Zimba."
      intro="Marca local, comércio de bairro, imobiliária, evento, agência de turismo — anuncia com a gente e fala direto com quem mora, frequenta e gasta na região."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-8">
        <div className="rounded-md bg-white border border-border-subtle p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-gold mb-2">Foco</p>
          <p className="font-display text-fs-22 font-black text-navy leading-tight mb-1">Imbituba e região</p>
          <p className="text-fs-13 text-ink-500">cobertura regional num raio de 50 km</p>
        </div>
        <div className="rounded-md bg-white border border-border-subtle p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-gold mb-2">Canais</p>
          <p className="font-display text-fs-22 font-black text-navy leading-tight mb-1">Site · Push · Newsletter</p>
          <p className="text-fs-13 text-ink-500">três pontos de contato com o leitor</p>
        </div>
        <div className="rounded-md bg-white border border-border-subtle p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-zimba-gold mb-2">Origem</p>
          <p className="font-display text-fs-22 font-black text-navy leading-tight mb-1">@bombei_imbituba</p>
          <p className="text-fs-13 text-ink-500">evolução do canal que a cidade já acompanha</p>
        </div>
      </div>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-8 mb-3">Formatos</h2>
      <ul className="mb-4 list-disc pl-6 space-y-1">
        <li><strong>Banner display</strong> — topo, sidebar, rodapé. CPM ou semanada fixa.</li>
        <li><strong>Conteúdo patrocinado</strong> — matéria sinalizada [PATROCINADO], texto produzido em parceria com a redação.</li>
        <li><strong>Push patrocinado</strong> — alerta direcionado por editoria ou cidade.</li>
        <li><strong>Newsletter</strong> — bloco semanal no boletim diário.</li>
        <li><strong>Bazar destacado</strong> — anúncio fixado no topo do #bazardazimba.</li>
      </ul>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">Boas práticas</h2>
      <p className="mb-4">
        A gente não aceita anúncio que prejudique a relação com o leitor: clickbait
        agressivo, jogo de azar online, cripto-golpe, infoproduto duvidoso.
        Independência editorial não é negociável — se rolar conflito de interesse,
        a redação avisa.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">Fale com a gente</h2>
      <p className="mb-2">
        <a href="mailto:comercial@zimbanet.com" className="text-zimba-blue underline font-bold">
          comercial@zimbanet.com
        </a>
      </p>
      <p className="mb-6">
        Manda nome, marca, ideia e mídia preferida. A gente responde com tabela e
        propostas em até 2 dias úteis.
      </p>

      <Link
        href="mailto:comercial@zimbanet.com"
        className="inline-flex items-center gap-2 bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.24em] font-bold px-6 h-11 hover:bg-navy hover:text-zimba-gold transition-colors"
      >
        Quero anunciar
      </Link>
    </InstitutionalShell>
  );
}

import type { Metadata } from "next";
import InstitutionalShell from "@/components/institutional-shell";

export const metadata: Metadata = {
  title: "Sobre o Zimbanet",
  description:
    "Quem somos, o que fazemos e por que existimos. Portal regional de Imbituba e do litoral sul de SC.",
};

export default function SobrePage() {
  return (
    <InstitutionalShell
      kicker="Institucional"
      title="Quem é o Zimbanet."
      intro="Portal regional de notícias e comunidade pra quem vive — ou se importa com — Imbituba e o litoral sul catarinense."
    >
      <h2 className="font-display font-bold text-fs-26 text-navy mt-8 mb-3">A missão</h2>
      <p className="mb-4">
        Conectar Imbituba e cidades vizinhas (Garopaba, Laguna, Imaruí, Paulo Lopes)
        com jornalismo regional acessível, comunidade ativa e prestação de serviço.
        A gente cobre o que o JN não cobre — e em PT-BR coloquial, do jeito que se
        fala na praia.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">A história</h2>
      <p className="mb-4">
        O Zimbanet nasce em 2026 como evolução do <strong>BOMBEI Imbituba</strong>,
        perfil que cobria a cidade no Instagram desde 2023. A marca segue o legado
        dos portais brasileiros dos anos 2000 — densos, cheios de manchete, com cara
        de jornal — mas com tecnologia e cuidado editorial atualizados.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">O que cobrimos</h2>
      <ul className="mb-4 list-disc pl-6 space-y-1">
        <li><strong>Cidade</strong> — prefeitura, câmara, urbanismo, serviços públicos</li>
        <li><strong>Política</strong> — câmara, executivo, Congresso quando bate na região</li>
        <li><strong>Esporte</strong> — Imbituba EC, surfe, futebol amador, vôlei de praia</li>
        <li><strong>Cultura</strong> — agenda, música, Fest Verão, manifestações</li>
        <li><strong>Polícia</strong> — segurança, ocorrências, operações</li>
        <li><strong>Praias</strong> — balneabilidade, ondas, fluxo de turismo, alertas</li>
      </ul>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">A comunidade</h2>
      <p className="mb-4">
        Duas seções abertas pra você participar: <strong>#zimbamilgrau</strong> (mural
        de fotos, opiniões, mil-grau do dia) e <strong>#bazardazimba</strong>
        (classificados regionais — vende, troca, doa, oferece serviço).
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">Fala com a gente</h2>
      <p className="mb-2">
        Pauta, denúncia, sugestão, pedido de retificação — manda em{" "}
        <a href="mailto:redacao@zimbanet.com" className="text-zimba-blue underline font-bold">
          redacao@zimbanet.com
        </a>{" "}
        ou pela página de <a href="/pauta" className="text-zimba-blue underline font-bold">envio de pauta</a>.
      </p>
      <p className="mb-2">
        Anúncio e parceria comercial: <a href="/anuncie" className="text-zimba-blue underline font-bold">/anuncie</a>.
      </p>
    </InstitutionalShell>
  );
}

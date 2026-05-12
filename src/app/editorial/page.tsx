import type { Metadata } from "next";
import InstitutionalShell from "@/components/institutional-shell";

export const metadata: Metadata = {
  title: "Estatuto editorial",
  description: "Princípios editoriais do ZIMBANET — independência, apuração, transparência e correção.",
};

export default function EditorialPage() {
  return (
    <InstitutionalShell
      kicker="Estatuto editorial"
      title="Como apuramos."
      intro="Princípios que guiam tudo que sai com a marca ZIMBANET — escritos pra você poder cobrar a gente quando a gente derrapar."
      updatedAt="10 de maio de 2026"
    >
      <h2 className="font-display font-bold text-fs-26 text-navy mt-8 mb-3">Independência</h2>
      <p className="mb-4">
        ZIMBANET é independente de partido, governo, igreja, clube ou patrocinador.
        Linha editorial é fechada pela redação — anunciante não escolhe pauta nem
        edita matéria. Conteúdo patrocinado, quando houver, é claramente identificado
        com a tag <strong>[PATROCINADO]</strong>.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">Apuração</h2>
      <ul className="mb-4 list-disc pl-6 space-y-1">
        <li>Denúncia precisa de fonte verificável — preferencialmente duas fontes independentes.</li>
        <li>Direito de resposta é oferecido a quem é citado, antes da publicação sempre que possível.</li>
        <li>Documento, áudio ou vídeo é checado quanto à origem antes de virar matéria.</li>
        <li>Boato de WhatsApp não vira matéria. Indício a apurar pode virar pauta interna.</li>
      </ul>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">Transparência</h2>
      <ul className="mb-4 list-disc pl-6 space-y-1">
        <li>Toda matéria assinada por nome real ou pela &ldquo;Redação Zimbanet&rdquo; quando for trabalho coletivo.</li>
        <li>Fonte é citada sempre que possível. Fonte anônima só quando há razão legítima (proteção do informante) e a redação conhece a identidade.</li>
        <li>Quando a matéria é gerada com apoio de inteligência artificial (sumarização, transcrição), isso é informado.</li>
      </ul>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">Correção</h2>
      <p className="mb-4">
        Erro acontece. Quando descobrimos um, corrigimos imediatamente e adicionamos
        nota explicando o que foi alterado e quando. Pedido de retificação:{" "}
        <a href="mailto:redacao@zimbanet.com" className="text-zimba-blue underline font-bold">redacao@zimbanet.com</a>.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">Pluralidade</h2>
      <p className="mb-4">
        Pauta de Imbituba e cidades vizinhas é prioridade — mas a gente também busca
        ouvir vozes plurais: comunidades tradicionais (pesca artesanal, povos
        originários da região), juventude periférica, associações de bairro, terceiro
        setor. O litoral não é só praia bonita pra turista.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">Comunidade</h2>
      <p className="mb-4">
        #zimbamilgrau e #bazardazimba são espaços abertos. Moderamos pra manter a
        conversa civilizada — não pra silenciar opinião divergente. Se sua opinião
        foi removida e você não entende o motivo, escreve pra gente.
      </p>
    </InstitutionalShell>
  );
}

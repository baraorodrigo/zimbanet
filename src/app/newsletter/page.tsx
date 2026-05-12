import type { Metadata } from "next";
import InstitutionalShell from "@/components/institutional-shell";
import NewsletterForm from "@/components/newsletter-form";

export const metadata: Metadata = {
  title: "Newsletter — boletim diário",
  description: "Inscreva-se no boletim diário do ZIMBANET. Manchetes de Imbituba e região direto no seu e-mail às 7h.",
};

export default function NewsletterPage() {
  return (
    <InstitutionalShell
      kicker="Newsletter"
      title="Imbituba na sua caixa de entrada."
      intro="Boletim diário com as principais manchetes do litoral sul de SC. Sai às 7h. Sem spam, sem clickbait — só o que vale a pena saber pra começar o dia."
    >
      <div className="my-8">
        <NewsletterForm variant="sidebar" />
      </div>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-8 mb-3">O que tem no boletim</h2>
      <ul className="mb-4 list-disc pl-6 space-y-1">
        <li>3–5 manchetes do dia (cidade, política, esporte, cultura, polícia, praias)</li>
        <li>Bloco &ldquo;Praia hoje&rdquo; — balneabilidade, ondas, fluxo (se for verão)</li>
        <li>Bloco &ldquo;Bazar da semana&rdquo; — destaques do classificado da comunidade</li>
        <li>Agenda do fim de semana (toda quinta)</li>
        <li>Sem patrocínio escondido. Quando tem anúncio, é bloco identificado.</li>
      </ul>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">Privacidade</h2>
      <p className="mb-4">
        Seu e-mail só é usado pra mandar o boletim — não é compartilhado, vendido
        nem cruzado com outras bases. Cancela a inscrição com 1 clique, a qualquer
        hora. Detalhes na <a href="/privacidade" className="text-zimba-blue underline font-bold">política de privacidade</a>.
      </p>
    </InstitutionalShell>
  );
}

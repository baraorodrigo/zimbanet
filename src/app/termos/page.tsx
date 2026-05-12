import type { Metadata } from "next";
import InstitutionalShell from "@/components/institutional-shell";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Regras de uso do portal ZIMBANET, comentários, bazar e mural #zimbamilgrau.",
};

export default function TermosPage() {
  return (
    <InstitutionalShell
      kicker="Termos de uso"
      title="As regras da casa."
      intro="O que você pode, o que não pode e o que esperar do Zimbanet quando usa este site, comenta, anuncia no bazar ou posta no #zimbamilgrau."
      updatedAt="10 de maio de 2026"
    >
      <h2 className="font-display font-bold text-fs-26 text-navy mt-8 mb-3">1. Aceitação</h2>
      <p className="mb-4">
        Ao usar o portal ZIMBANET (zimbanet.com) você concorda com estes termos
        e com a <a href="/privacidade" className="text-zimba-blue underline font-bold">política de privacidade</a>.
        Se discorda de algo, basta não usar o site.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">2. Conteúdo da redação</h2>
      <p className="mb-4">
        As matérias produzidas pela equipe ZIMBANET são protegidas por direito autoral.
        Você pode citar e linkar livremente — copiar matéria inteira em outro veículo,
        não. Para reprodução autorizada, fala com{" "}
        <a href="mailto:redacao@zimbanet.com" className="text-zimba-blue underline font-bold">redacao@zimbanet.com</a>.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">3. Conteúdo do usuário</h2>
      <p className="mb-3">
        Comentários em matérias, posts no #zimbamilgrau e anúncios no #bazardazimba
        são de responsabilidade de quem publica. Ao postar, você declara que tem o
        direito sobre o que está publicando e nos concede licença não exclusiva
        pra exibir o conteúdo no portal.
      </p>
      <p className="mb-2 font-bold">Não é permitido publicar:</p>
      <ul className="mb-4 list-disc pl-6 space-y-1">
        <li>Discurso de ódio, racismo, homofobia, xenofobia, machismo</li>
        <li>Ameaça, assédio, exposição de dados pessoais de terceiros</li>
        <li>Spam, propaganda enganosa, links maliciosos</li>
        <li>Conteúdo sexual, violento ou que envolva menores de forma inadequada</li>
        <li>Difamação, calúnia, fake news</li>
        <li>Produto ilegal, armas, drogas, animais silvestres</li>
      </ul>
      <p className="mb-4">
        Conteúdo que violar essas regras é removido. Reincidência leva a banimento
        da conta. Crimes são reportados às autoridades.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">4. Bazar da Zimba</h2>
      <p className="mb-4">
        O #bazardazimba é um classificado entre pessoas — o ZIMBANET não intermedeia
        venda, não recebe pagamento, não garante produto/serviço. Negocia direto com
        o anunciante e usa o bom-senso. Em caso de golpe, registra B.O. e nos avisa
        pra removermos o anúncio.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">5. Conta e segurança</h2>
      <p className="mb-4">
        Você é responsável pela segurança da sua conta. Não compartilhe credenciais.
        Se suspeitar que sua conta foi acessada indevidamente, fala com a gente.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">6. Responsabilidade</h2>
      <p className="mb-4">
        O ZIMBANET se esforça pra manter o portal no ar e os dados corretos, mas
        não garante disponibilidade ininterrupta nem se responsabiliza por decisões
        tomadas com base no conteúdo publicado. Sempre verifique informação crítica
        em fonte oficial.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">7. Foro</h2>
      <p className="mb-4">
        Eventuais disputas serão resolvidas no foro da comarca de Imbituba/SC.
      </p>
    </InstitutionalShell>
  );
}

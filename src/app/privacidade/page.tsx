import type { Metadata } from "next";
import InstitutionalShell from "@/components/institutional-shell";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description:
    "Como o Zimbanet coleta, usa e protege dados dos leitores e da comunidade. Conformidade com a LGPD (Lei 13.709/2018).",
};

export default function PrivacidadePage() {
  return (
    <InstitutionalShell
      kicker="Política de privacidade"
      title="Sua privacidade, na prática."
      intro="A gente coleta o mínimo necessário pra funcionar, explica o que faz com seus dados e respeita seus direitos como titular nos termos da LGPD."
      updatedAt="10 de maio de 2026"
    >
      <h2 className="font-display font-bold text-fs-26 text-navy mt-8 mb-3">1. Quem somos</h2>
      <p className="mb-4">
        ZIMBANET — portal regional de notícias e comunidade de Imbituba/SC. Para fins
        da LGPD (Lei nº 13.709/2018), somos o controlador dos dados que você compartilha
        ao usar este site. Contato do encarregado de dados:{" "}
        <a href="mailto:dpo@zimbanet.com" className="text-zimba-blue underline font-bold">dpo@zimbanet.com</a>.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">2. Que dados coletamos</h2>
      <ul className="mb-4 list-disc pl-6 space-y-1">
        <li><strong>Conta:</strong> nome, e-mail e telefone (se você se cadastrar via SMS) ou os dados básicos do Google/Facebook quando você opta por entrar com essas contas.</li>
        <li><strong>Newsletter:</strong> e-mail e horário da inscrição.</li>
        <li><strong>Comentários e bazar:</strong> texto que você publica, data e identificador da sua conta.</li>
        <li><strong>Notificações push:</strong> endpoint criptográfico fornecido pelo seu navegador (não identifica você diretamente) e editorias que você escolheu seguir.</li>
        <li><strong>Navegação:</strong> logs técnicos (IP, user-agent, páginas visitadas) por até 6 meses, pra segurança e prevenção a fraude.</li>
      </ul>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">3. Pra que usamos</h2>
      <ul className="mb-4 list-disc pl-6 space-y-1">
        <li>Entregar o conteúdo do portal e operar funcionalidades como comentário, bazar e push.</li>
        <li>Mandar a newsletter e alertas de breaking news que você pediu.</li>
        <li>Medir audiência de forma agregada — sem perfilamento individual pra publicidade.</li>
        <li>Cumprir obrigações legais (responder a autoridades quando exigido por lei).</li>
      </ul>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">4. Com quem compartilhamos</h2>
      <p className="mb-4">
        Operadores que processam dados em nosso nome (Supabase para base de dados e
        autenticação, Google para fonte OAuth) sob contrato. Não vendemos dados nem
        cedemos pra terceiros com finalidade comercial.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">5. Cookies</h2>
      <p className="mb-4">
        Usamos cookies estritamente necessários (sessão, preferências) e, quando ativada,
        analytics agregada. Você pode bloquear cookies no seu navegador — algumas funções
        (login, comentário) podem deixar de funcionar.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">6. Seus direitos</h2>
      <p className="mb-4">
        Como titular, você pode pedir <strong>acesso</strong>, <strong>correção</strong>,
        <strong> portabilidade</strong>, <strong>anonimização</strong> ou <strong>exclusão</strong>{" "}
        dos seus dados, além de <strong>revogar consentimento</strong> a qualquer momento.
        Manda pra{" "}
        <a href="mailto:dpo@zimbanet.com" className="text-zimba-blue underline font-bold">dpo@zimbanet.com</a>{" "}
        — respondemos em até 15 dias.
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">7. Retenção</h2>
      <p className="mb-4">
        Mantemos seus dados enquanto a conta existir. Se você apagar a conta, removemos
        os dados pessoais em até 30 dias, exceto registros mínimos exigidos por lei
        (Marco Civil da Internet — logs de acesso por 6 meses).
      </p>

      <h2 className="font-display font-bold text-fs-26 text-navy mt-10 mb-3">8. Mudanças</h2>
      <p className="mb-4">
        Atualizações desta política passam a valer na publicação. Mudanças relevantes
        serão sinalizadas no site e, se você for inscrito na newsletter, por e-mail.
      </p>
    </InstitutionalShell>
  );
}

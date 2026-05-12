// /push — landing pra capturar opt-in de notificações.

import Link from "next/link";
import { PushPrompt } from "@/components/push-prompt";

export const metadata = {
  title: "Receba alertas — ZIMBANET",
  description:
    "Notificações push do ZIMBANET. Imbituba conectada — breaking news, esporte, cultura.",
};

export default function PushOptInPage() {
  return (
    <main className="mx-auto max-w-[680px] px-6 py-16">
      <div className="mb-2 h-1 w-16 bg-zimba-gold" />
      <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.2em] text-zimba-gold">
        Alertas do ZIMBANET
      </p>
      <h1 className="mb-4 font-serif text-4xl leading-tight text-navy">
        Imbituba na palma da mão.
      </h1>
      <p className="mb-8 font-sans text-base leading-relaxed text-navy/75">
        Receba notificações no navegador quando rolar algo importante: porto, prefeitura,
        praias, esporte e mais. Sem spam — só o que merece interrompê-lo.
      </p>

      <PushPrompt />

      <p className="mt-10 font-sans text-xs leading-relaxed text-navy/60">
        Você pode revogar a qualquer momento nas configurações do navegador. Não compartilhamos
        nem vendemos seus dados.{" "}
        <Link href="/" className="underline decoration-zimba-gold underline-offset-4">
          Voltar para o portal
        </Link>
        .
      </p>
    </main>
  );
}

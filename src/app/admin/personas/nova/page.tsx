import Link from "next/link";
import { Header } from "../../_components/header";
import PersonaForm from "../form";

export const dynamic = "force-dynamic";

export default function NovaPersonaPage() {
  return (
    <>
      <Header
        kicker="Redação"
        title="Nova persona"
        sub="Crie uma nova voz pra redação. Pense em quando ela deve ser escolhida, qual o ângulo único dela e o que ela nunca faz."
      />
      <div className="mt-6 flex items-center gap-2">
        <Link
          href="/admin/personas"
          className="h-9 px-4 rounded-md border border-border-subtle text-ink-700 text-[11px] uppercase tracking-[0.22em] font-bold inline-flex items-center hover:border-navy hover:text-navy transition-colors"
        >
          ← Voltar
        </Link>
      </div>
      <div className="mt-6">
        <PersonaForm mode="create" />
      </div>
    </>
  );
}

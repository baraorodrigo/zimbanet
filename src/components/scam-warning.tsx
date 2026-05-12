import Icon from "./icon";

type Variant = "card" | "compact" | "inline";

type Props = {
  variant?: Variant;
  className?: string;
};

// Aviso anti-golpe — fixo em todo anúncio do bazar. ZIMBANET só hospeda o
// mural; quem combina entrega e pagamento são as partes. Mensagem direta,
// sem juridiquês, pra reduzir golpes em cidade pequena.
export default function ScamWarning({ variant = "card", className = "" }: Props) {
  if (variant === "inline") {
    return (
      <p
        className={`text-fs-12 text-ink-600 leading-relaxed ${className}`}
      >
        <strong className="text-alert-red font-bold">Cuidado:</strong> combine
        em pessoa, em local público. Nunca pague antes de ver o item.
      </p>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`border-l-4 border-alert-red bg-alert-red/5 px-3 py-2 text-fs-12 text-navy/85 leading-snug ${className}`}
        role="note"
      >
        <strong className="text-alert-red">Combine pessoalmente.</strong>{" "}
        Nunca pague antes de ver o item. ZIMBANET não intermedia negociações.
      </div>
    );
  }

  return (
    <div
      className={`border border-alert-red/40 bg-alert-red/5 rounded-md p-4 ${className}`}
      role="note"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-9 h-9 bg-alert-red text-off-white inline-flex items-center justify-center rounded-sm">
          <Icon name="alert" size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-display font-bold text-fs-15 text-navy mb-1.5 leading-tight">
            Combine pessoalmente. Nunca pague antes de ver.
          </p>
          <ul className="space-y-1 text-fs-13 text-navy/80 leading-snug">
            <li>
              Encontre em <strong>local público</strong> (praça, mercado,
              comércio).
            </li>
            <li>
              Veja o produto <strong>antes</strong> de transferir qualquer
              valor.
            </li>
            <li>
              Desconfie de <strong>preço muito abaixo</strong> da média.
            </li>
            <li>
              ZIMBANET <strong>não intermedia</strong> negociações nem garante
              pagamentos.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

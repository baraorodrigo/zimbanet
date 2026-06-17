export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Header: kicker + titulo + sub */}
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      {/* Link voltar */}
      <div className="mt-6 h-4 w-40 rounded bg-ink-100" />

      {/* Strip de meta cards (3 colunas) */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-md border border-border-subtle bg-white p-4">
            <div className="h-3 w-20 rounded bg-ink-100" />
            <div className="mt-2 h-6 w-2/3 rounded bg-ink-100" />
          </div>
        ))}
      </div>

      {/* Formulario: 3 fieldsets */}
      <div className="mt-8 grid gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-md border border-border-subtle bg-white p-5">
            <div className="h-3 w-32 rounded bg-zimba-gold/30" />
            <div className="mt-4 h-4 w-28 rounded bg-ink-100" />
            <div className="mt-2 h-11 w-full rounded-md bg-ink-100" />
            <div className="mt-4 h-4 w-24 rounded bg-ink-100" />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="h-16 rounded-md bg-ink-100" />
              <div className="h-16 rounded-md bg-ink-100" />
            </div>
          </div>
        ))}

        {/* Botao salvar */}
        <div className="h-12 w-48 rounded-md bg-ink-100" />
      </div>

      {/* Zona perigosa: 2 cards */}
      <div className="mt-12 rounded-md border-2 border-border-subtle bg-off-white p-5">
        <div className="h-5 w-40 rounded bg-ink-100" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-md border border-border-subtle bg-white p-4">
              <div className="h-4 w-28 rounded bg-ink-100" />
              <div className="mt-2 h-3 w-full rounded bg-ink-100" />
              <div className="mt-1 h-3 w-5/6 rounded bg-ink-100" />
              <div className="mt-3 h-9 w-28 rounded-md bg-ink-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

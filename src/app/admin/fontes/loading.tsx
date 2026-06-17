export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      {/* Barra de acoes: texto de ajuda + botao "Nova fonte" */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="h-4 w-2/5 rounded bg-ink-100" />
        <div className="h-10 w-32 rounded-md bg-ink-100" />
      </div>

      {/* Grade de cards de fonte */}
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border-2 border-border-subtle bg-white p-5">
            {/* Badges + bloco "coletados" */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-12 rounded bg-ink-100" />
                  <div className="h-4 w-16 rounded bg-ink-100" />
                  <div className="h-4 w-12 rounded bg-ink-100" />
                </div>
                <div className="mt-2 h-6 w-1/2 rounded bg-ink-100" />
                <div className="mt-2 h-3 w-2/3 rounded bg-ink-100" />
                <div className="mt-1 h-3 w-3/4 rounded bg-ink-100" />
              </div>
              <div className="shrink-0 text-right">
                <div className="h-3 w-16 rounded bg-ink-100" />
                <div className="mt-1 h-6 w-10 rounded bg-ink-100" />
              </div>
            </div>

            {/* Linhas de status / hit rate de foto */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="h-3 w-28 rounded bg-ink-100" />
              <div className="h-3 w-10 rounded bg-ink-100" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="h-3 w-20 rounded bg-ink-100" />
              <div className="h-3 w-16 rounded bg-ink-100" />
            </div>

            {/* Acoes */}
            <div className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-3">
              <div className="h-8 w-20 rounded-md bg-ink-100" />
              <div className="h-8 w-20 rounded-md bg-ink-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

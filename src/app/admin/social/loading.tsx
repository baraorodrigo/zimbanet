export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      {/* Abas de status (Pendentes / Aprovados / Publicados / Descartados) */}
      <div className="mt-8 border-b border-border-subtle flex gap-6 overflow-x-auto pb-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shrink-0">
            <div className="h-4 w-24 rounded bg-ink-100" />
            <div className="mt-2 h-2 w-16 rounded bg-ink-100" />
          </div>
        ))}
      </div>

      {/* Grupos de matéria, cada um com linhas de post */}
      <div className="mt-8 space-y-8">
        {[0, 1].map((g) => (
          <div key={g} className="rounded-md border-2 border-border-subtle bg-white overflow-hidden">
            {/* Cabeçalho do grupo */}
            <div className="border-b border-border-subtle bg-off-white p-5">
              <div className="h-3 w-32 rounded bg-zimba-gold/30" />
              <div className="mt-2 h-5 w-2/3 rounded bg-ink-100" />
              <div className="mt-3 flex gap-2">
                <div className="h-9 w-36 rounded-md bg-ink-100" />
                <div className="h-9 w-40 rounded-md bg-ink-100" />
              </div>
            </div>

            {/* Linhas de post: thumb + caption + ações */}
            <div className="divide-y divide-border-subtle">
              {[0, 1].map((r) => (
                <div key={r} className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[200px_1fr_180px]">
                  <div>
                    <div className="h-4 w-32 rounded bg-ink-100" />
                    <div className="mt-1 h-2 w-20 rounded bg-ink-100" />
                    <div className="mt-3 aspect-square w-full rounded-md bg-ink-100" />
                  </div>
                  <div>
                    <div className="h-4 w-full rounded bg-ink-100" />
                    <div className="mt-2 h-4 w-5/6 rounded bg-ink-100" />
                    <div className="mt-2 h-4 w-2/3 rounded bg-ink-100" />
                    <div className="mt-4 h-3 w-1/2 rounded bg-ink-100" />
                  </div>
                  <div className="flex gap-2 md:flex-col">
                    <div className="h-10 w-full rounded-md bg-ink-100" />
                    <div className="h-10 w-full rounded-md bg-ink-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

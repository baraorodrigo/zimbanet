export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Header: kicker + título + sub */}
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      {/* Tabs por decisão */}
      <div className="mt-6 flex gap-2 flex-wrap">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-28 rounded-md bg-ink-100" />
        ))}
      </div>

      {/* Linha de filtros: busca + select + botão */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="h-11 w-full sm:max-w-[340px] rounded-md bg-ink-100" />
        <div className="h-11 w-full sm:w-[200px] rounded-md bg-ink-100" />
        <div className="h-11 w-28 rounded-md bg-ink-100" />
      </div>

      {/* Lista de cards de pauta (thumb + corpo + ações) */}
      <div className="mt-8 grid gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-md border-2 border-border-subtle bg-white p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[140px_1fr] md:grid-cols-[160px_1fr_auto] gap-4 sm:gap-5"
          >
            <div className="aspect-[16/9] sm:aspect-square rounded-md bg-ink-100" />
            <div className="min-w-0">
              <div className="h-3 w-40 rounded bg-ink-100" />
              <div className="mt-2 h-7 w-3/4 rounded bg-ink-100" />
              <div className="mt-2 h-4 w-full rounded bg-ink-100" />
              <div className="mt-1 h-4 w-5/6 rounded bg-ink-100" />
              <div className="mt-3 grid grid-cols-3 gap-3 max-w-[520px]">
                <div className="h-6 rounded bg-ink-100" />
                <div className="h-6 rounded bg-ink-100" />
                <div className="h-6 rounded bg-ink-100" />
              </div>
            </div>
            <div className="hidden md:flex md:flex-col gap-2 md:w-[180px]">
              <div className="h-10 rounded-md bg-ink-100" />
              <div className="h-10 rounded-md bg-ink-100" />
              <div className="h-10 rounded-md bg-ink-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

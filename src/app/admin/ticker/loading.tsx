export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Lista de mensagens */}
        <section>
          <div className="h-5 w-40 rounded bg-ink-100" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-md border-2 border-border-subtle bg-white p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-16 rounded bg-zimba-gold/30" />
                      <div className="h-3 w-12 rounded bg-ink-100" />
                      <div className="h-3 w-14 rounded bg-ink-100" />
                    </div>
                    <div className="mt-3 h-4 w-5/6 rounded bg-ink-100" />
                    <div className="mt-2 h-3 w-1/3 rounded bg-ink-100" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="h-8 w-20 rounded bg-ink-100" />
                    <div className="h-8 w-20 rounded bg-ink-100" />
                    <div className="h-8 w-20 rounded bg-ink-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Formulario (criar/editar) */}
        <aside>
          <div className="rounded-md border-2 border-border-subtle bg-white p-5">
            <div className="h-5 w-36 rounded bg-ink-100" />
            <div className="mt-4 h-20 w-full rounded-md bg-ink-100" />
            <div className="mt-4 h-11 w-full rounded-md bg-ink-100" />
            <div className="mt-4 h-11 w-full rounded-md bg-ink-100" />
            <div className="mt-4 h-11 w-full rounded-md bg-ink-100" />
            <div className="mt-6 h-10 w-32 rounded-md bg-ink-100" />
          </div>
          <div className="mt-4 rounded-md border-2 border-border-subtle bg-off-white p-4">
            <div className="h-4 w-28 rounded bg-ink-100" />
            <div className="mt-3 h-3 w-full rounded bg-ink-100" />
            <div className="mt-2 h-3 w-5/6 rounded bg-ink-100" />
          </div>
        </aside>
      </div>
    </div>
  );
}

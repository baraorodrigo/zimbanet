export default function Loading() {
  return (
    <div className="animate-pulse space-y-10">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      {[0, 1, 2].map((s) => (
        <section key={s}>
          <div className="mb-4 flex items-baseline gap-3">
            <span className="h-[3px] w-8 bg-zimba-gold" aria-hidden />
            <div className="h-6 w-56 rounded bg-ink-100" />
            <div className="h-4 w-8 rounded bg-ink-100" />
          </div>

          <div className="space-y-3">
            {[0, 1].map((c) => (
              <div
                key={c}
                className="rounded-md border border-border-subtle bg-white p-5"
              >
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <div className="h-4 w-32 rounded bg-ink-100" />
                  <div className="h-3 w-20 rounded bg-ink-100" />
                  <div className="h-3 w-24 rounded bg-ink-100" />
                </div>
                <div className="mb-2 h-4 w-full rounded bg-ink-100" />
                <div className="mb-4 h-4 w-5/6 rounded bg-ink-100" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-9 w-28 rounded bg-ink-100" />
                  <div className="h-9 w-28 rounded bg-ink-100" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

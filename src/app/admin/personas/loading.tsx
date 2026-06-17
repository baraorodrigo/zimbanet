export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="h-4 w-2/3 max-w-[60ch] rounded bg-ink-100" />
        <div className="h-10 w-40 rounded-md bg-ink-100" />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-md border-2 border-border-subtle bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-8 rounded bg-ink-100" />
                  <div className="h-4 w-14 rounded bg-ink-100" />
                </div>
                <div className="mt-2 h-6 w-1/2 rounded bg-ink-100" />
                <div className="mt-2 h-3 w-28 rounded bg-ink-100" />
                <div className="mt-3 h-4 w-5/6 rounded bg-ink-100" />
              </div>
              <div className="shrink-0">
                <div className="h-3 w-16 rounded bg-ink-100" />
                <div className="mt-2 h-6 w-10 rounded bg-ink-100" />
              </div>
            </div>

            <div className="mt-3 h-4 w-full rounded bg-ink-100" />
            <div className="mt-2 h-4 w-4/5 rounded bg-ink-100" />

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

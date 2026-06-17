export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <div className="mt-8 rounded-md border-2 border-border-subtle bg-white p-5">
        <div className="h-5 w-48 rounded bg-ink-100" />
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="h-11 w-full rounded-md bg-off-white" />
          <div className="h-11 w-full rounded-md bg-off-white" />
          <div className="h-11 w-32 rounded-md bg-ink-100" />
        </div>
      </div>

      <div className="mt-10">
        <div className="h-5 w-56 rounded bg-ink-100" />
        <div className="mt-4 grid gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-md border-2 border-border-subtle bg-white p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-32 rounded bg-ink-100" />
                  <div className="h-4 w-20 rounded bg-off-white" />
                  <div className="h-4 w-16 rounded bg-off-white" />
                </div>
                <div className="mt-2 h-3 w-48 rounded bg-ink-100" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-24 rounded-md bg-off-white" />
                <div className="h-9 w-20 rounded-md bg-off-white" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

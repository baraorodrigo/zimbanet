export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <div className="mt-8 space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-md border-2 border-border-subtle bg-white p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[160px_1fr] md:grid-cols-[160px_1fr_auto] gap-4 sm:gap-5"
          >
            <div className="aspect-[16/9] sm:aspect-square rounded-md bg-ink-100" />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-3 w-20 rounded bg-ink-100" />
                <div className="h-3 w-28 rounded bg-ink-100" />
              </div>
              <div className="mt-3 h-3 w-24 rounded bg-ink-100" />
              <div className="mt-2 h-6 w-3/4 rounded bg-ink-100" />
              <div className="mt-3 h-4 w-full rounded bg-ink-100" />
              <div className="mt-2 h-4 w-5/6 rounded bg-ink-100" />
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:w-[180px] shrink-0">
              <div className="h-10 w-full rounded-md bg-ink-100" />
              <div className="h-10 w-full rounded-md bg-ink-100" />
              <div className="h-10 w-full rounded-md bg-ink-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-md border-2 border-border-subtle bg-white p-5">
            <div className="h-3 w-20 rounded bg-ink-100" />
            <div className="mt-3 h-8 w-1/2 rounded bg-ink-100" />
            <div className="mt-3 h-3 w-2/3 rounded bg-ink-100" />
          </div>
        ))}
      </div>

      <div className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <div className="h-6 w-40 rounded bg-ink-100" />
            <div className="mt-2 h-3 w-64 rounded bg-ink-100" />
          </div>
          <div className="h-10 w-32 rounded-md bg-ink-100" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-md border-2 border-border-subtle bg-white p-5">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded bg-ink-100" />
                <div className="flex-1">
                  <div className="h-5 w-1/3 rounded bg-ink-100" />
                  <div className="mt-2 h-3 w-1/4 rounded bg-ink-100" />
                </div>
                <div className="h-6 w-16 rounded bg-ink-100" />
              </div>
              <div className="mt-3 h-4 w-5/6 rounded bg-ink-100" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="h-10 rounded bg-ink-100" />
                <div className="h-10 rounded bg-ink-100" />
              </div>
              <div className="mt-5 h-10 w-full rounded-md bg-ink-100" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <div className="border-b border-border-subtle pb-3">
          <div className="h-6 w-48 rounded bg-ink-100" />
          <div className="mt-2 h-3 w-72 rounded bg-ink-100" />
        </div>

        <div className="mt-4 rounded-md border border-border-subtle bg-white">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="grid grid-cols-[150px_1fr_auto] items-baseline gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0"
            >
              <div className="h-6 w-24 rounded bg-ink-100" />
              <div>
                <div className="h-4 w-2/3 rounded bg-ink-100" />
                <div className="mt-2 h-3 w-1/4 rounded bg-ink-100" />
              </div>
              <div className="h-3 w-20 rounded bg-ink-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

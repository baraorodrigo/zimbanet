export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <div className="mt-6 h-[76px] rounded-md border-2 border-border-subtle bg-off-white" />

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-md border border-border-subtle bg-off-white p-4">
            <div className="h-3 w-20 rounded bg-ink-100" />
            <div className="mt-3 h-10 w-12 rounded bg-ink-100" />
          </div>
        ))}
      </div>

      <div className="mt-12">
        <div className="mb-4 h-6 w-48 rounded border-b border-border-subtle bg-ink-100" />
        <div className="divide-y divide-border-subtle">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[80px_1fr_auto] items-center gap-4 py-3">
              <div className="h-6 w-20 rounded bg-ink-100" />
              <div>
                <div className="h-4 w-2/3 rounded bg-ink-100" />
                <div className="mt-2 h-3 w-1/3 rounded bg-ink-100" />
              </div>
              <div className="h-4 w-4 rounded bg-ink-100" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <div className="mb-4 h-6 w-40 rounded border-b border-border-subtle bg-ink-100" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-md border-2 border-border-subtle bg-off-white p-4">
              <div className="h-7 w-10 rounded bg-ink-100" />
              <div className="mt-2 h-4 w-2/3 rounded bg-ink-100" />
              <div className="mt-2 h-3 w-full rounded bg-ink-100" />
              <div className="mt-3 h-10 w-full rounded-md bg-ink-100" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-md border-2 border-border-subtle bg-off-white p-5">
            <div className="h-5 w-1/3 rounded bg-ink-100" />
            <div className="mt-2 h-4 w-full rounded bg-ink-100" />
            <div className="mt-4 h-4 w-28 rounded bg-ink-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

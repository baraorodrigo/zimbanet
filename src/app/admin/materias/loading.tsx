export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-20 rounded bg-ink-100" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-40 rounded-md bg-ink-100" />
          <div className="h-10 w-36 rounded-md bg-ink-100" />
        </div>
      </div>

      <div className="mt-6 rounded-md border border-border-subtle bg-white overflow-hidden">
        <div className="divide-y divide-border-subtle">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="grid grid-cols-[80px_1fr_140px_120px_140px] gap-4 items-center px-4 py-4"
            >
              <div className="h-6 w-16 rounded bg-ink-100" />
              <div className="min-w-0">
                <div className="h-4 w-2/3 rounded bg-ink-100" />
                <div className="mt-2 h-3 w-24 rounded bg-off-white" />
              </div>
              <div className="h-4 w-20 rounded bg-ink-100" />
              <div className="h-3 w-16 rounded bg-ink-100" />
              <div className="ml-auto h-3 w-24 rounded bg-ink-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

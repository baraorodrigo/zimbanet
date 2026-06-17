export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="h-9 w-28 rounded-md bg-ink-100" />
        <div className="h-4 w-48 rounded bg-ink-100" />
        <div className="ml-auto h-9 w-24 rounded-md bg-ink-100" />
      </div>

      <div className="mt-6 grid gap-6 rounded-md border-2 border-border-subtle bg-white p-6">
        <div>
          <div className="h-3 w-40 rounded bg-ink-100" />
          <div className="mt-2 h-20 w-full rounded-md bg-off-white" />
        </div>

        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2">
            <div className="h-2.5 w-28 rounded bg-zimba-gold/30" />
            <div className="h-5 w-1/3 rounded bg-ink-100" />
            <div className="h-4 w-2/3 rounded bg-ink-100" />
            <div className="mt-1 h-40 w-full rounded-md bg-off-white" />
          </div>
        ))}

        <div className="grid gap-4 border-t border-border-subtle pt-2 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="h-3 w-24 rounded bg-ink-100" />
              <div className="mt-1 h-28 w-full rounded-md bg-off-white" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-border-subtle pt-2">
          <div className="h-11 w-48 rounded-md bg-ink-100" />
          <div className="h-4 w-1/3 rounded bg-ink-100" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-md border-2 border-border-subtle bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="h-3 w-20 rounded bg-zimba-gold/30" />
                <div className="mt-2 h-6 w-40 rounded bg-ink-100" />
              </div>
              <div className="h-6 w-24 rounded bg-ink-100" />
            </div>

            <div className="mt-3 h-4 w-5/6 rounded bg-ink-100" />

            <div className="mt-5 h-3 w-16 rounded bg-ink-100" />
            <div className="mt-2 h-11 w-full rounded-md border-2 border-border-subtle bg-off-white" />

            <div className="mt-4 h-3 w-40 rounded bg-ink-100" />
            <div className="mt-2 h-11 w-full rounded-md border-2 border-border-subtle bg-off-white" />

            <div className="mt-4 h-3 w-28 rounded bg-ink-100" />
            <div className="mt-2 h-11 w-full rounded-md border-2 border-border-subtle bg-off-white" />

            <div className="mt-5 flex items-center gap-3">
              <div className="h-10 w-28 rounded-md bg-ink-100" />
              <div className="h-10 w-28 rounded-md bg-ink-100" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-md border-2 border-dashed border-border-subtle bg-white p-5">
        <div className="h-5 w-40 rounded bg-ink-100" />
        <div className="mt-4 space-y-2.5">
          <div className="h-4 w-full max-w-[70ch] rounded bg-ink-100" />
          <div className="h-4 w-11/12 rounded bg-ink-100" />
          <div className="h-4 w-10/12 rounded bg-ink-100" />
          <div className="h-4 w-3/4 rounded bg-ink-100" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="h-10 w-40 rounded-md bg-ink-100" />
        <div className="h-9 w-36 rounded-md bg-ink-100" />
        <div className="h-9 w-28 rounded-md bg-ink-100" />
        <div className="ml-auto h-9 w-24 rounded-md bg-ink-100" />
      </div>

      <div className="mt-8 space-y-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-md border-2 border-border-subtle bg-white p-5"
          >
            <div className="h-3 w-28 rounded bg-zimba-gold/30" />
            <div className="mt-2 h-6 w-1/2 rounded bg-ink-100" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="h-24 rounded-md bg-off-white" />
              <div className="h-24 rounded-md bg-off-white" />
            </div>
            <div className="mt-4 h-11 w-40 rounded-md bg-ink-100" />
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-md border border-border-subtle bg-white p-5">
        <div className="h-5 w-56 rounded bg-ink-100" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <div className="mt-6 flex items-center gap-2">
        <div className="h-9 w-28 rounded-md bg-ink-100" />
        <div className="h-4 w-32 rounded bg-ink-100" />
        <div className="ml-auto h-9 w-24 rounded-md bg-ink-100" />
      </div>

      <div className="mt-6 grid gap-5 rounded-md border-2 border-border-subtle bg-white p-6">
        <div className="grid gap-5 md:grid-cols-[1fr_140px]">
          <div>
            <div className="h-3 w-32 rounded bg-ink-100" />
            <div className="mt-1 h-11 w-full rounded-md bg-off-white border-2 border-border-subtle" />
          </div>
          <div>
            <div className="h-3 w-16 rounded bg-ink-100" />
            <div className="mt-1 h-11 w-full rounded-md bg-off-white border-2 border-border-subtle" />
          </div>
        </div>

        <div>
          <div className="h-3 w-28 rounded bg-ink-100" />
          <div className="mt-1 h-11 w-full rounded-md bg-off-white border-2 border-border-subtle" />
        </div>

        <div>
          <div className="h-3 w-24 rounded bg-ink-100" />
          <div className="mt-1 h-11 w-full rounded-md bg-off-white border-2 border-border-subtle" />
        </div>

        <div>
          <div className="h-3 w-40 rounded bg-ink-100" />
          <div className="mt-1 h-24 w-full rounded-md bg-off-white border-2 border-border-subtle" />
        </div>

        <div>
          <div className="h-3 w-48 rounded bg-ink-100" />
          <div className="mt-1 h-64 w-full rounded-md bg-off-white border-2 border-border-subtle" />
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
          <div className="h-11 w-44 rounded-md bg-ink-100" />
          <div className="h-11 w-28 rounded-md bg-ink-100" />
        </div>
      </div>
    </div>
  );
}

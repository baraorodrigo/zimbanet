export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border-subtle pb-6">
        <div className="h-3 w-24 rounded bg-zimba-gold/30" />
        <div className="mt-2 h-10 w-2/3 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-[60ch] rounded bg-ink-100" />
      </div>

      <ol className="mt-8 ml-3 border-l-2 border-border-subtle">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="relative pl-6 pb-6">
            <span className="absolute -left-[7px] top-2 h-3 w-3 rounded-full bg-ink-100" />
            <div className="rounded-md border border-border-subtle bg-white p-4">
              <div className="flex items-center gap-2">
                <div className="h-5 w-28 rounded bg-ink-100" />
                <div className="h-3 w-16 rounded bg-ink-100" />
                <div className="ml-auto h-3 w-24 rounded bg-ink-100" />
              </div>
              <div className="mt-3 h-4 w-3/4 rounded bg-ink-100" />
              <div className="mt-3 flex items-center gap-4">
                <div className="h-3 w-32 rounded bg-ink-100" />
                <div className="h-3 w-20 rounded bg-ink-100" />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Loading UI do Estúdio — segue o grid 3-col do canvas-shell pra evitar
// jump de layout quando os dados chegam.
export default function Loading() {
  return (
    <div className="-mx-6 lg:-mx-10 -my-8 lg:-my-10 min-h-[calc(100vh-1px)]">
      <div className="grid xl:grid-cols-[260px_1fr_360px] grid-cols-1 min-h-[calc(100vh-1px)]">
        {/* Channel rail skeleton */}
        <aside className="border-r border-border-subtle bg-white p-5 hidden xl:block">
          <div className="h-3 w-24 bg-ink-100 rounded animate-pulse" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[88px] rounded-md bg-ink-100 animate-pulse"
              />
            ))}
          </div>
        </aside>

        {/* Canvas skeleton */}
        <section className="bg-off-white p-8 lg:p-10 flex flex-col items-center">
          <div className="w-full max-w-[420px]">
            <div className="aspect-square rounded-lg bg-ink-100 animate-pulse" />
            <div className="mt-6 h-32 rounded-md bg-white border border-border-subtle animate-pulse" />
            <div className="mt-3 h-16 rounded-md bg-white border border-border-subtle animate-pulse" />
          </div>
        </section>

        {/* Properties skeleton */}
        <aside className="border-l border-border-subtle bg-white p-5 hidden xl:block">
          <div className="h-3 w-20 bg-ink-100 rounded animate-pulse" />
          <div className="mt-4 space-y-2">
            <div className="h-9 rounded bg-ink-100 animate-pulse" />
            <div className="h-9 rounded bg-ink-100 animate-pulse" />
            <div className="h-9 rounded bg-ink-100 animate-pulse" />
          </div>
        </aside>
      </div>
    </div>
  );
}

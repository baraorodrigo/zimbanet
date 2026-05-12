import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

// Skeleton do #bazardazimba: cabeçalho + filtros + grid de anúncios
export default function Loading() {
  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />
      <main className="zb-container pb-20 animate-pulse">
        {/* Cabeçalho */}
        <header className="pt-10 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-end">
            <div className="space-y-4">
              <div className="h-3 w-28 bg-ink-50 rounded" />
              <div className="h-20 w-2/3 bg-ink-50 rounded-md" />
              <div className="h-5 w-3/4 bg-ink-50 rounded" />
            </div>
            <div className="flex gap-3 lg:justify-end">
              <div className="h-12 w-40 bg-ink-50 rounded" />
              <div className="h-12 w-40 bg-ink-50 rounded" />
            </div>
          </div>
        </header>

        {/* Filtros */}
        <div className="mb-8 border-y border-border-subtle py-4">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-24 bg-ink-50 rounded" />
              ))}
            </div>
            <div className="h-10 w-full lg:w-72 bg-ink-50 rounded-md" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 lg:gap-10">
          <aside className="min-w-0 space-y-6">
            <div className="zb-side-card space-y-2">
              <div className="h-3 w-24 bg-ink-50 rounded" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 w-full bg-ink-50 rounded" />
              ))}
            </div>
          </aside>

          {/* Grid de anúncios */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <article key={i} className="bg-white border border-border-subtle">
                <div className="aspect-square bg-ink-50" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-full bg-ink-50 rounded" />
                  <div className="h-4 w-3/4 bg-ink-50 rounded" />
                  <div className="h-5 w-1/3 bg-ink-50 rounded mt-2" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

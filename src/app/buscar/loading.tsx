import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

// Skeleton da busca: barra + lista de resultados + sidebar
export default function Loading() {
  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />
      <main className="zb-container pb-16 animate-pulse">
        <header className="pt-8 pb-6 border-b border-border-subtle mb-8 space-y-4">
          <div className="h-3 w-16 bg-ink-50 rounded" />
          <div className="h-10 w-1/2 bg-ink-50 rounded-md" />
          {/* Barra de busca */}
          <div className="h-12 w-full max-w-xl bg-white border border-border-subtle rounded-sm flex items-center px-4">
            <div className="h-4 w-1/2 bg-ink-50 rounded" />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 lg:gap-12">
          <section className="min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white border border-border-subtle rounded-md overflow-hidden">
                  <div className="aspect-[16/10] bg-ink-50" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 w-1/4 bg-ink-50 rounded" />
                    <div className="h-5 w-full bg-ink-50 rounded" />
                    <div className="h-5 w-4/5 bg-ink-50 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="min-w-0 space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="zb-side-card space-y-2">
                <div className="h-3 w-24 bg-ink-50 rounded" />
                <div className="h-4 w-full bg-ink-50 rounded" />
                <div className="h-4 w-2/3 bg-ink-50 rounded" />
              </div>
            ))}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

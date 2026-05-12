import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

// Skeleton da tag: cabeçalho + grid 2 colunas + sidebar
export default function Loading() {
  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />
      <main className="zb-container pb-16 animate-pulse">
        <div className="pt-6 pb-3">
          <div className="h-3 w-32 bg-ink-50 rounded" />
        </div>

        <header className="pb-6 mb-8 border-b border-border-subtle space-y-3">
          <div className="h-3 w-16 bg-ink-50 rounded" />
          <div className="h-10 w-1/3 bg-ink-50 rounded-md" />
          <div className="h-3 w-1/4 bg-ink-50 rounded" />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 lg:gap-12">
          <section className="min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border border-border-subtle rounded-md overflow-hidden">
                  <div className="aspect-[16/10] bg-ink-50" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 w-1/3 bg-ink-50 rounded" />
                    <div className="h-5 w-full bg-ink-50 rounded" />
                    <div className="h-5 w-5/6 bg-ink-50 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="min-w-0 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
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

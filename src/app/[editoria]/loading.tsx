import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

// Skeleton da página de editoria: cabeçalho + lead + three-up + lista
export default function Loading() {
  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />
      <main className="zb-container pb-12 animate-pulse">
        {/* Cabeçalho */}
        <header className="border-b border-border-subtle pb-6 pt-8 mb-8">
          <div className="flex items-center gap-3">
            <span className="h-[3px] w-10 bg-zimba-gold" aria-hidden />
            <div className="h-3 w-24 bg-ink-50 rounded-xs" />
          </div>
          <div className="mt-4 h-12 w-2/3 bg-ink-50 rounded-md" />
          <div className="mt-4 h-4 w-3/4 bg-ink-50 rounded-md" />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-10">
          <div className="min-w-0">
            {/* Lead */}
            <div className="mb-10 bg-white border border-border-subtle rounded-md overflow-hidden">
              <div className="aspect-[16/9] bg-ink-50" />
              <div className="p-5 space-y-3">
                <div className="h-3 w-20 bg-ink-50 rounded" />
                <div className="h-6 w-full bg-ink-50 rounded" />
                <div className="h-6 w-5/6 bg-ink-50 rounded" />
              </div>
            </div>

            {/* Three-up */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-border-subtle rounded-md overflow-hidden">
                  <div className="aspect-[16/10] bg-ink-50" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 w-1/3 bg-ink-50 rounded" />
                    <div className="h-4 w-full bg-ink-50 rounded" />
                    <div className="h-4 w-4/5 bg-ink-50 rounded" />
                  </div>
                </div>
              ))}
            </div>

            {/* Lista */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border border-border-subtle rounded-md p-4 space-y-2">
                  <div className="h-3 w-20 bg-ink-50 rounded" />
                  <div className="h-5 w-full bg-ink-50 rounded" />
                  <div className="h-5 w-3/4 bg-ink-50 rounded" />
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
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

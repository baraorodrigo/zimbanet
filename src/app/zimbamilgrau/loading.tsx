import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

// Skeleton do #zimbamilgrau: hero navy + composer + feed de cards
export default function Loading() {
  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />

      {/* Hero navy */}
      <section className="bg-navy">
        <div className="zb-container py-14 lg:py-20 animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-12 items-end">
            <div className="space-y-5">
              <div className="h-3 w-28 bg-off-white/15 rounded" />
              <div className="h-20 w-2/3 bg-off-white/15 rounded-md" />
              <div className="h-20 w-1/2 bg-zimba-gold/20 rounded-md" />
              <div className="h-4 w-3/4 bg-off-white/10 rounded" />
            </div>
            <div className="space-y-3">
              <div className="h-3 w-24 bg-off-white/15 rounded" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-7 w-20 bg-zimba-gold/15 rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="zb-container pb-16 animate-pulse">
        {/* Composer */}
        <div className="my-8 bg-white border border-border-subtle rounded-md p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-ink-50 rounded-full" />
            <div className="h-4 w-1/3 bg-ink-50 rounded" />
          </div>
          <div className="h-20 w-full bg-ink-50 rounded" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-10">
          <div className="min-w-0">
            {/* Filtros bairro */}
            <div className="mb-6 flex flex-wrap gap-2 pb-4 border-b border-border-subtle">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 w-20 bg-ink-50 rounded" />
              ))}
            </div>

            {/* Feed */}
            <ul className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="bg-white border border-border-subtle rounded-md p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-ink-50 rounded-full" />
                    <div className="h-3 w-32 bg-ink-50 rounded" />
                  </div>
                  <div className="h-4 w-full bg-ink-50 rounded" />
                  <div className="h-4 w-5/6 bg-ink-50 rounded" />
                </li>
              ))}
            </ul>
          </div>

          <aside className="space-y-4">
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

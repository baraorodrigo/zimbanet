import SiteHeader from "@/components/site-header";

export default function Loading() {
  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />
      <main className="zb-container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
          <div className="space-y-6">
            {/* Hero skeleton */}
            <div className="rounded-md bg-white border border-border-subtle p-6 space-y-4">
              <div className="h-3 w-24 bg-zimba-gold/30 rounded-xs" />
              <div className="h-12 w-full bg-navy/10 rounded-sm" />
              <div className="h-12 w-3/4 bg-navy/10 rounded-sm" />
              <div className="h-3 w-2/3 bg-ink-200 rounded-xs" />
              <div className="h-3 w-1/2 bg-ink-200 rounded-xs" />
              <div className="aspect-[16/9] w-full bg-ink-100 rounded-md mt-4" />
            </div>
            {/* Card grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-md bg-white border border-border-subtle p-4 space-y-3">
                  <div className="aspect-[16/10] w-full bg-ink-100 rounded-sm" />
                  <div className="h-3 w-16 bg-zimba-gold/30 rounded-xs" />
                  <div className="h-5 w-full bg-navy/10 rounded-xs" />
                  <div className="h-5 w-4/5 bg-navy/10 rounded-xs" />
                </div>
              ))}
            </div>
          </div>
          <aside className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-md bg-white border border-border-subtle p-5 space-y-3">
                <div className="h-3 w-20 bg-zimba-gold/30 rounded-xs" />
                <div className="h-4 w-full bg-navy/10 rounded-xs" />
                <div className="h-4 w-3/4 bg-navy/10 rounded-xs" />
              </div>
            ))}
          </aside>
        </div>
      </main>
      <span className="sr-only" role="status" aria-live="polite">
        Carregando matérias…
      </span>
    </div>
  );
}

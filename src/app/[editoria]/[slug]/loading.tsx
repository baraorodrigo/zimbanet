import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

// Skeleton da matéria: breadcrumb + título + hero + corpo + sidebar
export default function Loading() {
  return (
    <div className="min-h-screen bg-off-white">
      <SiteHeader />
      <main className="zb-container pb-16 animate-pulse">
        {/* Breadcrumb */}
        <div className="pt-6 pb-3">
          <div className="h-3 w-40 bg-ink-50 rounded" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 lg:gap-12">
          <article className="min-w-0">
            {/* Header */}
            <header className="mb-8 border-b border-border-subtle pb-8 space-y-4">
              <div className="h-3 w-24 bg-ink-50 rounded" />
              <div className="h-12 w-full bg-ink-50 rounded-md" />
              <div className="h-12 w-4/5 bg-ink-50 rounded-md" />
              <div className="h-5 w-3/4 bg-ink-50 rounded mt-3" />
              <div className="flex gap-3 mt-4">
                <div className="h-3 w-28 bg-ink-50 rounded" />
                <div className="h-3 w-24 bg-ink-50 rounded" />
              </div>
            </header>

            {/* Hero photo */}
            <div className="mb-8 aspect-[16/9] bg-ink-50 rounded-md" />

            {/* Corpo: 6 parágrafos */}
            <div className="max-w-[68ch] space-y-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-full bg-ink-50 rounded" />
                  <div className="h-4 w-full bg-ink-50 rounded" />
                  <div className="h-4 w-5/6 bg-ink-50 rounded" />
                </div>
              ))}
            </div>
          </article>

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

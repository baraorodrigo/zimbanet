export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-40 rounded bg-ink-100" />
      <div className="mt-3 h-8 w-64 rounded bg-ink-100" />
      <div className="mt-8 h-4 w-24 rounded bg-ink-100" />
      <div className="mt-3 h-24 rounded-md bg-ink-100" />
      <div className="mt-8 h-4 w-24 rounded bg-ink-100" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="h-20 rounded-md bg-ink-100" />
        <div className="h-20 rounded-md bg-ink-100" />
        <div className="h-20 rounded-md bg-ink-100" />
        <div className="h-20 rounded-md bg-ink-100" />
      </div>
      <div className="mt-12 h-4 w-40 rounded bg-ink-100" />
      <div className="mt-4 h-64 rounded-md bg-ink-100" />
    </div>
  );
}

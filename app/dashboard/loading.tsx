export default function DashboardLoading() {
  return (
    <div className="grid gap-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-9 w-48 rounded-lg bg-muted" />
        </div>
        <div className="h-10 w-44 rounded-lg bg-muted" />
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 h-4 w-16 rounded bg-muted" />
            <div className="h-7 w-10 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Event cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-5 w-36 rounded bg-muted" />
              <div className="h-5 w-16 rounded-full bg-muted" />
            </div>
            <div className="mb-2 h-3 w-24 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="mt-4 flex gap-2">
              <div className="h-8 flex-1 rounded-lg bg-muted" />
              <div className="h-8 flex-1 rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

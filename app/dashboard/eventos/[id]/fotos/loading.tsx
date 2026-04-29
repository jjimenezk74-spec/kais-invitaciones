export default function FotosLoading() {
  return (
    <div className="grid gap-8 animate-pulse">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-9 w-56 rounded-lg bg-muted" />
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 h-3 w-16 rounded bg-muted" />
            <div className="h-8 w-10 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Quick links row */}
      <div className="flex gap-3">
        <div className="h-9 w-40 rounded-lg bg-muted" />
        <div className="h-9 w-40 rounded-lg bg-muted" />
      </div>

      {/* Section label */}
      <div className="h-4 w-28 rounded bg-muted" />

      {/* Photo grid skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <div className="aspect-square w-full bg-muted" />
            <div className="flex gap-2 p-3">
              <div className="h-8 flex-1 rounded-lg bg-muted" />
              <div className="h-8 flex-1 rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

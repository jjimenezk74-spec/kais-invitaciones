export default function EventDetailLoading() {
  return (
    <div className="grid gap-8 animate-pulse">
      {/* Back link + title */}
      <div className="flex flex-col gap-3">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="h-9 w-64 rounded-lg bg-muted" />
        <div className="flex gap-2">
          <div className="h-5 w-20 rounded-full bg-muted" />
          <div className="h-5 w-28 rounded-full bg-muted" />
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 h-3 w-16 rounded bg-muted" />
            <div className="h-8 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Two-column layout placeholder */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 h-5 w-32 rounded bg-muted" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-full rounded-lg bg-muted" />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 h-5 w-40 rounded bg-muted" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        </div>
        {/* Right column */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 h-5 w-24 rounded bg-muted" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 w-full rounded-lg bg-muted" />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 h-5 w-36 rounded bg-muted" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 w-full rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

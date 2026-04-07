export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-44 animate-pulse rounded" style={{ background: 'var(--border)' }} />
        <div className="h-9 w-28 animate-pulse rounded" style={{ background: 'var(--border)' }} />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded" style={{ background: 'var(--border)' }} />
        ))}
      </div>
    </div>
  );
}

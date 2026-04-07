export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="h-8 w-32 animate-pulse rounded mb-6" style={{ background: 'var(--border)' }} />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded" style={{ background: 'var(--border)' }} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="h-8 w-40 animate-pulse rounded mb-6" style={{ background: 'var(--border)' }} />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded" style={{ background: 'var(--border)' }} />
        ))}
      </div>
    </div>
  );
}

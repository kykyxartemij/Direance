export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="h-8 w-52 animate-pulse rounded mb-8" style={{ background: 'var(--border)' }} />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded" style={{ background: 'var(--border)' }} />
        ))}
      </div>
    </div>
  );
}

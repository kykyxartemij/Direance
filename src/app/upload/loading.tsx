export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="h-8 w-32 animate-pulse rounded mb-6" style={{ background: 'var(--border)' }} />
      <div className="h-48 animate-pulse rounded" style={{ background: 'var(--border)' }} />
    </div>
  );
}

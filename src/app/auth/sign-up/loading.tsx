export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-7 w-48 animate-pulse rounded" style={{ background: 'var(--border)' }} />
      <div className="h-10 animate-pulse rounded" style={{ background: 'var(--border)' }} />
      <div className="h-10 animate-pulse rounded" style={{ background: 'var(--border)' }} />
      <div className="h-10 animate-pulse rounded" style={{ background: 'var(--border)' }} />
      <div className="h-10 animate-pulse rounded" style={{ background: 'var(--border)' }} />
      <div className="h-10 animate-pulse rounded" style={{ background: 'var(--border)' }} />
    </div>
  );
}

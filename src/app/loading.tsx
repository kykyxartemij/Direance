export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl py-8">
      <div
        className="h-7 w-40 animate-pulse rounded"
        style={{ background: 'var(--border)' }}
      />
      <div
        className="mt-2 h-4 w-72 animate-pulse rounded"
        style={{ background: 'var(--border)' }}
      />
    </div>
  );
}

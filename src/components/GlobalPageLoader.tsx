export default function GlobalPageLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
      <div className="global-loader-ring" aria-hidden="true" />
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading<span className="global-loader-dots" />
      </span>
    </div>
  );
}

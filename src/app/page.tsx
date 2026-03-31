import Dashboard from '@/page/dashboard/Dashboard';

export default function Page() {
  return (
    <div className="mx-auto max-w-7xl py-8">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Dashboard
      </h1>
      <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
        Upload a report to get started.
      </p>

      <Dashboard />
    </div>
  );
}

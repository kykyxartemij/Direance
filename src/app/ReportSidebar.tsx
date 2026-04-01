'use client';

import { useReports } from '@/providers/ReportProvider';
import ArtIconButton from '@/components/ui/ArtIconButton';

export default function ReportSidebar() {
  const { reports, removeReport } = useReports();

  if (reports.length === 0) return null;

  return (
    <aside
      className="flex flex-col gap-1 shrink-0 border-r px-3 py-4"
      style={{ width: '220px', borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Uploaded reports
      </p>
      {reports.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-2 rounded px-2 py-1.5"
          style={{ background: 'var(--bg)' }}
        >
          <span
            className="flex-1 text-sm"
            style={{ color: 'var(--text)' }}
            title={r.fileName}
          >
            {r.fileName.replace(/\.(xlsx|xls)$/i, '').slice(0, 10)}
          </span>
          <ArtIconButton
            icon={{ name: 'Close', size: 10 }}
            size="sm"
            aria-label="Remove report"
            onClick={() => removeReport(r.id)}
          />
        </div>
      ))}
    </aside>
  );
}

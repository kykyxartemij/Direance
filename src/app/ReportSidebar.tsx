'use client';

import Link from 'next/link';
import { useReports } from '@/providers/ReportProvider';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtIconButton from '@/components/ui/ArtIconButton';

export default function ReportSidebar() {
  const { reports, removeReport } = useReports();

  if (reports.length === 0) return null;

  return (
    <aside
      className="flex flex-col gap-1 shrink-0 border-l px-3 py-4"
      style={{ width: '220px', borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <p
        className="mb-2 px-1 text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
      >
        Uploaded reports
      </p>
      {reports.map((r) => (
        <div
          key={r.id}
          className="flex flex-col gap-1 rounded px-2 py-1.5"
          style={{ background: 'var(--bg)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex-1 text-sm truncate"
              style={{ color: 'var(--text)' }}
              title={r.fileName}
            >
              {r.fileName.replace(/\.(xlsx|xls)$/i, '').slice(0, 14)}
            </span>
            <Link href={`/upload/mapping?id=${r.id}`} prefetch>
              <ArtIconButton
                icon={{ name: 'Upload', size: 10 }}
                size="sm"
                aria-label="Edit mapping"
                title="Edit mapping"
              />
            </Link>
            <ArtIconButton
              icon={{ name: 'Close', size: 10 }}
              size="sm"
              aria-label="Remove report"
              onClick={() => removeReport(r.id)}
            />
          </div>
          {!r.processedHeaders && (
            <ArtBadge color="warning" size="sm">
              unmapped
            </ArtBadge>
          )}
        </div>
      ))}
    </aside>
  );
}

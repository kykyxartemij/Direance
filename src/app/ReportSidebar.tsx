'use client';

import Link from 'next/link';
import { useGetLightConnections } from '@/hooks/connection.hooks';
import { useReports } from '@/providers/ReportProvider/ReportProvider';
import { isConnectionActive } from '@/providers/ReportProvider/helpers';
import { useAuth } from '@/providers/AuthProvider';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtIconButton from '@/components/ui/ArtIconButton';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtButton from '@/components/ui/ArtButton';
import ArtSkeleton from '@/components/ui/ArtSkeleton';
import { HREF } from '@/lib/hrefUrl';
import { REPORT_TYPES, REPORT_TYPE_LABELS } from '@/models/mapping.models';
import type { ConnectionLightModel } from '@/models/connection.models';
import type { UploadedReport } from '@/providers/ReportProvider/types';

// ==== Helpers ====

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
      {children}
    </p>
  );
}

// ==== Shared sidebar item box ====
// One box per item (connection or manual upload): row 1 is toggle + name, row 2 is the
// linked mapping name (omitted when unmapped — the row-1 badge already covers that case),
// row 3 is source label + actions. Kept as one helper so both row kinds stay visually and
// structurally identical.

interface SidebarItemBoxProps {
  active: boolean;
  onToggle: (active: boolean) => void;
  name: string;
  badge?: React.ReactNode;
  mappingName?: string;
  sourceLabel: string;
  actions?: React.ReactNode;
}

function SidebarItemBox({ active, onToggle, name, badge, mappingName, sourceLabel, actions }: SidebarItemBoxProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded border px-2 py-1.5 mb-1.5"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)', opacity: active ? 1 : 0.5 }}
    >
      {/* Row 1: toggle, name */}
      <div className="flex items-center gap-2">
        <ArtCheckbox checked={active} onChange={(e) => onToggle(e.target.checked)} aria-label={name} />
        <span className="flex-1 text-sm truncate" style={{ color: 'var(--text)' }} title={name}>
          {name}
        </span>
        {badge}
      </div>

      {/* Row 2: mapping name */}
      {mappingName && (
        <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }} title={mappingName}>
          {mappingName}
        </span>
      )}

      {/* Row 3: source, actions */}
      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{sourceLabel}</span>
        <span className="flex-1" />
        {actions}
      </div>
    </div>
  );
}

// ==== Connection row ====
// Purely a toggle over the connection's active state (isDefault, unless overridden) —
// never fetches. Each report page loads the excel data for its own active connections
// (see useGetPnlReportsByConnections / useGetFinancialPositionReportsByConnections).

interface ConnectionRowProps {
  connection: ConnectionLightModel;
  active: boolean;
  onToggle: (checked: boolean) => void;
}

function ConnectionRow({ connection, active, onToggle }: ConnectionRowProps) {
  return (
    <SidebarItemBox
      active={active}
      onToggle={onToggle}
      name={connection.name}
      badge={!connection.mapping && <ArtBadge color="warning" size="sm">unmapped</ArtBadge>}
      mappingName={connection.mapping?.name}
      sourceLabel="Connection"
    />
  );
}

// ==== Manual upload row ====
// Shared by each report-type group and the unsorted group below.

function FileReportRow({ report, onRemove, onSetActive }: {
  report: UploadedReport;
  onRemove: (id: string) => void;
  onSetActive: (id: string, active: boolean) => void;
}) {
  return (
    <SidebarItemBox
      active={report.active}
      onToggle={(checked) => onSetActive(report.id, checked)}
      name={report.fileName.replace(/\.(xlsx|xls)$/i, '')}
      badge={!report.mapped && <ArtBadge color="warning" size="sm">unmapped</ArtBadge>}
      mappingName={report.mapping?.name}
      sourceLabel="Manual upload"
      actions={(
        <>
          <Link href={HREF.uploadMappingFor(report.id)} prefetch>
            <ArtIconButton icon={{ name: 'Edit', size: 10 }} size="sm" aria-label="Edit mapping" />
          </Link>
          <ArtIconButton icon={{ name: 'Close', size: 10 }} size="sm" aria-label="Remove" onClick={() => onRemove(report.id)} />
        </>
      )}
    />
  );
}

// ==== Main sidebar ====
// Global, route-agnostic — every connection shows here regardless of reportType.
// Purely showcase + active/inactive toggling. It never fetches excel data itself —
// that's each report page's job (see PnlPage / FinancialPositionPage), scoped to
// whichever reportType page is actually open.

export default function ReportSidebar() {
  const { user }       = useAuth();
  const { reports, connectionOverrides, setConnectionActive, removeReport, setActive } = useReports();
  // Light list only — id/name/type/isDefault, enough to render the sidebar. Full report
  // data per connection is fetched lazily, only from the report page that needs it.
  const { data: connections = [], isLoading: connectionsLoading } = useGetLightConnections({ enabled: !!user });

  if (!user) return null;

  const fileReports = reports.filter((r) => r.source === 'file');
  const unsortedFileReports = fileReports.filter((r) => !r.mapping);

  const content = (
    <>
      {/* One group per report type — connections and their matching manual uploads together */}
      {REPORT_TYPES.map((type) => {
        const typeConnections = connections.filter((c) => c.reportType === type);
        const typeFileReports = fileReports.filter((r) => r.mapping?.reportType === type);
        return (
          <div key={type} className="mb-3">
            <SectionLabel>{REPORT_TYPE_LABELS[type]}</SectionLabel>
            {typeConnections.length === 0 && typeFileReports.length === 0 && (
              <Link href={HREF.connectionNew} prefetch>
                <ArtButton variant="outlined" size="sm" className="w-full">+ Add connection</ArtButton>
              </Link>
            )}
            {typeConnections.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                active={isConnectionActive(c, connectionOverrides)}
                onToggle={(checked) => setConnectionActive(c.id, checked)}
              />
            ))}
            {typeFileReports.map((r) => (
              <FileReportRow key={r.id} report={r} onRemove={removeReport} onSetActive={setActive} />
            ))}
          </div>
        );
      })}

      {/* Manual uploads not yet mapped to a report type */}
      <div className="mb-3">
        <SectionLabel>Unsorted</SectionLabel>
        <Link href={HREF.upload} prefetch className="mb-1 block">
          <ArtButton variant="outlined" size="sm" className="w-full">+ Upload file</ArtButton>
        </Link>
        {unsortedFileReports.map((r) => (
          <FileReportRow key={r.id} report={r} onRemove={removeReport} onSetActive={setActive} />
        ))}
      </div>
    </>
  );

  return (
    <aside
      className="flex flex-col shrink-0 border-l pl-2 pr-3 py-4"
      style={{ width: '240px', borderColor: 'var(--border)', background: 'var(--surface)', overflowY: 'auto' }}
    >
      {connectionsLoading ? <ArtSkeleton wrap>{content}</ArtSkeleton> : content}
    </aside>
  );
}

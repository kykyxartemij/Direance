'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useGetLightConnections, useFetchPnlConnectionsByIds, useFetchFinancialPositionConnectionsByIds } from '@/hooks/connection.hooks';
import { useReports } from '@/providers/ReportProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtIconButton from '@/components/ui/ArtIconButton';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtButton from '@/components/ui/ArtButton';
import ArtSkeleton from '@/components/ui/ArtSkeleton';
import { HREF } from '@/lib/hrefUrl';
import { REPORT_TYPES, REPORT_TYPE_LABELS } from '@/models/mapping.models';
import type { ConnectionLightModel } from '@/models/connection.models';
import type { UploadedReport } from '@/providers/ReportProvider';
import { defaultPnlFilterValues, buildPnlFetchFilters } from '@/page/connections/pnlFilterFields';
import { defaultFinancialPositionFilterValues, buildFinancialPositionFetchFilters } from '@/page/connections/financialPositionFilterFields';

// ==== Helpers ====

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
      {children}
    </p>
  );
}

// ==== Shared sidebar item box ====
// One box per item (connection or manual upload): row 1 is toggle + name,
// row 2 is source label + actions. Kept as one helper so both row kinds
// stay visually and structurally identical.

interface SidebarItemBoxProps {
  active: boolean;
  toggling?: boolean;
  onToggle: (active: boolean) => void;
  name: string;
  badge?: React.ReactNode;
  sourceLabel: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}

function SidebarItemBox({ active, toggling, onToggle, name, badge, sourceLabel, meta, actions }: SidebarItemBoxProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded border px-2 py-1.5 mb-1.5"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)', opacity: active ? 1 : 0.5 }}
    >
      {/* Row 1: toggle, name */}
      <div className="flex items-center gap-2">
        <ArtCheckbox checked={active} disabled={toggling} onChange={(e) => onToggle(e.target.checked)} aria-label={name} />
        <span className="flex-1 text-sm truncate" style={{ color: 'var(--text)' }} title={name}>
          {name}
        </span>
        {badge}
      </div>

      {/* Row 2: source, actions */}
      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{sourceLabel}</span>
        {meta}
        <span className="flex-1" />
        {actions}
      </div>
    </div>
  );
}

// ==== Connection row ====

interface ConnectionRowProps {
  connection: ConnectionLightModel;
  loadedReportId: string | undefined;
  onToggle: (c: ConnectionLightModel, active: boolean) => Promise<void>;
  toggling: boolean;
}

function ConnectionRow({ connection, loadedReportId, onToggle, toggling }: ConnectionRowProps) {
  const { reports } = useReports();
  const report = loadedReportId ? reports.find((r) => r.id === loadedReportId) : undefined;
  const isLoaded = !!report;

  return (
    <SidebarItemBox
      active={isLoaded && (report?.active ?? true)}
      toggling={toggling}
      onToggle={(checked) => onToggle(connection, checked)}
      name={connection.name}
      badge={report && !report.mapped && <ArtBadge color="warning" size="sm">unmapped</ArtBadge>}
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
// Type-correctness lives in Dashboard's combine step (each report page only combines
// reports matching its own reportType), not in what the sidebar lists.

export default function ReportSidebar() {
  const { user }       = useAuth();
  const { reports, addReportFromSheets, removeReport, setActive, setMapping } = useReports();
  // Light list only — id/name/type/isDefault, enough to render the sidebar. Full report
  // data per connection is fetched lazily, only from the report page that needs it
  // (see Dashboard.tsx) — never eagerly here.
  const { data: connections = [], isLoading: connectionsLoading } = useGetLightConnections({ enabled: !!user });
  const { enqueueError } = useArtSnackbar();
  // Manual toggle already has its own local indicator (togglingId) — no blur needed.
  const { mutateAsync: fetchPnl } = useFetchPnlConnectionsByIds();
  const { mutateAsync: fetchFinancialPosition } = useFetchFinancialPositionConnectionsByIds();

  // Track which connection → loaded report id
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleConnection(connection: ConnectionLightModel, load: boolean) {
    setTogglingId(connection.id);
    try {
      if (load) {
        const result = connection.reportType === 'pnl'
          ? await fetchPnl({ ids: [connection.id], ...buildPnlFetchFilters(defaultPnlFilterValues()) })
          : await fetchFinancialPosition({ ids: [connection.id], ...buildFinancialPositionFetchFilters(defaultFinancialPositionFilterValues()) });
        const data = result[connection.id];
        const id = addReportFromSheets(`${connection.name}-${data.fetchedAt.slice(0, 10)}`, data.sheets, {
          connectionId: connection.id,
          connectionType: connection.type,
          fetchedAt: data.fetchedAt,
        });
        if (data.mapping) setMapping(id, data.mapping);
      } else {
        const loaded = reports.find((r) => r.connectionId === connection.id);
        if (loaded) removeReport(loaded.id);
      }
    } catch (err) {
      enqueueError(err as Error, `Failed to ${load ? 'load' : 'remove'} connection`);
    } finally {
      setTogglingId(null);
    }
  }

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
            {typeConnections.map((c) => {
              const loaded = reports.find((r) => r.connectionId === c.id);
              return (
                <ConnectionRow
                  key={c.id}
                  connection={c}
                  loadedReportId={loaded?.id}
                  onToggle={toggleConnection}
                  toggling={togglingId === c.id}
                />
              );
            })}
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

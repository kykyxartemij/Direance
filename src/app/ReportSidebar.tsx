'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useGetLightConnections } from '@/hooks/connection.hooks';
import { fetchMappingById } from '@/hooks/mapping.hooks';
import { useReports, type ConnectionSheet } from '@/providers/ReportProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtIconButton from '@/components/ui/ArtIconButton';
import ArtBadge from '@/components/ui/ArtBadge';
import fetchClient from '@/lib/fetchClient';
import { API } from '@/lib/apiUrl';
import { HREF } from '@/lib/hrefUrl';
import { REPORT_TYPE_LABELS } from '@/models/mapping.models';
import type { ReportType } from '@/models/mapping.models';
import type { ConnectionLightModel } from '@/models/connection.models';

// ==== Helpers ====

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'now';
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 mb-1 px-1 text-xs font-medium uppercase tracking-wide first:mt-0" style={{ color: 'var(--text-muted)' }}>
      {children}
    </p>
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
  const { reports, removeReport, setActive, replaceReportSheets } = useReports();
  const { enqueueError } = useArtSnackbar();
  const [refreshing, setRefreshing] = useState(false);
  const report = loadedReportId ? reports.find((r) => r.id === loadedReportId) : undefined;

  async function refresh() {
    if (!report) return;
    setRefreshing(true);
    try {
      const { data } = await fetchClient.post<{ sheets: ConnectionSheet[]; fetchedAt: string }>(
        API.connection.fetch(connection.id), {},
      );
      replaceReportSheets(report.id, data.sheets, data.fetchedAt);
    } catch (err) {
      enqueueError(err as Error, 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }

  const isLoaded = !!report;

  return (
    <div
      className="flex flex-col gap-1 rounded px-2 py-1.5"
      style={{ background: 'var(--bg)', opacity: isLoaded && !report?.active ? 0.5 : 1 }}
    >
      <div className="flex items-center gap-2">
        <ArtCheckbox
          checked={isLoaded}
          disabled={toggling}
          onChange={(e) => onToggle(connection, e.target.checked)}
          aria-label="Load connection"
        />
        <span className="flex-1 text-sm truncate" style={{ color: 'var(--text)' }} title={connection.name}>
          {connection.name}
        </span>
        {isLoaded && (
          <>
            <ArtIconButton
              icon={{ name: 'Loading', size: 10 }}
              size="sm"
              aria-label="Refresh"
              disabled={refreshing}
              onClick={refresh}
            />
            <ArtIconButton
              icon={{ name: 'Close', size: 10 }}
              size="sm"
              aria-label="Remove"
              onClick={() => report && removeReport(report.id)}
            />
          </>
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {REPORT_TYPE_LABELS[connection.reportType as ReportType] ?? connection.reportType}
        </span>
        {report && !report.mapped && (
          <ArtBadge color="warning" size="sm">unmapped</ArtBadge>
        )}
        {report?.fetchedAt && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }} title={new Date(report.fetchedAt).toLocaleString()}>
            {relTime(report.fetchedAt)}
          </span>
        )}
      </div>
    </div>
  );
}

// ==== Main sidebar ====

export default function ReportSidebar() {
  const queryClient    = useQueryClient();
  const { user }       = useAuth();
  const { reports, addReportFromSheets, removeReport, setActive, replaceReportSheets, setMapping } = useReports();
  const { data: connections = [] } = useGetLightConnections();
  const { enqueueError } = useArtSnackbar();

  // Track which connection → loaded report id
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Auto-load isDefault connections once per session
  const didAutoLoad = useRef(false);
  useEffect(() => {
    if (didAutoLoad.current || !connections.length) return;
    const activeReports = reports.filter((r) => r.source === 'connection');
    if (activeReports.length > 0) { didAutoLoad.current = true; return; }

    const defaults = connections.filter((c) => c.isDefault);
    if (!defaults.length) { didAutoLoad.current = true; return; }

    didAutoLoad.current = true;
    void (async () => {
      for (const c of defaults) {
        try {
          const { data } = await fetchClient.post<{ sheets: ConnectionSheet[]; fetchedAt: string }>(
            API.connection.fetch(c.id), {},
          );
          const id = addReportFromSheets(`${c.name}-${data.fetchedAt.slice(0, 10)}`, data.sheets, {
            connectionId: c.id,
            connectionType: c.type,
            fetchedAt: data.fetchedAt,
          });
          if (c.mapping?.id) {
            const mapping = await fetchMappingById(queryClient, c.mapping.id);
            setMapping(id, mapping);
          }
        } catch { /* silent — auto-load failure doesn't block */ }
      }
    })();
  }, [connections, reports, addReportFromSheets, setMapping, queryClient]);

  async function toggleConnection(connection: ConnectionLightModel, load: boolean) {
    setTogglingId(connection.id);
    try {
      if (load) {
        const { data } = await fetchClient.post<{ sheets: ConnectionSheet[]; fetchedAt: string }>(
          API.connection.fetch(connection.id), {},
        );
        const id = addReportFromSheets(`${connection.name}-${data.fetchedAt.slice(0, 10)}`, data.sheets, {
          connectionId: connection.id,
          connectionType: connection.type,
          fetchedAt: data.fetchedAt,
        });
        if (connection.mapping?.id) {
          const mapping = await fetchMappingById(queryClient, connection.mapping.id);
          setMapping(id, mapping);
        }
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

  return (
    <aside
      className="flex flex-col shrink-0 border-l px-3 py-4"
      style={{ width: '240px', borderColor: 'var(--border)', background: 'var(--surface)', overflowY: 'auto' }}
    >
      {/* Connections */}
      <SectionLabel>Connections</SectionLabel>
      {connections.length === 0 && (
        <p className="px-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          No connections — <Link href="/connections/new" className="underline">create one</Link>
        </p>
      )}
      {connections.map((c) => {
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

      {/* Manual uploads */}
      <SectionLabel>Manual Uploads</SectionLabel>
      <Link
        href="/upload"
        prefetch
        className="mb-1 px-2 py-1.5 rounded text-sm"
        style={{ color: 'var(--text-muted)', display: 'block' }}
      >
        + Upload file
      </Link>
      {fileReports.map((r) => (
        <div
          key={r.id}
          className="flex flex-col gap-1 rounded px-2 py-1.5"
          style={{ background: 'var(--bg)', opacity: r.active ? 1 : 0.5 }}
        >
          <div className="flex items-center gap-2">
            <ArtCheckbox
              checked={r.active}
              onChange={(e) => setActive(r.id, e.target.checked)}
              aria-label="Show in dashboard"
            />
            <span className="flex-1 text-sm truncate" style={{ color: 'var(--text)' }} title={r.fileName}>
              {r.fileName.replace(/\.(xlsx|xls)$/i, '')}
            </span>
            <Link href={HREF.uploadMappingFor(r.id)} prefetch>
              <ArtIconButton icon={{ name: 'Upload', size: 10 }} size="sm" aria-label="Edit mapping" />
            </Link>
            <ArtIconButton icon={{ name: 'Close', size: 10 }} size="sm" aria-label="Remove" onClick={() => removeReport(r.id)} />
          </div>
          {!r.mapped && <ArtBadge color="warning" size="sm">unmapped</ArtBadge>}
        </div>
      ))}
    </aside>
  );
}

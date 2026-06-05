'use client';

import { useState } from 'react';
import { useReports, type ConnectionSheet, type UploadedReport } from '@/providers/ReportProvider';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import ArtInput from '@/components/ui/ArtInput';
import ArtSelect, { type ArtSelectOption } from '@/components/ui/ArtSelect';
import ArtButton from '@/components/ui/ArtButton';
import fetchClient from '@/lib/fetchClient';
import { API } from '@/lib/apiUrl';
import type { ConnectionType, FetchFiltersModel } from '@/models/connection.models';
import { REPORT_TYPES, REPORT_TYPE_LABELS } from '@/models/mapping.models';

// ==== Per-driver filter rows ====
// Each row owns its filter state. Refresh fans out to every connection-sourced
// report whose Connection is that driver type. File reports never touch this —
// `source === 'connection'` is the prerequisite.
//
// Common fields (reportType, dateFrom, dateTo) sit on FetchFiltersModel directly.
// Driver-specific fields go in `extras` and are interpreted by the driver
// server-side (see src/lib/connections/*.ts).

interface FilterRowProps {
  reports: UploadedReport[];
  onRefresh: () => Promise<void>;
  loading: boolean;
  children: React.ReactNode;
  label: string;
}

function FilterRow({ reports, onRefresh, loading, children, label }: FilterRowProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', minWidth: 80 }}>
        {label}
      </span>
      {children}
      <ArtButton color="primary" loading={loading} onClick={onRefresh}>
        Refresh ({reports.length})
      </ArtButton>
    </div>
  );
}

// ==== Merit filter row ====

const MERIT_REPORT_OPTIONS: ArtSelectOption[] = REPORT_TYPES.map((r) => ({ label: REPORT_TYPE_LABELS[r], value: r }));

function MeritFilterRow({ reports, runRefresh }: { reports: UploadedReport[]; runRefresh: (reports: UploadedReport[], filters: FetchFiltersModel) => Promise<void> }) {
  const [reportType, setReportType] = useState('pnl');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [loading, setLoading]       = useState(false);

  async function handle() {
    setLoading(true);
    await runRefresh(reports, {
      reportType,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo   ? { dateTo }   : {}),
    });
    setLoading(false);
  }

  return (
    <FilterRow reports={reports} onRefresh={handle} loading={loading} label="Merit">
      <ArtSelect
        label="Report"
        options={MERIT_REPORT_OPTIONS}
        selected={MERIT_REPORT_OPTIONS.find((o) => o.value === reportType) ?? null}
        onChange={(opt) => setReportType(opt?.value ?? 'pnl')}
        style={{ width: 160 }}
      />
      <ArtInput label="Date from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: 160 }} />
      <ArtInput label="Date to"   type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   style={{ width: 160 }} />
    </FilterRow>
  );
}

// ==== Odoo filter row ====

function OdooFilterRow({ reports, runRefresh }: { reports: UploadedReport[]; runRefresh: (reports: UploadedReport[], filters: FetchFiltersModel) => Promise<void> }) {
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [journalIds, setJournalIds]     = useState('');
  const [accountPrefix, setAccountPrefix] = useState('');
  const [loading, setLoading]           = useState(false);

  async function handle() {
    setLoading(true);
    const parsedJournals = journalIds
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    const extras: Record<string, unknown> = {};
    if (parsedJournals.length > 0) extras.journalIds = parsedJournals;
    if (accountPrefix)             extras.accountPrefix = accountPrefix;

    await runRefresh(reports, {
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo   ? { dateTo }   : {}),
      ...(Object.keys(extras).length > 0 ? { extras } : {}),
    });
    setLoading(false);
  }

  return (
    <FilterRow reports={reports} onRefresh={handle} loading={loading} label="Odoo">
      <ArtInput label="Date from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: 160 }} />
      <ArtInput label="Date to"   type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   style={{ width: 160 }} />
      <ArtInput
        label="Journal IDs"
        placeholder="1,2,5"
        value={journalIds}
        onChange={(e) => setJournalIds(e.target.value)}
        style={{ width: 160 }}
      />
      <ArtInput
        label="Account prefix"
        placeholder="411"
        value={accountPrefix}
        onChange={(e) => setAccountPrefix(e.target.value)}
        style={{ width: 140 }}
      />
    </FilterRow>
  );
}

// ==== Main filter panel ====
// Groups connection-sourced reports by their driver type and renders the
// matching per-driver filter row. Hidden when no connection-sourced reports.

export default function ConnectionFilters() {
  const { reports, replaceReportSheets } = useReports();
  const { enqueueError, enqueueSuccess } = useArtSnackbar();

  const connectionReports = reports.filter((r) => r.source === 'connection' && r.connectionId);
  if (connectionReports.length === 0) return null;

  // Bucket by driver type — `connectionType` is copied onto the report at
  // addReportFromSheets time so we don't need a side-channel lookup here.
  const byType: Record<ConnectionType, UploadedReport[]> = { merit: [], odoo: [] };
  for (const r of connectionReports) {
    if (r.connectionType === 'merit') byType.merit.push(r);
    else if (r.connectionType === 'odoo') byType.odoo.push(r);
  }

  async function runRefresh(targetReports: UploadedReport[], filters: FetchFiltersModel) {
    try {
      // Sequential — bound Neon CU pressure with multiple connections.
      for (const r of targetReports) {
        const { data } = await fetchClient.post<{ sheets: ConnectionSheet[]; fetchedAt: string }>(
          API.connection.fetch(r.connectionId!),
          filters,
        );
        replaceReportSheets(r.id, data.sheets, data.fetchedAt);
      }
      enqueueSuccess(`Refreshed ${targetReports.length} report${targetReports.length > 1 ? 's' : ''}`);
    } catch (err) {
      enqueueError(err as Error, 'Failed to refresh');
    }
  }

  return (
    <div
      className="flex flex-col gap-3 rounded p-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {byType.merit.length > 0 && <MeritFilterRow reports={byType.merit} runRefresh={runRefresh} />}
      {byType.odoo.length  > 0 && <OdooFilterRow  reports={byType.odoo}  runRefresh={runRefresh} />}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Filters apply only to connection-sourced reports. File uploads stay as-is.
      </p>
    </div>
  );
}

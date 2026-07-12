'use client';

import { useReducer } from 'react';
import { useReports, type UploadedReport } from '@/providers/ReportProvider';
import { useRefreshConnectionReports } from '@/hooks/connection.hooks';
import ArtInput from '@/components/ui/ArtInput';
import ArtSelect, { type ArtSelectOption } from '@/components/ui/ArtSelect';
import ArtButton from '@/components/ui/ArtButton';
import type { FetchFiltersModel } from '@/models/connection.models';
import { REPORT_TYPES, REPORT_TYPE_LABELS } from '@/models/mapping.models';

// ==== Per-driver filter rows ====

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

type MeritState = { reportType: string; dateFrom: string; dateTo: string; loading: boolean };
type MeritAction =
  | { type: 'SET_REPORT_TYPE'; value: string }
  | { type: 'SET_DATE_FROM'; value: string }
  | { type: 'SET_DATE_TO'; value: string }
  | { type: 'SET_LOADING'; value: boolean };

function meritReducer(state: MeritState, action: MeritAction): MeritState {
  switch (action.type) {
    case 'SET_REPORT_TYPE': return { ...state, reportType: action.value };
    case 'SET_DATE_FROM':   return { ...state, dateFrom: action.value };
    case 'SET_DATE_TO':     return { ...state, dateTo: action.value };
    case 'SET_LOADING':     return { ...state, loading: action.value };
  }
}

function MeritFilterRow({ reports, runRefresh }: { reports: UploadedReport[]; runRefresh: (reports: UploadedReport[], filters: FetchFiltersModel) => Promise<void> }) {
  const [state, dispatch] = useReducer(meritReducer, { reportType: 'pnl', dateFrom: '', dateTo: '', loading: false });

  async function handle() {
    dispatch({ type: 'SET_LOADING', value: true });
    await runRefresh(reports, {
      reportType: state.reportType,
      ...(state.dateFrom ? { dateFrom: state.dateFrom } : {}),
      ...(state.dateTo   ? { dateTo: state.dateTo }   : {}),
    });
    dispatch({ type: 'SET_LOADING', value: false });
  }

  return (
    <FilterRow reports={reports} onRefresh={handle} loading={state.loading} label="Merit">
      <div style={{ width: 160 }}>
        <ArtSelect
          label="Report"
          options={MERIT_REPORT_OPTIONS}
          selected={MERIT_REPORT_OPTIONS.find((o) => o.value === state.reportType) ?? null}
          onChange={(opt) => dispatch({ type: 'SET_REPORT_TYPE', value: opt?.value ?? 'pnl' })}
        />
      </div>
      <ArtInput label="Date from" type="date" value={state.dateFrom} onChange={(e) => dispatch({ type: 'SET_DATE_FROM', value: e.target.value })} style={{ width: 160 }} />
      <ArtInput label="Date to"   type="date" value={state.dateTo}   onChange={(e) => dispatch({ type: 'SET_DATE_TO',   value: e.target.value })} style={{ width: 160 }} />
    </FilterRow>
  );
}

// ==== Odoo filter row ====

type OdooState = { dateFrom: string; dateTo: string; journalIds: string; accountPrefix: string; loading: boolean };
type OdooAction =
  | { type: 'SET_DATE_FROM'; value: string }
  | { type: 'SET_DATE_TO'; value: string }
  | { type: 'SET_JOURNAL_IDS'; value: string }
  | { type: 'SET_ACCOUNT_PREFIX'; value: string }
  | { type: 'SET_LOADING'; value: boolean };

function odooReducer(state: OdooState, action: OdooAction): OdooState {
  switch (action.type) {
    case 'SET_DATE_FROM':       return { ...state, dateFrom: action.value };
    case 'SET_DATE_TO':         return { ...state, dateTo: action.value };
    case 'SET_JOURNAL_IDS':     return { ...state, journalIds: action.value };
    case 'SET_ACCOUNT_PREFIX':  return { ...state, accountPrefix: action.value };
    case 'SET_LOADING':         return { ...state, loading: action.value };
  }
}

function OdooFilterRow({ reports, runRefresh }: { reports: UploadedReport[]; runRefresh: (reports: UploadedReport[], filters: FetchFiltersModel) => Promise<void> }) {
  const [state, dispatch] = useReducer(odooReducer, { dateFrom: '', dateTo: '', journalIds: '', accountPrefix: '', loading: false });

  async function handle() {
    dispatch({ type: 'SET_LOADING', value: true });
    const parsedJournals = state.journalIds
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    const extras: Record<string, unknown> = {};
    if (parsedJournals.length > 0) extras.journalIds = parsedJournals;
    if (state.accountPrefix)    extras.accountPrefix = state.accountPrefix;

    await runRefresh(reports, {
      ...(state.dateFrom ? { dateFrom: state.dateFrom } : {}),
      ...(state.dateTo   ? { dateTo: state.dateTo }   : {}),
      ...(Object.keys(extras).length > 0 ? { extras } : {}),
    });
    dispatch({ type: 'SET_LOADING', value: false });
  }

  return (
    <FilterRow reports={reports} onRefresh={handle} loading={state.loading} label="Odoo">
      <ArtInput label="Date from" type="date" value={state.dateFrom} onChange={(e) => dispatch({ type: 'SET_DATE_FROM', value: e.target.value })} style={{ width: 160 }} />
      <ArtInput label="Date to"   type="date" value={state.dateTo}   onChange={(e) => dispatch({ type: 'SET_DATE_TO',   value: e.target.value })} style={{ width: 160 }} />
      <ArtInput
        label="Journal IDs"
        placeholder="1,2,5"
        value={state.journalIds}
        onChange={(e) => dispatch({ type: 'SET_JOURNAL_IDS', value: e.target.value })}
        style={{ width: 160 }}
      />
      <ArtInput
        label="Account prefix"
        placeholder="411"
        value={state.accountPrefix}
        onChange={(e) => dispatch({ type: 'SET_ACCOUNT_PREFIX', value: e.target.value })}
        style={{ width: 140 }}
      />
    </FilterRow>
  );
}

// ==== Main filter panel ====

export default function ConnectionFilters() {
  const { reports } = useReports();
  const { mutateAsync: refreshReports } = useRefreshConnectionReports();

  const connectionReports = reports.filter((r) => r.source === 'connection' && r.connectionId);
  if (connectionReports.length === 0) return null;

  const meritReports = connectionReports.filter((r) => r.connectionType === 'merit');
  const odooReports  = connectionReports.filter((r) => r.connectionType === 'odoo');

  async function runRefresh(targetReports: UploadedReport[], filters: FetchFiltersModel) {
    await refreshReports(targetReports.map((r) => ({ reportId: r.id, connectionId: r.connectionId!, filters })));
  }

  return (
    <div
      className="flex flex-col gap-3 rounded p-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {meritReports.length > 0 && <MeritFilterRow reports={meritReports} runRefresh={runRefresh} />}
      {odooReports.length  > 0 && <OdooFilterRow  reports={odooReports}  runRefresh={runRefresh} />}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Filters apply only to connection-sourced reports. File uploads stay as-is.
      </p>
    </div>
  );
}

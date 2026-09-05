'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { SourceLayout, SheetConfig, TotalColumnMode, ReportType } from '@/models/mapping.models';
import type { ConnectionSheet } from '@/models/connection.models';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtUpload from '@/components/ui/ArtUpload';
import ArtButton from '@/components/ui/ArtButton';
import ArtSelect from '@/components/ui/ArtSelect';
import ArtTabs from '@/components/ui/ArtTabs';
import { useGetLightConnections, useFetchPnlConnectionById, useFetchFinancialPositionConnectionById } from '@/hooks/connection.hooks';
import { defaultPnlFilterValues, buildPnlFetchFilters } from '@/page/reports/pnl/pnlFilterFields';
import { defaultFinancialPositionFilterValues, buildFinancialPositionFetchFilters } from '@/page/reports/financial-position/financialPositionFilterFields';
import { buildLoadedWorkbookState, type LoadedWorkbookState } from './applyMapping';
import SourceLayoutSection from './SourceLayoutSection/SourceLayoutSection';

export type { LoadedWorkbookState };

// ==== Types ====

interface SourceLayoutFormSectionProps {
  initialLayout: SourceLayout;
  initialSheetLayouts?: Record<string, SourceLayout>;
  initialSheetsConfig?: Record<string, SheetConfig>;
  /** Owned by the parent — set via onWorkbookLoaded, null until a file/connection sample is loaded. */
  loaded: LoadedWorkbookState | null;
  /** Called when a file is picked or a connection sample is fetched. Pass null to clear. */
  onWorkbookLoaded: (state: LoadedWorkbookState | null) => void;
  onSheetLayoutChange: (sheetName: string, layout: SourceLayout) => void;
  onSheetModeChange: (sheetName: string, mode: 'combine' | 'skip') => void;
  onSheetTotalColumnModeChange: (sheetName: string, mode: TotalColumnMode) => void;
  /** When set, shows a "fetch sample from connection" picker scoped to this report type. Omit for manual-upload contexts. */
  reportType?: ReportType;
}

// ==== Helpers ====

function colLetter(n: number): string {
  let result = '';
  let col = n;
  while (col >= 0) {
    result = String.fromCharCode(65 + (col % 26)) + result;
    col = Math.floor(col / 26) - 1;
  }
  return result;
}

function describeRegion(r: { descriptionColumn: number; valueColumns: number[]; startRow?: number }): string {
  const desc = colLetter(r.descriptionColumn);
  const vals = r.valueColumns.map(colLetter).join(', ');
  const start = r.startRow != null ? ` from row ${r.startRow + 1}` : '';
  return `desc ${desc} → vals ${vals}${start}`;
}

function buildWorkbookFromSheets(sheets: ConnectionSheet[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(workbook, ws, s.name.slice(0, 31)); // xlsx caps at 31 chars
  }
  return workbook;
}

// ==== Readonly summary ====

function ReadonlySummary({
  layout,
  sheetLayouts,
  sheetsConfig,
}: {
  layout: SourceLayout;
  sheetLayouts?: Record<string, SourceLayout>;
  sheetsConfig?: Record<string, SheetConfig>;
}) {
  const sheets = sheetLayouts ? Object.keys(sheetLayouts) : [];

  return (
    <div className="flex flex-col gap-3 rounded p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Below is the stored layout. To edit regions or columns, load a real file first.
      </p>

      {sheets.length === 0 ? (
        <div className="text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Primary layout: </span>
          <span>header row {layout.headerRow + 1}, {layout.regions.length} region{layout.regions.length !== 1 ? 's' : ''}</span>
          {layout.regions.length > 0 && (
            <ul className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {layout.regions.map((r, i) => (
                <li key={r.descriptionColumn}>Region {i + 1}: {describeRegion(r)}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sheets.map((name) => {
            const sl = sheetLayouts![name];
            const cfg = sheetsConfig?.[name];
            return (
              <div key={name} className="text-sm">
                <div className="flex items-center gap-2">
                  <strong>{name}</strong>
                  {cfg?.mode === 'skip' && (
                    <span className="text-xs" style={{ color: 'var(--art-danger)' }}>skipped</span>
                  )}
                  {cfg?.totalColumnMode && cfg.totalColumnMode !== 'none' && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {cfg.totalColumnMode}</span>
                  )}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  header row {sl.headerRow + 1}, {sl.regions.length} region{sl.regions.length !== 1 ? 's' : ''}
                  {sl.regions.length > 0 && ` — ${sl.regions.map(describeRegion).join(' | ')}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==== Section ====

function SourceLayoutFormSection({
  initialLayout,
  initialSheetLayouts,
  initialSheetsConfig,
  loaded,
  onWorkbookLoaded,
  onSheetLayoutChange,
  onSheetModeChange,
  onSheetTotalColumnModeChange,
  reportType,
}: SourceLayoutFormSectionProps) {
    const [sourceMode, setSourceMode] = useState<'upload' | 'connection'>('upload');
    const [connectionId, setConnectionId] = useState<string | null>(null);
    const [sourceLabel, setSourceLabel] = useState<string | null>(null);
    const [warningOverride, setWarningOverride] = useState<string | null>(null);
    const { data: connections = [] } = useGetLightConnections();
    const { mutateAsync: fetchPnl, isPending: fetchingPnl } = useFetchPnlConnectionById({
      meta: { withPageLoaderBlur: true },
    });
    const { mutateAsync: fetchFinancialPosition, isPending: fetchingFinancialPosition } = useFetchFinancialPositionConnectionById({
      meta: { withPageLoaderBlur: true },
    });
    const fetching = fetchingPnl || fetchingFinancialPosition;
    const connectionOptions = connections.flatMap((c) =>
      c.reportType === reportType ? [{ label: c.name, value: c.id }] : []
    );

    function loadWorkbook(wb: XLSX.WorkBook) {
      setWarningOverride(null);
      const state = buildLoadedWorkbookState(
        wb,
        loaded?.sheetLayouts ?? initialSheetLayouts ?? {},
        loaded?.sheetsConfig ?? initialSheetsConfig ?? {},
      );
      onWorkbookLoaded(state);
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) {
        onWorkbookLoaded(null);
        return;
      }
      try {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellStyles: true });
        loadWorkbook(wb);
        setSourceLabel(file.name);
      } catch (err) {
        setWarningOverride(`Failed to parse Excel file: ${(err as Error).message}`);
      }
    }

    async function handleFetchFromConnection() {
      if (!connectionId || !reportType) return;
      try {
        const result = reportType === 'pnl'
          ? await fetchPnl({ id: connectionId, ...buildPnlFetchFilters(defaultPnlFilterValues()) })
          : await fetchFinancialPosition({ id: connectionId, ...buildFinancialPositionFetchFilters(defaultFinancialPositionFilterValues()) });
        const wb = buildWorkbookFromSheets(result.sheets);
        loadWorkbook(wb);
        const connectionName = connections.find((c) => c.id === connectionId)?.name ?? 'connection';
        setSourceLabel(`Connection: ${connectionName}`);
      } catch (err) {
        setWarningOverride(`Failed to fetch from connection: ${(err as Error).message}`);
      }
    }

    function clearWorkbook() {
      onWorkbookLoaded(null);
      setSourceLabel(null);
      setWarningOverride(null);
    }

    const warning = warningOverride ?? loaded?.warning ?? null;

    return (
      <ArtCollapse title="Source Layout" defaultOpen={false}>
        <div className="flex flex-col gap-3">
          {!loaded && (
            <ReadonlySummary
              layout={initialLayout}
              sheetLayouts={initialSheetLayouts}
              sheetsConfig={initialSheetsConfig}
            />
          )}

          {reportType && (
            <ArtTabs
              tabs={[
                { value: 'upload', label: 'Upload file' },
                { value: 'connection', label: 'From connection' },
              ]}
              value={sourceMode}
              onChange={(v) => setSourceMode(v as 'upload' | 'connection')}
            />
          )}

          {sourceMode === 'upload' || !reportType ? (
            <ArtUpload
              label={loaded ? 'Replace Excel file' : 'Upload Excel to edit Source Layout'}
              hint="Excel (.xlsx, .xls)"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
            />
          ) : (
            <div className="flex items-end gap-3">
              <div style={{ flex: 1 }}>
                <ArtSelect
                  label="Connection"
                  helperText="Pulls latest data with default filters, only to populate Source Layout — not stored."
                  options={connectionOptions}
                  selected={connectionOptions.find((o) => o.value === connectionId) ?? null}
                  onChange={(opt) => setConnectionId((opt?.value as string) ?? null)}
                  placeholder="Select connection…"
                  clearable
                />
              </div>
              <ArtButton
                type="button"
                variant="outlined"
                size="md"
                disabled={!connectionId}
                loading={fetching}
                onClick={handleFetchFromConnection}
              >
                Fetch latest
              </ArtButton>
            </div>
          )}

          {loaded && sourceLabel?.startsWith('Connection:') && (
            <div className="flex items-center justify-between rounded px-3 py-2 text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Loaded: <strong style={{ color: 'var(--text)' }}>{sourceLabel}</strong>
              </span>
              <ArtButton type="button" variant="ghost" size="sm" onClick={clearWorkbook}>
                Clear loaded source
              </ArtButton>
            </div>
          )}

          {warning && (
            <p className="text-xs" style={{ color: 'var(--art-warning)' }}>
              {warning}
            </p>
          )}

          {loaded && (
            <SourceLayoutSection
              bare
              workbook={loaded.workbook}
              sheetLayouts={loaded.sheetLayouts}
              autoDetectedLayouts={loaded.autoDetectedLayouts}
              sheetsConfig={loaded.sheetsConfig}
              onSheetLayoutChange={onSheetLayoutChange}
              onSheetModeChange={onSheetModeChange}
              onSheetTotalColumnModeChange={onSheetTotalColumnModeChange}
            />
          )}
        </div>
      </ArtCollapse>
    );
}

export default SourceLayoutFormSection;

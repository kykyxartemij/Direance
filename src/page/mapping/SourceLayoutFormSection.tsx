'use client';

import { useImperativeHandle, useReducer } from 'react';
import * as XLSX from 'xlsx';
import type { SourceLayout, SheetConfig, TotalColumnMode } from '@/models/mapping.models';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtUpload from '@/components/ui/ArtUpload';
import ArtButton from '@/components/ui/ArtButton';
import { autoDetectLayout } from './applyMapping';
import SourceLayoutSection from './SourceLayoutSection';

// ==== Types ====

export interface SourceLayoutFormSectionRef {
  getSourceLayout(): SourceLayout;
  getSheetLayouts(): Record<string, SourceLayout> | undefined;
  getSheetsConfig(): Record<string, SheetConfig> | undefined;
}

interface SourceLayoutFormSectionProps {
  initialLayout: SourceLayout;
  initialSheetLayouts?: Record<string, SourceLayout>;
  initialSheetsConfig?: Record<string, SheetConfig>;
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
  const vals = r.valueColumns.map(colLetter).join(', ') || '—';
  const start = r.startRow != null ? ` from row ${r.startRow + 1}` : '';
  return `desc ${desc} → vals ${vals}${start}`;
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
        Source Layout requires a real Excel file to edit. Upload below to enable region/column editing.
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

// ==== Reducer ====

type LayoutState = {
  workbook: XLSX.WorkBook | null;
  sheetLayouts: Record<string, SourceLayout>;
  autoDetectedLayouts: Record<string, SourceLayout>;
  sheetsConfig: Record<string, SheetConfig>;
  warning: string | null;
};

type LayoutAction =
  | { type: 'LOAD_WORKBOOK'; workbook: XLSX.WorkBook; sheetLayouts: Record<string, SourceLayout>; autoDetectedLayouts: Record<string, SourceLayout>; sheetsConfig: Record<string, SheetConfig>; warning: string | null }
  | { type: 'CLEAR_WORKBOOK' }
  | { type: 'SET_WARNING'; warning: string | null }
  | { type: 'SET_SHEET_LAYOUT'; sheetName: string; layout: SourceLayout }
  | { type: 'SET_SHEET_MODE'; sheetName: string; mode: 'combine' | 'skip' }
  | { type: 'SET_SHEET_TOTAL_COLUMN_MODE'; sheetName: string; mode: TotalColumnMode };

function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case 'LOAD_WORKBOOK':
      return { ...state, workbook: action.workbook, sheetLayouts: action.sheetLayouts, autoDetectedLayouts: action.autoDetectedLayouts, sheetsConfig: action.sheetsConfig, warning: action.warning };
    case 'CLEAR_WORKBOOK':
      return { ...state, workbook: null, warning: null };
    case 'SET_WARNING':
      return { ...state, warning: action.warning };
    case 'SET_SHEET_LAYOUT':
      return { ...state, sheetLayouts: { ...state.sheetLayouts, [action.sheetName]: action.layout } };
    case 'SET_SHEET_MODE':
      return { ...state, sheetsConfig: { ...state.sheetsConfig, [action.sheetName]: { ...(state.sheetsConfig[action.sheetName] ?? { mode: 'combine' }), mode: action.mode } } };
    case 'SET_SHEET_TOTAL_COLUMN_MODE':
      return { ...state, sheetsConfig: { ...state.sheetsConfig, [action.sheetName]: { ...(state.sheetsConfig[action.sheetName] ?? { mode: 'combine' }), totalColumnMode: action.mode } } };
  }
}

// ==== Section ====

function SourceLayoutFormSection({ initialLayout, initialSheetLayouts, initialSheetsConfig, ref }: SourceLayoutFormSectionProps & { ref?: React.Ref<SourceLayoutFormSectionRef> }) {
    const [state, dispatch] = useReducer(layoutReducer, {
      workbook: null,
      sheetLayouts: initialSheetLayouts ?? {},
      autoDetectedLayouts: {},
      sheetsConfig: initialSheetsConfig ?? {},
      warning: null,
    });
    const { workbook, sheetLayouts, autoDetectedLayouts, sheetsConfig, warning } = state;

    useImperativeHandle(
      ref,
      () => ({
        getSourceLayout: () => {
          // Prefer the first non-skipped sheet's layout. Falls back to initialLayout.
          const primaryName = workbook?.SheetNames.find((n) => sheetsConfig[n]?.mode !== 'skip')
            ?? workbook?.SheetNames[0];
          return (primaryName && sheetLayouts[primaryName]) || initialLayout;
        },
        getSheetLayouts: () =>
          Object.keys(sheetLayouts).length > 0 ? sheetLayouts : undefined,
        getSheetsConfig: () =>
          Object.keys(sheetsConfig).length > 0 ? sheetsConfig : undefined,
      }),
      [workbook, sheetLayouts, sheetsConfig, initialLayout],
    );

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) {
        dispatch({ type: 'CLEAR_WORKBOOK' });
        return;
      }
      try {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellStyles: true });

        const expected = Object.keys(sheetLayouts);
        const incoming = new Set(wb.SheetNames);
        const missing = expected.filter((n) => !incoming.has(n));
        const extra = wb.SheetNames.filter((n) => expected.length > 0 && !expected.includes(n));

        let nextWarning: string | null = null;
        if (missing.length || extra.length) {
          const parts: string[] = [];
          if (missing.length) parts.push(`missing sheets: ${missing.join(', ')}`);
          if (extra.length) parts.push(`extra sheets: ${extra.join(', ')}`);
          nextWarning = `Uploaded file does not match stored layout — ${parts.join('; ')}`;
        }

        const nextLayouts: Record<string, SourceLayout> = { ...sheetLayouts };
        const nextAuto: Record<string, SourceLayout> = {};
        const nextConfig: Record<string, SheetConfig> = { ...sheetsConfig };
        for (const name of wb.SheetNames) {
          const auto = autoDetectLayout(wb, name);
          nextAuto[name] = auto;
          if (!nextLayouts[name]) nextLayouts[name] = auto;
          if (!nextConfig[name]) nextConfig[name] = { mode: 'combine' };
        }
        dispatch({ type: 'LOAD_WORKBOOK', workbook: wb, sheetLayouts: nextLayouts, autoDetectedLayouts: nextAuto, sheetsConfig: nextConfig, warning: nextWarning });
      } catch (err) {
        dispatch({ type: 'SET_WARNING', warning: `Failed to parse Excel file: ${(err as Error).message}` });
      }
    }

    function clearWorkbook() {
      dispatch({ type: 'CLEAR_WORKBOOK' });
    }

    function handleSheetLayoutChange(sheetName: string, newLayout: SourceLayout) {
      dispatch({ type: 'SET_SHEET_LAYOUT', sheetName, layout: newLayout });
    }

    function handleSheetModeChange(sheetName: string, mode: 'combine' | 'skip') {
      dispatch({ type: 'SET_SHEET_MODE', sheetName, mode });
    }

    function handleSheetTotalColumnModeChange(sheetName: string, mode: TotalColumnMode) {
      dispatch({ type: 'SET_SHEET_TOTAL_COLUMN_MODE', sheetName, mode });
    }

    return (
      <ArtCollapse title="Source Layout" defaultOpen={false}>
        <div className="flex flex-col gap-3">
          {!workbook && (
            <ReadonlySummary
              layout={initialLayout}
              sheetLayouts={initialSheetLayouts}
              sheetsConfig={initialSheetsConfig}
            />
          )}

          <div className="flex items-start gap-3">
            <div style={{ flex: 1 }}>
              <ArtUpload
                label={workbook ? 'Replace Excel file' : 'Upload Excel to edit Source Layout'}
                hint="Excel (.xlsx, .xls)"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
              />
            </div>
            {workbook && (
              <div style={{ paddingTop: 28 }}>
                <ArtButton type="button" variant="ghost" size="sm" onClick={clearWorkbook}>
                  Remove file
                </ArtButton>
              </div>
            )}
          </div>

          {warning && (
            <p className="text-xs" style={{ color: 'var(--art-warning)' }}>
              {warning}
            </p>
          )}

          {workbook && (
            <SourceLayoutSection
              bare
              workbook={workbook}
              sheetLayouts={sheetLayouts}
              autoDetectedLayouts={autoDetectedLayouts}
              sheetsConfig={sheetsConfig}
              onSheetLayoutChange={handleSheetLayoutChange}
              onSheetModeChange={handleSheetModeChange}
              onSheetTotalColumnModeChange={handleSheetTotalColumnModeChange}
            />
          )}
        </div>
      </ArtCollapse>
    );
}

export default SourceLayoutFormSection;

'use client';

import { forwardRef, useImperativeHandle, useState } from 'react';
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
          <span style={{ color: 'var(--text-muted)' }}>Primary layout — </span>
          <span>header row {layout.headerRow + 1}, {layout.regions.length} region{layout.regions.length !== 1 ? 's' : ''}</span>
          {layout.regions.length > 0 && (
            <ul className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {layout.regions.map((r, i) => (
                <li key={i}>Region {i + 1}: {describeRegion(r)}</li>
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

const SourceLayoutFormSection = forwardRef<SourceLayoutFormSectionRef, SourceLayoutFormSectionProps>(
  ({ initialLayout, initialSheetLayouts, initialSheetsConfig }, ref) => {
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [sheetLayouts, setSheetLayouts] = useState<Record<string, SourceLayout>>(
      initialSheetLayouts ?? {},
    );
    const [autoDetectedLayouts, setAutoDetectedLayouts] = useState<Record<string, SourceLayout>>({});
    const [sheetsConfig, setSheetsConfig] = useState<Record<string, SheetConfig>>(
      initialSheetsConfig ?? {},
    );
    const [warning, setWarning] = useState<string | null>(null);

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
        setWorkbook(null);
        setWarning(null);
        return;
      }
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellStyles: true });

        const expected = Object.keys(sheetLayouts);
        const incoming = new Set(wb.SheetNames);
        const missing = expected.filter((n) => !incoming.has(n));
        const extra = wb.SheetNames.filter((n) => expected.length > 0 && !expected.includes(n));

        if (missing.length || extra.length) {
          const parts: string[] = [];
          if (missing.length) parts.push(`missing sheets: ${missing.join(', ')}`);
          if (extra.length) parts.push(`extra sheets: ${extra.join(', ')}`);
          setWarning(`Uploaded file does not match stored layout — ${parts.join('; ')}`);
        } else {
          setWarning(null);
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
        setSheetLayouts(nextLayouts);
        setAutoDetectedLayouts(nextAuto);
        setSheetsConfig(nextConfig);
        setWorkbook(wb);
      } catch (err) {
        setWarning(`Failed to parse Excel file: ${(err as Error).message}`);
      }
    }

    function clearWorkbook() {
      setWorkbook(null);
      setWarning(null);
    }

    function handleSheetLayoutChange(sheetName: string, newLayout: SourceLayout) {
      setSheetLayouts((prev) => ({ ...prev, [sheetName]: newLayout }));
    }

    function handleSheetModeChange(sheetName: string, mode: 'combine' | 'skip') {
      setSheetsConfig((prev) => ({
        ...prev,
        [sheetName]: { ...(prev[sheetName] ?? { mode: 'combine' }), mode },
      }));
    }

    function handleSheetTotalColumnModeChange(sheetName: string, mode: TotalColumnMode) {
      setSheetsConfig((prev) => ({
        ...prev,
        [sheetName]: { ...(prev[sheetName] ?? { mode: 'combine' }), totalColumnMode: mode },
      }));
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
  },
);

SourceLayoutFormSection.displayName = 'SourceLayoutFormSection';
export default SourceLayoutFormSection;

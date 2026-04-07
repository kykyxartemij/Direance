'use client';

import { useState } from 'react';
import type * as XLSX from 'xlsx';
import type { SourceLayout } from '@/models/mapping.models';
import { sheetToGrid } from '@/page/mapping/applyMapping';
import ArtTabs from '@/components/ui/ArtTabs';

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

function formatCellValue(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return String(v);
}

// ==== Region color helpers ====

const REGION_COLOR_VARS = ['--art-primary', '--art-success', '--art-warning', '--art-danger'] as const;

function regionAccentVar(regionIdx: number) {
  return REGION_COLOR_VARS[regionIdx % REGION_COLOR_VARS.length];
}

// ==== Props ====

interface ExcelViewerProps {
  workbook: XLSX.WorkBook;
  /** When provided, colors cells by region assignment. */
  layout?: SourceLayout;
  /** Pin to a specific sheet — no tab switcher rendered. */
  fixedSheet?: string;
}

// ==== Component ====

export default function ExcelViewer({ workbook, layout, fixedSheet }: ExcelViewerProps) {
  const [activeSheet, setActiveSheet] = useState(workbook.SheetNames[0]);
  const sheet = fixedSheet ?? activeSheet;

  const ws = workbook.Sheets[sheet];
  const grid = ws ? sheetToGrid(ws) : [];
  const totalCols = grid[0]?.length ?? 0;

  // ==== Column role map ====
  type ColRole = { regionIdx: number; role: 'desc' | 'value' };
  const colRole = new Map<number, ColRole>();
  if (layout) {
    layout.regions.forEach((r, ri) => {
      colRole.set(r.descriptionColumn, { regionIdx: ri, role: 'desc' });
      r.valueColumns.forEach((vc) => colRole.set(vc, { regionIdx: ri, role: 'value' }));
    });
  }

  // ==== Header row (the column-label row just above region 0 data) ====
  let headerRow: number | null = null;
  if (layout && layout.regions.length > 0) {
    const r0 = layout.regions[0];
    const dataStart = r0.startRow ?? (layout.headerRow + 1);
    headerRow = Math.max(0, dataStart - 1);
  }

  // ==== Cell background ====
  function cellBg(r: number, c: number): string | undefined {
    const isHeader = headerRow !== null && r === headerRow;
    const role = colRole.get(c);
    const av = role ? regionAccentVar(role.regionIdx) : null;

    if (isHeader && av) {
      return `color-mix(in srgb, var(${av}) 28%, var(--surface))`;
    }
    if (isHeader) {
      return 'color-mix(in srgb, var(--text-muted) 12%, var(--surface))';
    }
    if (role?.role === 'desc') {
      return 'color-mix(in srgb, var(--text-muted) 9%, var(--surface))';
    }
    if (role?.role === 'value') {
      return `color-mix(in srgb, var(${av!}) 18%, transparent)`;
    }
    return undefined;
  }

  const tabs = workbook.SheetNames.map((name) => ({ value: name, label: name }));
  const showTabs = !fixedSheet && workbook.SheetNames.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {showTabs && <ArtTabs tabs={tabs} value={activeSheet} onChange={setActiveSheet} />}

      {/* Region legend */}
      {layout && layout.regions.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {layout.regions.map((r, ri) => {
            const av = regionAccentVar(ri);
            return (
              <span key={ri} className="flex items-center gap-1">
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: `color-mix(in srgb, var(${av}) 18%, transparent)`,
                    border: `1px solid var(${av})`,
                  }}
                />
                {colLetter(r.descriptionColumn)}
                {r.valueColumns.length > 0 && <> → {r.valueColumns.map((vc) => colLetter(vc)).join(', ')}</>}
              </span>
            );
          })}
        </div>
      )}

      <div className="art-excel-grid art-scrollable" style={{ maxHeight: '60vh', overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th className="art-excel-corner" />
              {Array.from({ length: totalCols }, (_, c) => {
                const role = colRole.get(c);
                const av = role ? regionAccentVar(role.regionIdx) : null;
                return (
                  <th
                    key={c}
                    className="art-excel-col-header"
                    style={av ? { color: `var(${av})`, background: `color-mix(in srgb, var(${av}) 10%, transparent)` } : undefined}
                  >
                    {colLetter(c)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => {
              const isHeader = headerRow !== null && r === headerRow;
              return (
                <tr key={r}>
                  <td className="art-excel-row-number">{r + 1}</td>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className="art-excel-cell"
                      style={{
                        background: cellBg(r, c),
                        fontWeight: isHeader ? 600 : undefined,
                      }}
                    >
                      {formatCellValue(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

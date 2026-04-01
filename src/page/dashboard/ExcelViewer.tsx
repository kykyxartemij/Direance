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

function regionCellBg(regionIdx: number, role: 'desc' | 'value'): string {
  const v = REGION_COLOR_VARS[regionIdx % REGION_COLOR_VARS.length];
  const alpha = role === 'desc' ? 14 : 22;
  return `color-mix(in srgb, var(${v}) ${alpha}%, transparent)`;
}

function regionHeaderColor(regionIdx: number): string {
  return `var(${REGION_COLOR_VARS[regionIdx % REGION_COLOR_VARS.length]})`;
}

// ==== Props ====

interface ExcelViewerProps {
  workbook: XLSX.WorkBook;
  /** When provided, colors cells by region assignment. */
  layout?: SourceLayout;
}

// ==== Component ====

export default function ExcelViewer({ workbook, layout }: ExcelViewerProps) {
  const [activeSheet, setActiveSheet] = useState(workbook.SheetNames[0]);

  const ws = workbook.Sheets[activeSheet];
  const grid = ws ? sheetToGrid(ws) : [];
  const totalCols = grid[0]?.length ?? 0;

  // Build column role map from layout
  type ColRole = { regionIdx: number; role: 'desc' | 'value' };
  const colRole = new Map<number, ColRole>();
  if (layout) {
    layout.regions.forEach((r, ri) => {
      colRole.set(r.descriptionColumn, { regionIdx: ri, role: 'desc' });
      r.valueColumns.forEach((vc) => colRole.set(vc, { regionIdx: ri, role: 'value' }));
    });
  }

  const tabs = workbook.SheetNames.map((name) => ({ value: name, label: name }));

  return (
    <div className="flex flex-col gap-3">
      {workbook.SheetNames.length > 1 && (
        <ArtTabs tabs={tabs} value={activeSheet} onChange={setActiveSheet} />
      )}

      {/* Region legend */}
      {layout && layout.regions.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {layout.regions.map((_, ri) => (
            <span key={ri} className="flex items-center gap-1">
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: regionCellBg(ri, 'value'),
                  border: `1px solid ${regionHeaderColor(ri)}`,
                }}
              />
              Region {ri + 1}
            </span>
          ))}
        </div>
      )}

      <div className="art-excel-grid art-scrollable" style={{ maxHeight: '60vh', overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th className="art-excel-corner" />
              {Array.from({ length: totalCols }, (_, c) => {
                const role = colRole.get(c);
                return (
                  <th
                    key={c}
                    className="art-excel-col-header"
                    style={role ? {
                      color: regionHeaderColor(role.regionIdx),
                      background: regionCellBg(role.regionIdx, 'value'),
                    } : undefined}
                  >
                    {colLetter(c)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                <td className="art-excel-row-number">{r + 1}</td>
                {row.map((cell, c) => {
                  const role = colRole.get(c);
                  return (
                    <td
                      key={c}
                      className="art-excel-cell"
                      style={role ? { background: regionCellBg(role.regionIdx, role.role) } : undefined}
                    >
                      {formatCellValue(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

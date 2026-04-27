'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useReports } from '@/providers/ReportProvider';
import ArtButton from '@/components/ui/ArtButton';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtDataTable, { type ArtColumn } from '@/components/ui/ArtDataTable';
import ArtTabs from '@/components/ui/ArtTabs';
import type { ArtColor } from '@/components/ui/art.types';
import type { ExportSettingResolvedModel } from '@/models/export-settings.models';
import { combineReports, buildProcessedWorkbook, type Row } from './combineReports';
import { exportToExcel } from './exportExcel';
import ExcelViewer from './ExcelViewer';
import ExportDialog from './ExportDialog';

// ==== Helpers ====

function formatCell(value: unknown): string {
  if (value === '' || value == null) return '';
  const num = Number(value);
  if (!isNaN(num)) return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return String(value);
}

function colorToCssVar(color: ArtColor | undefined): string | undefined {
  if (!color || color === 'neutral') return undefined;
  return `var(--art-${color})`;
}

function buildColumns(
  headers: string[],
  rowIndents: number[],
  rowColors: (ArtColor | undefined)[] = [],
  valueColors: (ArtColor | undefined)[] = [],
  totalColumnIndices?: Set<number>,
): ArtColumn<Row>[] {
  const [descHeader, ...valueHeaders] = headers;

  return [
    {
      key: descHeader,
      label: descHeader,
      sticky: true,
      width: 220,
      render: (row, index) => {
        const indent = rowIndents[index] ?? 0;
        const isEmpty = valueHeaders.every((h) => !row[h]);
        const isTotal = /^total/i.test(String(row[descHeader] ?? ''));
        const nameColor = colorToCssVar(rowColors[index]);

        return (
          <span
            style={{
              fontWeight: indent === 0 && (isEmpty || isTotal) ? 600 : undefined,
              color: nameColor ?? 'var(--text)',
            }}
          >
            {String(row[descHeader] ?? '')}
          </span>
        );
      },
    },
    ...valueHeaders.map((h, vIdx) => ({
      key: `${vIdx}_${h}`,
      label: totalColumnIndices?.has(vIdx + 1) ? `Σ ${h}` : h,
      render: (row: Row, index: number) => (
        <span
          className="tabular-nums"
          style={{
            display: 'block',
            textAlign: 'right' as const,
            fontWeight: totalColumnIndices?.has(vIdx + 1) ? 600 : undefined,
            color: colorToCssVar(valueColors[index]),
          }}
        >
          {formatCell(row[h])}
        </span>
      ),
    })),
  ];
}

function getRowClass(row: Row, index: number, valueHeaders: string[], rowIndents: number[]): string | undefined {
  const indent = rowIndents[index] ?? 0;
  const isEmpty = valueHeaders.every((h) => row[h] === '' || row[h] == null);
  const isTotal = /^total/i.test(String(Object.values(row)[0] ?? ''));

  if (!isEmpty && !isTotal) return 'art-data-tr--base';
  return indent === 0 ? 'art-data-tr--elevated' : undefined;
}

/** Filter headers and rows to only include visible columns */
function filterByVisibility(
  headers: string[],
  rows: Row[],
  hiddenIndices: Set<number>,
): { headers: string[]; rows: Row[] } {
  if (hiddenIndices.size === 0) return { headers, rows };
  const visibleHeaders = headers.filter((_, i) => !hiddenIndices.has(i));
  const visibleRows = rows.map((row) => {
    const out: Row = {};
    for (let i = 0; i < headers.length; i++) {
      if (!hiddenIndices.has(i)) out[headers[i]] = row[headers[i]];
    }
    return out;
  });
  return { headers: visibleHeaders, rows: visibleRows };
}

// ==== Component ====

const VIEW_TABS = [
  { value: 'table', label: 'Table' },
  { value: 'excel', label: 'Excel' },
];

export default function Dashboard() {
  const { reports } = useReports();
  const [view, setView] = useState('table');
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(new Set());

  if (reports.length === 0) {
    return (
      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <p className="text-lg font-medium" style={{ color: 'var(--text)' }}>
          No reports uploaded yet
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Upload one or more Excel reports to see them combined here.
        </p>
        <Link href="/upload" prefetch>
          <ArtButton color="primary">Upload report</ArtButton>
        </Link>
      </div>
    );
  }

  const { headers, rows, rowIndents, rowColors, valueColors, totalColumns } = combineReports(reports);
  const [, ...valueHeaders] = headers;

  // Build sets for quick lookup
  const totalColumnIndexSet = new Set(totalColumns?.map((tc) => tc.headerIndex) ?? []);
  const hasTotalColumns = totalColumnIndexSet.size > 0;

  // Apply column visibility filter
  const { headers: visibleHeaders, rows: visibleRows } = filterByVisibility(headers, rows, hiddenColumns);

  // Collect original workbooks for includeOriginalSheets
  const originalWorkbooks = reports.map((r) => ({
    name: r.fileName.replace(/\.(xlsx|xls)$/i, ''),
    workbook: r.workbook,
    skippedSheets: r.skippedSheets,
  }));

  function toggleColumn(headerIndex: number) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(headerIndex)) next.delete(headerIndex);
      else next.add(headerIndex);
      return next;
    });
  }

  async function handleExport(
    setting: ExportSettingResolvedModel | null,
    placeholders?: Record<string, string>,
    fileName?: string,
  ) {
    await exportToExcel(
      visibleHeaders, visibleRows, rowIndents, rowColors, valueColors,
      setting, originalWorkbooks, placeholders, fileName, totalColumns,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ArtTabs tabs={VIEW_TABS} value={view} onChange={setView} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {reports.length} report{reports.length > 1 ? 's' : ''} &nbsp;·&nbsp; {rows.length} rows
          </p>
          {reports.some((r) => !r.processedHeaders) && (
            <div className="flex items-center gap-2">
              {reports.filter((r) => !r.processedHeaders).map((r) => (
                <Link key={r.id} href="/upload">
                  <ArtBadge color="warning" size="sm">
                    {r.fileName} — unmapped
                  </ArtBadge>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <ExportDialog onExport={handleExport} />
          <Link href="/upload" prefetch>
            <ArtButton color="primary">Add report</ArtButton>
          </Link>
        </div>
      </div>

      {/* Column visibility toggles — shown when total columns exist */}
      {hasTotalColumns && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
            Columns
          </span>
          {valueHeaders.map((h, i) => {
            const headerIndex = i + 1;
            const isTotal = totalColumnIndexSet.has(headerIndex);
            return (
              <ArtCheckbox
                key={headerIndex}
                label={h}
                size="sm"
                checked={!hiddenColumns.has(headerIndex)}
                onChange={() => toggleColumn(headerIndex)}
                color={isTotal ? 'primary' : undefined}
              />
            );
          })}
        </div>
      )}

      {view === 'table' ? (
        <ArtDataTable<Row>
          columns={buildColumns(visibleHeaders, rowIndents, rowColors, valueColors, totalColumnIndexSet)}
          data={visibleRows}
          rowKey={(_, index) => String(index)}
          rowClassName={(row, index) => getRowClass(row, index, valueHeaders, rowIndents)}
          emptyMessage="No rows found"
        />
      ) : (
        <ExcelViewer workbook={buildProcessedWorkbook(visibleHeaders, visibleRows)} fixedSheet="Report" />
      )}
    </div>
  );
}

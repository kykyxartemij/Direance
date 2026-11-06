'use client';

import { useState } from 'react';
import type { UploadedReport } from '@/providers/ReportProvider/types';
import { useExportExcel } from '@/hooks/excel.hooks';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtSkeleton from '@/components/ui/ArtSkeleton';
import ArtSwitch from '@/components/ui/ArtSwitch';
import ArtDataTable from '@/components/ui/ArtDataTable/ArtDataTable';
import type { ArtColumn } from '@/components/ui/ArtDataTable/types';
// import ArtTabs from '@/components/ui/ArtTabs';
import type { ArtColor } from '@/components/ui/art.types';
import type { MappedValueModel } from '@/models/export-settings.models';
import { combineReports, /* buildProcessedWorkbook, */ type Row } from './combineReports';
// import ExcelViewer from './ExcelViewer';
import ExportDialog, { type ExportRequest } from './ExportDialog';
import { FSLink } from '@/components/FSLink';
import { HREF } from '@/lib/hrefUrl';

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

const TOTAL_COL_KEY = '__total__';
const TOTAL_COL_LABEL = 'Σ Total';

// Categories override Name color only — Value color stays per-report so different
// uploads (e.g. one primary, one warning) keep distinct column-side tints.
function applyCategoryNameColors(
  rows: Row[],
  descHeader: string,
  baseRowColors: (ArtColor | undefined)[],
  categories: MappedValueModel[],
): (ArtColor | undefined)[] {
  if (categories.length === 0) return baseRowColors;
  const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.color]));
  return rows.map((row, i) => {
    const desc = String(row[descHeader] ?? '').trim().toLowerCase();
    return byName.get(desc) ?? baseRowColors[i];
  });
}

function computeRowTotal(row: Row, valueHeaders: string[]): number {
  let sum = 0;
  for (const h of valueHeaders) {
    const n = Number(row[h]);
    if (!isNaN(n)) sum += n;
  }
  return sum;
}

function buildColumns(
  headers: string[],
  rowIndents: number[],
  rowColors: (ArtColor | undefined)[],
  valueColorByHeader: Record<string, ArtColor | undefined>[],
  showDerivedTotal = false,
): ArtColumn<Row>[] {
  const [descHeader, ...valueHeaders] = headers;

  return [
    {
      key: descHeader,
      label: descHeader,
      sticky: true,
      sizing: { width: 220 },
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
      label: h,
      align: 'right' as const,
      sizing: {},
      render: (row: Row, index: number) => (
        <span
          className="tabular-nums"
          style={{
            display: 'block',
            textAlign: 'right' as const,
            color: colorToCssVar(valueColorByHeader[index]?.[h]),
          }}
        >
          {formatCell(row[h])}
        </span>
      ),
    })),
    ...(showDerivedTotal ? [{
      key: TOTAL_COL_KEY,
      label: TOTAL_COL_LABEL,
      align: 'right',
      sizing: {},
      render: (row: Row, index: number) => {
        // Σ Total tinted by the row's name color (matches the category if matched).
        const total = computeRowTotal(row, valueHeaders);
        return (
          <span
            className="tabular-nums"
            style={{
              display: 'block',
              textAlign: 'right' as const,
              fontWeight: 600,
              color: colorToCssVar(rowColors[index]),
            }}
          >
            {formatCell(total)}
          </span>
        );
      },
    } as ArtColumn<Row>] : []),
  ];
}

function getRowClass(row: Row, index: number, valueHeaders: string[], rowIndents: number[]): string | undefined {
  const indent = rowIndents[index] ?? 0;
  const isEmpty = valueHeaders.every((h) => row[h] === '' || row[h] == null);
  const isTotal = /^total/i.test(String(Object.values(row)[0] ?? ''));

  if (!isEmpty && !isTotal) return 'art-data-tr--base';
  return indent === 0 ? 'art-data-tr--elevated' : undefined;
}

// ==== Component ====

// TODO: restore the Excel view once it renders reports correctly (see TODO.md).
/*
const VIEW_TABS = [
  { value: 'table', label: 'Table' },
  { value: 'excel', label: 'Excel' },
];
*/

type ReportViewProps = {
  // Already filtered to one report type + merged (file uploads + connection fetches) by the
  // owning page — ReportView is a pure presentation over this list, no data source of its own.
  reports: UploadedReport[];
  // True while connection reports are still being fetched — owning page passes its query's isFetching.
  loading?: boolean;
};

export default function ReportView({ reports, loading }: ReportViewProps) {
  // const [view, setView] = useState('table');
  // null = not toggled yet, so the default follows the linked setting once reports load.
  const [showTotalChoice, setShowTotalChoice] = useState<boolean | null>(null);
  const { mutateAsync: exportExcel } = useExportExcel();

  if (loading && reports.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <ArtSkeleton style={{ height: 36 }} />
        <ArtSkeleton style={{ height: 220 }} />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="mt-16 flex flex-col items-center gap-2 text-center">
        <p className="text-lg font-medium">
          Nothing here yet
        </p>
        <p className="text-sm art-text-muted">
          Turn on a connection or upload a file from the sidebar.
        </p>
      </div>
    );
  }

  const combined = combineReports(reports);
  const { headers, rows, rowIndents, rowColors: baseRowColors, valueColorByHeader } = combined;
  const [descHeader, ...valueHeaders] = headers;

  // Categories + Σ Total default come from the first mapped report's linked ExportSetting.
  const linkedSetting = reports.find((r) => r.mapping?.exportSetting)?.mapping?.exportSetting ?? null;
  const categories: MappedValueModel[] = linkedSetting?.mappedValues ?? [];
  const rowColors = applyCategoryNameColors(rows, descHeader, baseRowColors, categories);
  const showTotal = showTotalChoice ?? linkedSetting?.hasTotalColumn ?? false;

  // Only reports that feed the table; skipped sheets are dropped at export time.
  const originalWorkbooks = reports.flatMap((r) => (r.active && r.mapped
    ? [{ name: r.fileName.replace(/\.(xlsx|xls)$/i, ''), workbook: r.workbook, skippedSheets: r.mapped.skippedSheets }]
    : []));

  const unmappedReports = reports.filter((r) => !r.mapped);

  async function handleExport({ setting, ...options }: ExportRequest) {
    await exportExcel({
      headers, rows, rowIndents, rowColors, valueColorByHeader,
      exportSettings: setting, originalWorkbooks, ...options,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar: tabs + meta + export controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* <ArtTabs tabs={VIEW_TABS} value={view} onChange={setView} /> */}
          <p className="text-sm art-text-muted">
            {reports.length} report{reports.length > 1 ? 's' : ''} &nbsp;·&nbsp; {rows.length} rows
          </p>
          {unmappedReports.length > 0 && (
            <div className="flex items-center gap-2">
              {unmappedReports.map((r) => (
                <FSLink key={r.id} href={HREF.upload}>
                  <ArtBadge color="warning" size="sm">
                    {r.fileName} (unmapped)
                  </ArtBadge>
                </FSLink>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <ArtSwitch label="Σ Total" checked={showTotal} onChange={(e) => setShowTotalChoice(e.target.checked)} />
          <ExportDialog defaultHasTotalColumn={showTotal} onExport={handleExport} />
        </div>
      </div>

      <ArtDataTable<Row>
        columns={buildColumns(headers, rowIndents, rowColors, valueColorByHeader, showTotal)}
        data={rows}
        rowKey={(_, index) => String(index)}
        rowClassName={(row, index) => getRowClass(row, index, valueHeaders, rowIndents)}
        emptyMessage="No rows found"
        lastColRightAlign={false}
      />
      {/* view === 'excel' && <ExcelViewer workbook={buildProcessedWorkbook(headers, rows)} fixedSheet="Report" /> */}
    </div>
  );
}

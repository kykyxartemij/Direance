'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useReports } from '@/providers/ReportProvider';
import { useGetLightExportSettings, useGetExportSettingById } from '@/hooks/export-settings.hooks';
import ArtButton from '@/components/ui/ArtButton';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtComboBox, { type ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import ArtDataTable, { type ArtColumn } from '@/components/ui/ArtDataTable';
import ArtTabs from '@/components/ui/ArtTabs';
import type { ArtColor } from '@/components/ui/art.types';
import type { ExportSettingResolvedModel, MappedValueModel } from '@/models/export-settings.models';
import { combineReports, buildProcessedWorkbook, type Row } from './combineReports';
import { exportToExcel } from './exportExcel';
import ExcelViewer from './ExcelViewer';
import ExportDialog from './ExportDialog';
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

const VIEW_TABS = [
  { value: 'table', label: 'Table' },
  { value: 'excel', label: 'Excel' },
];

export default function Dashboard() {
  const { reports } = useReports();
  const [view, setView] = useState('table');

  // Default ExportSetting comes from the first mapped report's linked ExportSetting.
  const defaultExportSettingId = reports.find((r) => r.mapping?.exportSetting?.id)?.mapping?.exportSetting?.id ?? null;
  const [selectedExportSettingId, setSelectedExportSettingId] = useState<string | null>(defaultExportSettingId);
  const { data: exportSettingsList = [] } = useGetLightExportSettings();
  const { data: selectedExportSetting } = useGetExportSettingById(selectedExportSettingId ?? undefined);

  if (reports.length === 0) {
    return (
      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <p className="text-lg font-medium" style={{ color: 'var(--text)' }}>
          No reports uploaded yet
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Upload one or more Excel reports to see them combined here.
        </p>
        <Link href={HREF.upload} prefetch>
          <ArtButton color="primary">Upload report</ArtButton>
        </Link>
      </div>
    );
  }

  const combined = combineReports(reports);
  const { headers, rows, rowIndents, rowColors: baseRowColors, valueColorByHeader } = combined;
  const [descHeader, ...valueHeaders] = headers;

  const categories: MappedValueModel[] = selectedExportSetting?.mappedValues ?? [];
  const rowColors = applyCategoryNameColors(rows, descHeader, baseRowColors, categories);
  const showDerivedTotal = selectedExportSetting?.hasTotalColumn ?? false;

  const exportSettingOptions: ArtComboBoxOption[] = exportSettingsList.map((es) => ({
    label: es.name,
    value: es.id,
  }));
  const selectedExportSettingOption =
    exportSettingOptions.find((o) => o.value === selectedExportSettingId) ?? null;

  // Original workbook + skipped sheets per report — fed to export when
  // includeOriginalSheets is on. Skipped sheets are filtered out at export time.
  const originalWorkbooks = reports.map((r) => ({
    name: r.fileName.replace(/\.(xlsx|xls)$/i, ''),
    workbook: r.workbook,
    skippedSheets: r.mapped?.skippedSheets ?? [],
  }));

  const unmappedReports = reports.filter((r) => !r.mapped);

  async function handleExport(
    setting: ExportSettingResolvedModel | null,
    placeholders?: Record<string, string>,
    fileName?: string,
  ) {
    await exportToExcel(
      headers, rows, rowIndents, rowColors, valueColorByHeader,
      setting, originalWorkbooks, placeholders, fileName, undefined,
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
          {unmappedReports.length > 0 && (
            <div className="flex items-center gap-2">
              {unmappedReports.map((r) => (
                <FSLink key={r.id} href={HREF.upload}>
                  <ArtBadge color="warning" size="sm">
                    {r.fileName} — unmapped
                  </ArtBadge>
                </FSLink>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {exportSettingOptions.length > 0 && (
            <div style={{ minWidth: 220 }}>
              <ArtComboBox
                options={exportSettingOptions}
                selected={selectedExportSettingOption}
                placeholder="Export setting…"
                clearable
                onChange={(opt) => setSelectedExportSettingId(opt?.value ?? null)}
              />
            </div>
          )}
          <ExportDialog onExport={handleExport} />
          <Link href={HREF.upload} prefetch>
            <ArtButton color="primary">Add report</ArtButton>
          </Link>
        </div>
      </div>

      {showDerivedTotal && (
        <div className="flex flex-wrap items-center gap-3">
          <ArtCheckbox
            label="Show Σ Total column"
            size="sm"
            checked
            onChange={() => { /* selector handles this — checkbox here is visual */ }}
            color="primary"
          />
        </div>
      )}

      {view === 'table' ? (
        <ArtDataTable<Row>
          columns={buildColumns(headers, rowIndents, rowColors, valueColorByHeader, showDerivedTotal)}
          data={rows}
          rowKey={(_, index) => String(index)}
          rowClassName={(row, index) => getRowClass(row, index, valueHeaders, rowIndents)}
          emptyMessage="No rows found"
          lastColRightAlign={false}
        />
      ) : (
        <ExcelViewer workbook={buildProcessedWorkbook(headers, rows)} fixedSheet="Report" />
      )}
    </div>
  );
}

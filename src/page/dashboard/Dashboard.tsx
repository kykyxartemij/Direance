'use client';

import { useState } from 'react';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { useReports, type UploadedReport } from '@/providers/ReportProvider';
import { parseWorkbook } from '@/page/mapping/applyMapping';
import ArtButton from '@/components/ui/ArtButton';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtDataTable, { type ArtColumn } from '@/components/ui/ArtDataTable';
import ArtTabs from '@/components/ui/ArtTabs';
import type { ArtColor } from '@/components/ui/art.types';
import type { ExportSetting } from '@/models/export-settings.models';
import ExcelViewer from './ExcelViewer';

// ==== Types ====

type Row = Record<string, unknown>;

// ==== Combine logic ====

function combineReports(reports: UploadedReport[]): {
  headers: string[];
  rows: Row[];
  rowIndents: number[];
  rowColors: (ArtColor | undefined)[];
  valueColors: (ArtColor | undefined)[];
} {
  if (reports.length === 0) return { headers: [], rows: [], rowIndents: [], rowColors: [], valueColors: [] };

  const parsed = reports.map((r) => {
    const base = r.processedHeaders && r.processedRows
      ? { headers: r.processedHeaders, rows: r.processedRows }
      : parseWorkbook(r.workbook, r.activeSheet);
    return {
      label: r.fileName.replace(/\.(xlsx|xls)$/i, '').slice(0, 10),
      rowIndents: r.rowIndents,
      rowColors: r.rowColors ?? [],
      valueColors: r.valueColors ?? [],
      ...base,
    };
  });

  if (parsed.length === 1) {
    return {
      headers: parsed[0].headers,
      rows: parsed[0].rows,
      rowIndents: parsed[0].rowIndents,
      rowColors: parsed[0].rowColors,
      valueColors: parsed[0].valueColors,
    };
  }

  const descHeader = parsed[0].headers[0];
  const combinedHeaders = [
    descHeader,
    ...parsed.flatMap(({ label, headers }) => headers.slice(1).map((h: string) => `${label} · ${h}`)),
  ];

  const rowMap = new Map<string, Row>();
  const colorMap = new Map<string, { nameColor?: ArtColor; valueColor?: ArtColor }>();
  for (const { label, rows, headers, rowColors, valueColors } of parsed) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const desc = String(row[headers[0]] ?? '');
      if (!rowMap.has(desc)) {
        rowMap.set(desc, { [descHeader]: desc });
        colorMap.set(desc, { nameColor: rowColors[i], valueColor: valueColors[i] });
      }
      const merged = rowMap.get(desc)!;
      for (const h of headers.slice(1)) merged[`${label} · ${h}`] = row[h];
    }
  }

  const orderedRows = Array.from(rowMap.values());
  const orderedColors = Array.from(colorMap.values());

  return {
    headers: combinedHeaders,
    rows: orderedRows,
    rowIndents: parsed[0].rowIndents,
    rowColors: orderedColors.map((c) => c.nameColor),
    valueColors: orderedColors.map((c) => c.valueColor),
  };
}

// ==== Processed workbook for ExcelViewer ====

function buildProcessedWorkbook(headers: string[], rows: Row[]) {
  const aoa = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  return wb;
}

// ==== Excel export (ExcelJS) ====

const FONT_COLOR: Record<string, string> = {
  primary: 'FF646CFF',
  success: 'FF22C55E',
  warning: 'FFEAB308',
  danger:  'FFEF4444',
};

const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFD0D0D0' } };
const CELL_BORDER: Partial<ExcelJS.Borders> = {
  top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER,
};

function cellRefToAnchor(ref: string): { col: number; row: number } {
  const m = ref.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return { col: 0, row: 0 };
  const col = m[1].toUpperCase().split('').reduce((acc, c) => acc * 26 + (c.charCodeAt(0) - 64), 0) - 1;
  return { col, row: parseInt(m[2], 10) - 1 };
}

async function exportToExcel(
  headers: string[],
  rows: Row[],
  rowIndents: number[],
  rowColors: (ArtColor | undefined)[] = [],
  valueColors: (ArtColor | undefined)[] = [],
  exportSettings?: ExportSetting | null,
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');

  const [descHeader, ...valueHeaders] = headers;

  // ==== Column widths ====
  ws.columns = [
    { width: 38 },
    ...valueHeaders.map(() => ({ width: 20 })),
  ];

  // ==== Header row ====
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'right' };
  });

  // Track section starts per value column for SUM formulas
  const sectionStart: Record<number, number> = {};

  // ==== Data rows ====
  rows.forEach((row, rowIdx) => {
    const excelRowNum = rowIdx + 2; // 1-based, +1 for header
    const desc = String(row[descHeader] ?? '');
    const isTotal = /^total/i.test(desc);
    const isEmpty = valueHeaders.every((h) => row[h] === '' || row[h] == null);
    const indent = rowIndents[rowIdx] ?? 0;
    const isSection = isEmpty && !isTotal;
    const isTopLevel = indent === 0 && (isSection || isTotal);

    const nameArgb = rowColors[rowIdx] ? FONT_COLOR[rowColors[rowIdx]!] : undefined;
    const valArgb = valueColors[rowIdx] ? FONT_COLOR[valueColors[rowIdx]!] : undefined;

    const xlRow = ws.addRow([]);

    // ==== Name cell ====
    const nameCell = xlRow.getCell(1);
    nameCell.value = desc;
    nameCell.border = CELL_BORDER;
    nameCell.font = {
      bold: isTopLevel,
      color: nameArgb ? { argb: nameArgb } : undefined,
    };
    if (isTopLevel && isSection) {
      nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    } else if (isTotal) {
      nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    }

    // ==== Value cells ====
    valueHeaders.forEach((h, vIdx) => {
      const colNum = vIdx + 2;
      const colLetter = ws.getColumn(colNum).letter;
      const cell = xlRow.getCell(colNum);
      cell.border = CELL_BORDER;
      cell.alignment = { horizontal: 'right' };
      cell.font = { bold: isTopLevel, color: valArgb ? { argb: valArgb } : undefined };

      if (isTopLevel && isSection) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      } else if (isTotal) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      }

      if (isEmpty) {
        cell.value = '';
        delete sectionStart[colNum];
      } else if (isTotal && sectionStart[colNum] != null) {
        cell.value = {
          formula: `SUM(${colLetter}${sectionStart[colNum]}:${colLetter}${excelRowNum - 1})`,
        };
        cell.numFmt = '#,##0';
        delete sectionStart[colNum];
      } else {
        const num = Number(row[h]);
        const isNum = !isNaN(num) && row[h] !== '';
        if (isNum) {
          cell.value = num;
          cell.numFmt = '#,##0';
          if (sectionStart[colNum] == null) sectionStart[colNum] = excelRowNum;
        } else {
          cell.value = String(row[h] ?? '');
        }
      }
    });
  });

  // ==== Logo embedding ====
  const logoCell = exportSettings?.headerLayout?.logoCell;
  const logoData = exportSettings?.logoData;
  if (logoCell && logoData) {
    const imageId = wb.addImage({
      base64: logoData,
      extension: 'jpeg',
    });
    const anchor = cellRefToAnchor(logoCell);
    ws.addImage(imageId, {
      tl: { col: anchor.col, row: anchor.row } as ExcelJS.Anchor,
      ext: { width: 180, height: 64 },
    });
  }

  // ==== Download ====
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'combined-report.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

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
      label: h,
      render: (row: Row, index: number) => (
        <span
          className="tabular-nums"
          style={{
            display: 'block',
            textAlign: 'right' as const,
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

// ==== Component ====

const VIEW_TABS = [
  { value: 'table', label: 'Table' },
  { value: 'excel', label: 'Excel' },
];

export default function Dashboard() {
  const { reports } = useReports();
  const [view, setView] = useState('table');
  const [exporting, setExporting] = useState(false);

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

  const { headers, rows, rowIndents, rowColors, valueColors } = combineReports(reports);
  const [, ...valueHeaders] = headers;

  // Use ExportSetting from the first mapped report that has one
  const activeExportSetting = reports.find((r) => r.exportSetting)?.exportSetting ?? null;

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel(headers, rows, rowIndents, rowColors, valueColors, activeExportSetting);
    } finally {
      setExporting(false);
    }
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
          <ArtButton loading={exporting} onClick={handleExport}>Export Excel</ArtButton>
          <Link href="/upload" prefetch>
            <ArtButton color="primary">Add report</ArtButton>
          </Link>
        </div>
      </div>

      {view === 'table' ? (
        <ArtDataTable<Row>
          columns={buildColumns(headers, rowIndents, rowColors, valueColors)}
          data={rows}
          rowKey={(_, index) => String(index)}
          rowClassName={(row, index) => getRowClass(row, index, valueHeaders, rowIndents)}
          emptyMessage="No rows found"
        />
      ) : (
        <ExcelViewer workbook={buildProcessedWorkbook(headers, rows)} fixedSheet="Report" />
      )}
    </div>
  );
}

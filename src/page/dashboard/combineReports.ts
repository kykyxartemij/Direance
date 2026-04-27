import * as XLSX from 'xlsx';
import { type UploadedReport } from '@/providers/ReportProvider';
import { parseWorkbook, type TotalColumnInfo } from '@/page/mapping/applyMapping';
import type { ArtColor } from '@/components/ui/art.types';

// ==== Types ====

export type Row = Record<string, unknown>;

// ==== Combine logic ====

export function combineReports(reports: UploadedReport[]): {
  headers: string[];
  rows: Row[];
  rowIndents: number[];
  rowColors: (ArtColor | undefined)[];
  valueColors: (ArtColor | undefined)[];
  totalColumns?: TotalColumnInfo[];
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
      totalColumns: r.totalColumns,
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
      totalColumns: parsed[0].totalColumns,
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

export function buildProcessedWorkbook(headers: string[], rows: Row[]) {
  const aoa = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  return wb;
}

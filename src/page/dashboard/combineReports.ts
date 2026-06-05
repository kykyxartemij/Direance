import * as XLSX from 'xlsx';
import { type UploadedReport } from '@/providers/ReportProvider';
import { type TotalColumnInfo } from '@/page/mapping/applyMapping';
import type { ArtColor } from '@/components/ui/art.types';

// ==== Types ====

export type Row = Record<string, unknown>;

// Combined dashboard view derived from each report's pre-computed `mapped`.
// Mapping is NEVER re-run here — Dashboard is a pure consumer.
//
// valueColors are stored per-column so different reports can paint their own
// value cells (e.g. report A → primary, report B → warning) without overwriting.
export type CombinedReports = {
  headers: string[];
  rows: Row[];
  rowIndents: number[];
  /** Name color per output row (description column). */
  rowColors: (ArtColor | undefined)[];
  /** Value color per output row + column header. Header keys mirror `headers.slice(1)`. */
  valueColorByHeader: Record<string, ArtColor | undefined>[];
  totalColumns?: TotalColumnInfo[];
};

// ==== Combine logic ====

export function combineReports(reports: UploadedReport[]): CombinedReports {
  const empty: CombinedReports = { headers: [], rows: [], rowIndents: [], rowColors: [], valueColorByHeader: [] };
  if (reports.length === 0) return empty;

  // Only consider reports that have been mapped AND are active. Unmapped or
  // deactivated reports stay in the sidebar but don't contribute rows.
  const mapped = reports
    .filter((r) => r.mapped && r.active)
    .map((r) => ({
      label: r.fileName.replace(/\.(xlsx|xls)$/i, '').slice(0, 10),
      rowIndents: r.rowIndents,
      headers:     r.mapped!.headers,
      rows:        r.mapped!.rows,
      rowColors:   r.mapped!.rowColors,
      valueColors: r.mapped!.valueColors,
      totalColumns: r.mapped!.totalColumns,
    }));
  if (mapped.length === 0) return empty;

  if (mapped.length === 1) {
    const m = mapped[0];
    const [, ...valueHeaders] = m.headers;
    const valueColorByHeader = m.rows.map((_, i) => {
      const vc = m.valueColors[i];
      const map: Record<string, ArtColor | undefined> = {};
      for (const h of valueHeaders) map[h] = vc;
      return map;
    });
    return {
      headers: m.headers,
      rows: m.rows,
      rowIndents: m.rowIndents,
      rowColors: m.rowColors,
      valueColorByHeader,
      totalColumns: m.totalColumns,
    };
  }

  // Multi-report combine: union by description (header[0]).
  // Each report contributes its value columns prefixed with its file label.
  const descHeader = mapped[0].headers[0];
  const combinedHeaders = [
    descHeader,
    ...mapped.flatMap(({ label, headers }) => headers.slice(1).map((h) => `${label} · ${h}`)),
  ];

  const rowByDesc = new Map<string, Row>();
  const nameColorByDesc = new Map<string, ArtColor | undefined>();
  const valueColorsByDesc = new Map<string, Record<string, ArtColor | undefined>>();
  const orderedDescs: string[] = [];

  for (const { label, rows, headers, rowColors, valueColors } of mapped) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const desc = String(row[headers[0]] ?? '');
      if (!rowByDesc.has(desc)) {
        rowByDesc.set(desc, { [descHeader]: desc });
        nameColorByDesc.set(desc, rowColors[i]);
        valueColorsByDesc.set(desc, {});
        orderedDescs.push(desc);
      }
      const merged = rowByDesc.get(desc)!;
      const valueColorMap = valueColorsByDesc.get(desc)!;
      for (const h of headers.slice(1)) {
        const combinedHeader = `${label} · ${h}`;
        merged[combinedHeader] = row[h];
        valueColorMap[combinedHeader] = valueColors[i];
      }
    }
  }

  return {
    headers: combinedHeaders,
    rows: orderedDescs.map((d) => rowByDesc.get(d)!),
    rowIndents: mapped[0].rowIndents,
    rowColors: orderedDescs.map((d) => nameColorByDesc.get(d)),
    valueColorByHeader: orderedDescs.map((d) => valueColorsByDesc.get(d) ?? {}),
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

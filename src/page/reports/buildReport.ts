import * as XLSX from 'xlsx';
import { applyMappingMultiSheet } from '@/page/mapping/applyMapping';
import type { MappingModel } from '@/models/mapping.models';
import type { ConnectionLightModel, ConnectionSheet, ConnectionFetchResult } from '@/models/connection.models';
import type { UploadedReport, MappedReport } from '@/providers/ReportProvider';

// ==== Report building — shared by ReportProvider (file uploads) and the report pages
// (connection fetches). Kept out of the provider so a connection report can be built
// straight from react-query data without being copied into provider state. ====

export function buildSheetsWorkbook(sheets: ConnectionSheet[]): { workbook: XLSX.WorkBook; activeSheet: string; rowIndents: number[] } {
  const workbook = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(workbook, ws, s.name.slice(0, 31)); // xlsx caps at 31 chars
  }
  const activeSheet = workbook.SheetNames[0] ?? 'Sheet1';
  const rowIndents = (sheets[0]?.rows ?? []).map(() => 0);
  return { workbook, activeSheet, rowIndents };
}

export function buildMappedReport(report: Pick<UploadedReport, 'workbook'>, mapping: MappingModel): MappedReport {
  const sheetsConfig = mapping.config.sheetsConfig ?? {};
  const skippedSheets = report.workbook.SheetNames.filter((s) => sheetsConfig[s]?.mode === 'skip');
  const usedSheets = report.workbook.SheetNames.filter((s) => sheetsConfig[s]?.mode !== 'skip');
  const effectiveSheets = usedSheets.length > 0 ? usedSheets : [report.workbook.SheetNames[0]];

  const applied = applyMappingMultiSheet(report.workbook, effectiveSheets, mapping.config);

  // Build a real single-sheet workbook from the applied output.
  // Report view (ExcelViewer) and export step both read from this.
  const sheet = XLSX.utils.json_to_sheet(applied.rows, { header: applied.headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Mapped');

  return {
    headers: applied.headers,
    rows: applied.rows,
    rowColors: applied.rowColors,
    valueColors: applied.valueColors,
    totalColumns: applied.totalColumns,
    workbook,
    skippedSheets,
  };
}

// One connection fetch result → a fully-derived UploadedReport (workbook + mapped view).
// Runs once per fetch inside the react-query queryFn (cached by query key), so the heavy
// XLSX work never repeats on re-render. `id` is stable per connection so React keys hold.
export function buildConnectionReport(connection: ConnectionLightModel, data: ConnectionFetchResult): UploadedReport {
  const { workbook, activeSheet, rowIndents } = buildSheetsWorkbook(data.sheets);
  const report: UploadedReport = {
    id: `conn-${connection.id}`,
    fileName: `${connection.name}-${data.fetchedAt.slice(0, 10)}`,
    source: 'connection',
    connectionId: connection.id,
    connectionType: connection.type,
    fetchedAt: data.fetchedAt,
    active: true,
    workbook,
    activeSheet,
    rowIndents,
    mapping: data.mapping ?? undefined,
  };
  if (data.mapping) report.mapped = buildMappedReport(report, data.mapping);
  return report;
}

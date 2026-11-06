import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type { ArtColor } from '@/components/ui/art.types';
import type { ExportSettingResolvedModel } from '@/models/export-settings.models';
import type { Row } from './combineReports';

// ==== Constants ====

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

const LOGO_MAX_HEIGHT = 64;
const LOGO_MAX_WIDTH = 180;
const DEFAULT_ROW_HEIGHT = 15;
const LOGO_PADDING_PX = 10;
const LOGO_PADDING_EMU = LOGO_PADDING_PX * 9525; // 10px in EMU at 96 DPI

// ==== Cell ref parser ====

/** Parse "B4" → { col: 1, row: 3 } (0-indexed) */
function cellRefToAnchor(ref: string): { col: number; row: number } {
  const m = ref.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return { col: 0, row: 0 };
  const col = m[1].toUpperCase().split('').reduce((acc, c) => acc * 26 + (c.charCodeAt(0) - 64), 0) - 1;
  return { col, row: parseInt(m[2], 10) - 1 };
}

// ==== Header layout helpers ====

/** Place header layout items on a worksheet, replacing <Tag> placeholders with user values */
function applyHeaderItems(
  ws: ExcelJS.Worksheet,
  items: { cell: string; content: string }[],
  placeholders?: Record<string, string>,
) {
  for (const item of items) {
    const { col, row } = cellRefToAnchor(item.cell);
    const cell = ws.getCell(row + 1, col + 1);
    let content = item.content;
    if (placeholders) {
      content = content.replace(/<([^>]+)>/g, (match, tag) => placeholders[tag] ?? match);
    }
    cell.value = content;
    cell.font = { size: 11 };
  }
}

/** Read natural dimensions of a base64 image via an offscreen Image element */
function getImageSize(base64: string, mime: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 180, height: 64 }); // fallback
    img.src = `data:${mime};base64,${base64}`;
  });
}

/** Embed logo image at the specified cell, preserving aspect ratio.
 *  Adds 10px padding from top and left (EMU-based, independent of cell size).
 *  Auto-adjusts row heights (+ 1 padding row) so logo is never clipped. */
async function applyLogo(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  logoCell: string,
  logoData: string,
  logoMime: string,
) {
  const ext = logoMime === 'image/png' ? 'png' : 'jpeg';
  const imageId = wb.addImage({ base64: logoData, extension: ext });
  const anchor = cellRefToAnchor(logoCell);
  const { width: natW, height: natH } = await getImageSize(logoData, logoMime);
  const scaleH = Math.min(1, LOGO_MAX_HEIGHT / natH);
  const scaleW = Math.min(1, LOGO_MAX_WIDTH / natW);
  const scale = Math.min(scaleH, scaleW);
  const finalW = Math.round(natW * scale);
  const finalH = Math.round(natH * scale);

  ws.addImage(imageId, {
    tl: {
      nativeCol: anchor.col,
      nativeColOff: LOGO_PADDING_EMU,
      nativeRow: anchor.row,
      nativeRowOff: LOGO_PADDING_EMU,
    } as unknown as ExcelJS.Anchor,
    ext: { width: finalW, height: finalH },
  });

  // Rows occupied by logo + 1 padding row below
  const logoRows = Math.ceil(finalH / DEFAULT_ROW_HEIGHT);
  const totalRows = logoRows + 1;
  const perRow = finalH / logoRows;
  for (let i = 0; i < totalRows; i++) {
    const row = ws.getRow(anchor.row + 1 + i); // 1-based
    const target = i < logoRows ? perRow : DEFAULT_ROW_HEIGHT;
    if ((row.height ?? DEFAULT_ROW_HEIGHT) < target) {
      row.height = target;
    }
  }

  // Widen logo column if needed (~7px per Excel character unit)
  const col = ws.getColumn(anchor.col + 1);
  const neededWidth = Math.ceil(finalW / 7) + 2; // +2 for padding
  if ((col.width ?? 8) < neededWidth) {
    col.width = neededWidth;
  }
}

/** Apply full header layout (items + logo) to a worksheet */
async function applyHeaderLayout(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  exportSettings: ExportSettingResolvedModel,
  placeholders?: Record<string, string>,
) {
  const layout = exportSettings.headerLayout;
  if (layout?.items?.length) applyHeaderItems(ws, layout.items, placeholders);
  if (layout?.logoCell && exportSettings.logoData) {
    await applyLogo(wb, ws, layout.logoCell, exportSettings.logoData, exportSettings.logoMime ?? 'image/jpeg');
  }
}

// ==== Data table writer ====

const TOTAL_HEADER = 'Σ Total';
const NUM_FMT = '#,##0';

function toNumber(value: unknown): number | null {
  if (value === '' || value == null) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function writeDataTable(
  ws: ExcelJS.Worksheet,
  headers: string[],
  rows: Row[],
  rowIndents: number[],
  rowColors: (ArtColor | undefined)[],
  valueColorByHeader: Record<string, ArtColor | undefined>[],
  startRow: number,
  startCol: number,
  hasTotalColumn: boolean,
) {
  const [descHeader, ...valueHeaders] = headers;
  const outHeaders = hasTotalColumn ? [...headers, TOTAL_HEADER] : headers;
  const firstValueLetter = ws.getColumn(startCol + 2).letter;
  const lastValueLetter = ws.getColumn(startCol + 1 + valueHeaders.length).letter;

  // ==== Column widths (never shrink below existing — logo may have widened a column) ====
  const descCol = ws.getColumn(startCol + 1);
  descCol.width = Math.max(descCol.width ?? 0, 38);
  outHeaders.slice(1).forEach((_, i) => {
    const col = ws.getColumn(startCol + 2 + i);
    col.width = Math.max(col.width ?? 0, 20);
  });

  // ==== Header row ====
  const xlHeaderRow = ws.getRow(startRow + 1);
  outHeaders.forEach((h, i) => {
    const cell = xlHeaderRow.getCell(startCol + 1 + i);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
  });

  // ==== Data rows ====
  // Values are written as the source sent them: subtotals are never re-derived from row names.
  rows.forEach((row, rowIdx) => {
    const excelRowNum = startRow + 2 + rowIdx; // 1-based, +1 for header
    const desc = String(row[descHeader] ?? '');
    const isTotal = /^total/i.test(desc);
    const isEmpty = valueHeaders.every((h) => row[h] === '' || row[h] == null);
    const indent = rowIndents[rowIdx] ?? 0;
    const isSection = isEmpty && !isTotal;
    const isTopLevel = indent === 0 && (isSection || isTotal);
    const rowFill: ExcelJS.Fill | undefined = isTopLevel && isSection
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } }
      : isTotal ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } } : undefined;

    const nameArgb = rowColors[rowIdx] ? FONT_COLOR[rowColors[rowIdx]!] : undefined;
    const rowValueColors = valueColorByHeader[rowIdx] ?? {};
    const xlRow = ws.getRow(excelRowNum);

    // ==== Name cell ====
    const nameCell = xlRow.getCell(startCol + 1);
    nameCell.value = desc;
    nameCell.border = CELL_BORDER;
    nameCell.font = { bold: isTopLevel, color: nameArgb ? { argb: nameArgb } : undefined };
    if (rowFill) nameCell.fill = rowFill;

    // ==== Value cells ====
    let rowSum = 0;
    valueHeaders.forEach((h, vIdx) => {
      const absCol = startCol + 2 + vIdx;
      const cell = xlRow.getCell(absCol);
      cell.border = CELL_BORDER;
      cell.alignment = { horizontal: 'right' };
      const valColor = rowValueColors[h];
      const valArgb = valColor ? FONT_COLOR[valColor] : undefined;
      cell.font = { bold: isTopLevel, color: valArgb ? { argb: valArgb } : undefined };
      if (rowFill) cell.fill = rowFill;

      const num = toNumber(row[h]);
      if (isEmpty) {
        cell.value = '';
      } else if (num != null) {
        cell.value = num;
        cell.numFmt = NUM_FMT;
        rowSum += num;
      } else {
        cell.value = String(row[h] ?? '');
      }
    });

    // ==== Σ Total cell ====
    // Cached result, so viewers that don't recalculate still show the number.
    if (hasTotalColumn) {
      const cell = xlRow.getCell(startCol + 2 + valueHeaders.length);
      cell.border = CELL_BORDER;
      cell.alignment = { horizontal: 'right' };
      cell.font = { bold: true, color: nameArgb ? { argb: nameArgb } : undefined };
      if (rowFill) cell.fill = rowFill;
      if (isEmpty) {
        cell.value = '';
      } else {
        cell.value = { formula: `SUM(${firstValueLetter}${excelRowNum}:${lastValueLetter}${excelRowNum})`, result: rowSum };
        cell.numFmt = NUM_FMT;
      }
    }
  });
}

// ==== Main export ====

export type ExportExcelOptions = {
  headers: string[];
  rows: Row[];
  rowIndents: number[];
  rowColors?: (ArtColor | undefined)[];
  valueColorByHeader?: Record<string, ArtColor | undefined>[];
  /** Header layout, logo and placeholders. Null = plain export. */
  exportSettings?: ExportSettingResolvedModel | null;
  placeholders?: Record<string, string>;
  hasTotalColumn: boolean;
  includeOriginalSheets: boolean;
  applyHeaderToAllSheets: boolean;
  originalWorkbooks?: { name: string; workbook: XLSX.WorkBook; skippedSheets: string[] }[];
  fileName?: string;
};

export async function exportToExcel({
  headers,
  rows,
  rowIndents,
  rowColors = [],
  valueColorByHeader = [],
  exportSettings,
  placeholders,
  hasTotalColumn,
  includeOriginalSheets,
  applyHeaderToAllSheets,
  originalWorkbooks = [],
  fileName,
}: ExportExcelOptions) {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet('Report');

  // ==== Data start offset (from headerLayout.dataStartCell) ====
  const dataStart = exportSettings?.headerLayout?.dataStartCell
    ? cellRefToAnchor(exportSettings.headerLayout.dataStartCell)
    : { col: 0, row: 0 };

  // ==== Header layout on main sheet ====
  if (exportSettings) await applyHeaderLayout(wb, ws, exportSettings, placeholders);

  // ==== Write data table ====
  writeDataTable(ws, headers, rows, rowIndents, rowColors, valueColorByHeader, dataStart.row, dataStart.col, hasTotalColumn);

  // ==== Include original sheets (skipped sheets never used by the mapping, so left out) ====
  if (includeOriginalSheets && originalWorkbooks.length) {
    type SheetJob = { origWs: ExcelJS.Worksheet; aoa: unknown[][] };
    const usedSheetNames = new Set<string>();
    const sheetJobs: SheetJob[] = [];
    for (const { name, workbook, skippedSheets } of originalWorkbooks) {
      const skippedSet = new Set(skippedSheets);
      for (const sheetName of workbook.SheetNames.filter((s) => !skippedSet.has(s))) {
        let label = `${name} - ${sheetName}`.slice(0, 31);
        let suffix = 2;
        while (usedSheetNames.has(label)) {
          const tag = ` (${suffix++})`;
          label = `${name} - ${sheetName}`.slice(0, 31 - tag.length) + tag;
        }
        usedSheetNames.add(label);
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1 });
        sheetJobs.push({ origWs: wb.addWorksheet(label), aoa });
      }
    }

    const withHeader = applyHeaderToAllSheets && exportSettings;
    if (withHeader) {
      await Promise.all(sheetJobs.map(({ origWs }) => applyHeaderLayout(wb, origWs, exportSettings, placeholders)));
    }

    const origDataStart = withHeader ? dataStart : { col: 0, row: 0 };
    for (const { origWs, aoa } of sheetJobs) {
      aoa.forEach((row, i) => {
        const xlRow = origWs.getRow(origDataStart.row + i + 1);
        (row as unknown[]).forEach((val, c) => {
          xlRow.getCell(origDataStart.col + c + 1).value = val as ExcelJS.CellValue;
        });
      });
    }
  }

  // ==== Download ====
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName || 'combined-report'}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type { ArtColor } from '@/components/ui/art.types';
import type { ExportSettingResolvedModel } from '@/models/export-settings.models';
import type { TotalColumnInfo } from '@/page/mapping/applyMapping';
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

function writeDataTable(
  ws: ExcelJS.Worksheet,
  headers: string[],
  rows: Row[],
  rowIndents: number[],
  rowColors: (ArtColor | undefined)[],
  valueColors: (ArtColor | undefined)[],
  startRow: number,
  startCol: number,
  totalColumns?: TotalColumnInfo[],
) {
  const [descHeader, ...valueHeaders] = headers;

  // ==== Column widths (never shrink below existing — logo may have widened a column) ====
  const descCol = ws.getColumn(startCol + 1);
  descCol.width = Math.max(descCol.width ?? 0, 38);
  valueHeaders.forEach((_, i) => {
    const col = ws.getColumn(startCol + 2 + i);
    col.width = Math.max(col.width ?? 0, 20);
  });

  // ==== Header row ====
  const headerRowNum = startRow + 1; // 1-based
  const xlHeaderRow = ws.getRow(headerRowNum);
  headers.forEach((h, i) => {
    const cell = xlHeaderRow.getCell(startCol + 1 + i);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
  });

  // ==== Total column lookup: headerIndex → source column letters ====
  const totalColFormulaMap = new Map<number, string[]>();
  if (totalColumns) {
    for (const tc of totalColumns) {
      const srcLetters = tc.sourceHeaderIndices.map((si) => ws.getColumn(startCol + 1 + si).letter);
      totalColFormulaMap.set(tc.headerIndex, srcLetters);
    }
  }

  // ==== Data rows ====
  const sectionStart: Record<number, number> = {};

  rows.forEach((row, rowIdx) => {
    const excelRowNum = startRow + 2 + rowIdx; // 1-based, +1 for header
    const desc = String(row[descHeader] ?? '');
    const isTotal = /^total/i.test(desc);
    const isEmpty = valueHeaders.every((h) => row[h] === '' || row[h] == null);
    const indent = rowIndents[rowIdx] ?? 0;
    const isSection = isEmpty && !isTotal;
    const isTopLevel = indent === 0 && (isSection || isTotal);

    const nameArgb = rowColors[rowIdx] ? FONT_COLOR[rowColors[rowIdx]!] : undefined;
    const valArgb = valueColors[rowIdx] ? FONT_COLOR[valueColors[rowIdx]!] : undefined;

    const xlRow = ws.getRow(excelRowNum);

    // ==== Name cell ====
    const nameCell = xlRow.getCell(startCol + 1);
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
      const headerIndex = vIdx + 1; // 1-based index in original headers
      const absCol = startCol + 2 + vIdx;
      const colLetter = ws.getColumn(absCol).letter;
      const cell = xlRow.getCell(absCol);
      cell.border = CELL_BORDER;
      cell.alignment = { horizontal: 'right' };
      cell.font = { bold: isTopLevel, color: valArgb ? { argb: valArgb } : undefined };

      if (isTopLevel && isSection) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      } else if (isTotal) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      }

      // Total column → SUM formula referencing source columns in this row
      const tcSrcLetters = totalColFormulaMap.get(headerIndex);
      if (tcSrcLetters && !isEmpty) {
        cell.value = {
          formula: tcSrcLetters.map((l) => `${l}${excelRowNum}`).join('+'),
        };
        cell.numFmt = '#,##0';
        cell.font = { bold: true, color: valArgb ? { argb: valArgb } : undefined };
      } else if (isEmpty) {
        cell.value = '';
        delete sectionStart[absCol];
      } else if (isTotal && sectionStart[absCol] != null) {
        cell.value = {
          formula: `SUM(${colLetter}${sectionStart[absCol]}:${colLetter}${excelRowNum - 1})`,
        };
        cell.numFmt = '#,##0';
        delete sectionStart[absCol];
      } else {
        const num = Number(row[h]);
        const isNum = !isNaN(num) && row[h] !== '';
        if (isNum) {
          cell.value = num;
          cell.numFmt = '#,##0';
          if (sectionStart[absCol] == null) sectionStart[absCol] = excelRowNum;
        } else {
          cell.value = String(row[h] ?? '');
        }
      }
    });
  });
}

// ==== Main export ====

export async function exportToExcel(
  headers: string[],
  rows: Row[],
  rowIndents: number[],
  rowColors: (ArtColor | undefined)[] = [],
  valueColors: (ArtColor | undefined)[] = [],
  exportSettings?: ExportSettingResolvedModel | null,
  originalWorkbooks?: { name: string; workbook: XLSX.WorkBook; skippedSheets?: string[] }[],
  placeholders?: Record<string, string>,
  fileName?: string,
  totalColumns?: TotalColumnInfo[],
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');

  // ==== Data start offset (from headerLayout.dataStartCell) ====
  const dataStart = exportSettings?.headerLayout?.dataStartCell
    ? cellRefToAnchor(exportSettings.headerLayout.dataStartCell)
    : { col: 0, row: 0 };

  // ==== Header layout on main sheet ====
  if (exportSettings) await applyHeaderLayout(wb, ws, exportSettings, placeholders);

  // ==== Write data table ====
  writeDataTable(ws, headers, rows, rowIndents, rowColors, valueColors, dataStart.row, dataStart.col, totalColumns);

  // ==== Include original uploaded sheets ====
  const usedSheetNames = new Set<string>();
  if (exportSettings?.includeOriginalSheets && originalWorkbooks?.length) {
    for (const { name, workbook, skippedSheets } of originalWorkbooks) {
      const skippedSet = new Set(skippedSheets ?? []);
      for (const sheetName of workbook.SheetNames.filter((s) => !skippedSet.has(s))) {
        let label = `${name} - ${sheetName}`.slice(0, 31);
        let suffix = 2;
        while (usedSheetNames.has(label)) {
          const tag = ` (${suffix++})`;
          label = `${name} - ${sheetName}`.slice(0, 31 - tag.length) + tag;
        }
        usedSheetNames.add(label);
        const ows = workbook.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ows, { header: 1 });
        const origWs = wb.addWorksheet(label);

        // Apply header layout to original sheets if configured
        if (exportSettings.applyHeaderToAllSheets) {
          await applyHeaderLayout(wb, origWs, exportSettings, placeholders);
        }

        // Offset original data when header layout is applied
        const origDataStart = exportSettings.applyHeaderToAllSheets ? dataStart : { col: 0, row: 0 };

        aoa.forEach((row, i) => {
          const xlRow = origWs.getRow(origDataStart.row + i + 1);
          (row as unknown[]).forEach((val, c) => {
            xlRow.getCell(origDataStart.col + c + 1).value = val as ExcelJS.CellValue;
          });
        });
      }
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

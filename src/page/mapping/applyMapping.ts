
// TODO: Check what Ai made. Seems to work perfectly but still.


import * as XLSX from 'xlsx';
import type { ArtColor } from '@/components/ui/art.types';
import type { MappingConfig, SourceLayout, TableRegion, TotalColumnMode } from '@/models/mapping.models';

// ==== Types ====

type Row = Record<string, unknown>;
type RawCell = string | number | boolean | null | undefined;

/** Metadata about a computed total column in the output */
export type TotalColumnInfo = {
  /** Index in the output headers array */
  headerIndex: number;
  /** Indices in the output headers array that this total column sums */
  sourceHeaderIndices: number[];
};

export type AppliedMapping = {
  headers: string[];
  rows: Row[];
  rowColors: (ArtColor | undefined)[];
  valueColors: (ArtColor | undefined)[];
  /** Metadata for total columns — enables SUM formulas in Excel export */
  totalColumns?: TotalColumnInfo[];
};

// ==== Raw grid helper ====

export function sheetToGrid(ws: XLSX.WorkSheet): RawCell[][] {
  const ref = ws['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const grid: RawCell[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: RawCell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? cell.v : null);
    }
    grid.push(row);
  }
  return grid;
}

// ==== Resolve per-region data start (0-indexed) ====

function regionDataStart(region: TableRegion, fallbackHeaderRow: number): number {
  return region.startRow ?? (fallbackHeaderRow + 1);
}

// ==== Apply mapping (multi-region, stacked) ====

export function applyMapping(
  workbook: XLSX.WorkBook,
  sheetName: string,
  config: MappingConfig,
): AppliedMapping {
  const ws = workbook.Sheets[sheetName];
  const grid = sheetToGrid(ws);
  if (grid.length === 0) return { headers: [], rows: [], rowColors: [], valueColors: [] };

  const { sourceLayout, rowMappings, columnHeaders } = config;
  const { regions, headerRow } = sourceLayout;
  const mappingBySource = new Map(rowMappings.map((m) => [m.sourceName, m]));

  // Primary region determines output header labels — use its own header row
  const primaryRegion = regions[0];
  const primaryDataStart = primaryRegion ? regionDataStart(primaryRegion, headerRow) : headerRow + 1;
  const primaryHeaderRow = Math.max(0, primaryDataStart - 1);

  function resolveHeader(posIdx: number, colIdx: number): string {
    const ch = columnHeaders.find((c) => c.sourceIndex === posIdx);
    if (ch?.displayName) return ch.displayName;
    const raw = grid[primaryHeaderRow]?.[colIdx];
    return raw != null && raw !== '' ? String(raw) : `Column ${colIdx + 1}`;
  }

  // Build headers from region 0 only — all regions stack into the same output columns
  const descLabel = 'Description';
  const outHeaders: string[] = [descLabel];

  if (primaryRegion) {
    const primaryValCols = primaryRegion.valueColumns.length > 0
      ? primaryRegion.valueColumns
      : inferValueColumns(grid, primaryRegion.descriptionColumn, regions);
    primaryValCols.forEach((vc, i) => outHeaders.push(resolveHeader(i, vc)));
  }

  // Fallback: include all non-description columns
  if (outHeaders.length === 1 && regions.length > 0) {
    const totalCols = grid[0]?.length ?? 0;
    const descCols = new Set(regions.map((r) => r.descriptionColumn));
    for (let c = 0; c < totalCols; c++) {
      if (!descCols.has(c)) {
        const raw = grid[primaryHeaderRow]?.[c];
        outHeaders.push(raw != null && raw !== '' ? String(raw) : `Column ${c + 1}`);
      }
    }
  }

  // Collect rows from each region, stacked vertically into the same output columns
  const rows: Row[] = [];
  const rowColors: (ArtColor | undefined)[] = [];
  const valueColors: (ArtColor | undefined)[] = [];

  for (const region of regions) {
    const valCols = region.valueColumns.length > 0
      ? region.valueColumns
      : inferValueColumns(grid, region.descriptionColumn, regions);
    const dataStart = regionDataStart(region, headerRow);

    for (let r = dataStart; r < grid.length; r++) {
      const descCell = grid[r]?.[region.descriptionColumn];
      const desc = descCell != null ? String(descCell).trim() : '';

      const hasAnyValue = valCols.some((c) => {
        const v = grid[r]?.[c];
        return v != null && v !== '';
      });
      if (!desc && !hasAnyValue) continue;

      const mapping = mappingBySource.get(desc);
      if (mapping?.hidden) continue;

      const outRow: Row = { [descLabel]: mapping?.displayName || desc };
      valCols.forEach((vc, vi) => {
        const header = outHeaders[vi + 1];
        if (header !== undefined) outRow[header] = grid[r]?.[vc] ?? '';
      });

      rows.push(outRow);
      rowColors.push(mapping?.nameColor);
      valueColors.push(mapping?.valueColor);
    }
  }

  // ==== Total columns ====

  const totalColumnMode: TotalColumnMode = config.sheetsConfig?.[sheetName]?.totalColumnMode ?? 'none';
  const totalColumnDefs = sourceLayout.totalColumns ?? [];
  const totalColumnInfos: TotalColumnInfo[] = [];

  if (totalColumnMode !== 'none' && totalColumnDefs.length > 0 && rows.length > 0) {
    const valueHeaderCount = outHeaders.length - 1; // exclude description

    for (const tc of totalColumnDefs) {
      // Resolve which output value header indices to sum (1-based in outHeaders)
      const srcIndices = tc.sourceValueIndices.length > 0
        ? tc.sourceValueIndices.filter((i) => i < valueHeaderCount).map((i) => i + 1)
        : Array.from({ length: valueHeaderCount }, (_, i) => i + 1);

      const headerIndex = outHeaders.length;
      outHeaders.push(tc.label);

      for (const row of rows) {
        let sum = 0;
        let hasNum = false;
        for (const idx of srcIndices) {
          const v = row[outHeaders[idx]];
          const n = typeof v === 'number' ? v : Number(v);
          if (!isNaN(n) && v !== '' && v != null) { sum += n; hasNum = true; }
        }
        row[tc.label] = hasNum ? sum : '';
      }

      totalColumnInfos.push({ headerIndex, sourceHeaderIndices: srcIndices });
    }

    // 'only' mode: strip original value columns, keep description + total columns
    if (totalColumnMode === 'only') {
      const totalLabels = totalColumnDefs.map((tc) => tc.label);
      const keptHeaders = [outHeaders[0], ...totalLabels];
      const removedHeaders = outHeaders.filter((h) => !keptHeaders.includes(h));

      for (const row of rows) {
        for (const h of removedHeaders) delete row[h];
      }

      // Rebuild outHeaders and fix totalColumnInfos
      outHeaders.length = 0;
      outHeaders.push(keptHeaders[0]);
      for (let i = 0; i < totalLabels.length; i++) {
        outHeaders.push(totalLabels[i]);
        totalColumnInfos[i] = {
          headerIndex: i + 1,
          sourceHeaderIndices: totalColumnInfos[i].sourceHeaderIndices,
        };
      }
    }
  }

  return {
    headers: outHeaders,
    rows,
    rowColors,
    valueColors,
    totalColumns: totalColumnInfos.length > 0 ? totalColumnInfos : undefined,
  };
}

// ==== Infer value columns for a region ====

function inferValueColumns(grid: RawCell[][], descCol: number, regions: TableRegion[]): number[] {
  if (grid.length < 2) return [];
  const totalCols = grid[0]?.length ?? 0;
  const descCols = new Set(regions.map((r) => r.descriptionColumn));
  const sortedDescs = [...descCols].sort((a, b) => a - b);
  const descIdx = sortedDescs.indexOf(descCol);
  const nextDesc = descIdx < sortedDescs.length - 1 ? sortedDescs[descIdx + 1] : totalCols;
  const result: number[] = [];
  for (let c = descCol + 1; c < nextDesc; c++) {
    if (!descCols.has(c)) result.push(c);
  }
  return result;
}

// ==== Apply mapping across multiple sheets (vertical stack) ====

export function applyMappingMultiSheet(
  workbook: XLSX.WorkBook,
  sheetNames: string[],
  config: MappingConfig,
): AppliedMapping {
  if (sheetNames.length === 0) return { headers: [], rows: [], rowColors: [], valueColors: [] };

  function configForSheet(name: string): MappingConfig {
    const override = config.sheetLayouts?.[name];
    return override ? { ...config, sourceLayout: override } : config;
  }

  if (sheetNames.length === 1) return applyMapping(workbook, sheetNames[0], configForSheet(sheetNames[0]));

  const primary = applyMapping(workbook, sheetNames[0], configForSheet(sheetNames[0]));
  const result: AppliedMapping = {
    headers: primary.headers,
    rows: [...primary.rows],
    rowColors: [...primary.rowColors],
    valueColors: [...primary.valueColors],
    totalColumns: primary.totalColumns,
  };

  for (const sheetName of sheetNames.slice(1)) {
    const sheet = applyMapping(workbook, sheetName, configForSheet(sheetName));
    for (let i = 0; i < sheet.rows.length; i++) {
      const srcRow = sheet.rows[i];
      const outRow: Row = {};
      primary.headers.forEach((primaryHeader, hIdx) => {
        const srcHeader = sheet.headers[hIdx];
        outRow[primaryHeader] = srcHeader !== undefined ? srcRow[srcHeader] : '';
      });
      result.rows.push(outRow);
      result.rowColors.push(sheet.rowColors[i]);
      result.valueColors.push(sheet.valueColors[i]);
    }
  }

  return result;
}

// ==== Auto-detect source layout ====

export function autoDetectLayout(
  workbook: XLSX.WorkBook,
  sheetName: string,
): SourceLayout {
  const ws = workbook.Sheets[sheetName];
  const grid = sheetToGrid(ws);
  if (grid.length < 2) return { regions: [{ descriptionColumn: 0, valueColumns: [] }], headerRow: 0 };

  const totalCols = grid[0]?.length ?? 0;

  // Classify columns as text-heavy or number-heavy
  const isTextCol: boolean[] = [];
  for (let c = 0; c < totalCols; c++) {
    let textCount = 0;
    let numCount = 0;
    for (let r = 1; r < grid.length; r++) {
      const v = grid[r]?.[c];
      if (v == null || v === '') continue;
      if (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== '')) {
        numCount++;
      } else {
        textCount++;
      }
    }
    isTextCol.push(textCount > numCount);
  }

  const regions: TableRegion[] = [];
  for (let c = 0; c < totalCols; c++) {
    if (isTextCol[c]) {
      const valueColumns: number[] = [];
      for (let v = c + 1; v < totalCols; v++) {
        if (isTextCol[v]) break;
        valueColumns.push(v);
      }
      if (valueColumns.length > 0) {
        regions.push({ descriptionColumn: c, valueColumns });
      }
    }
  }

  if (regions.length === 0) {
    regions.push({ descriptionColumn: 0, valueColumns: [] });
  }

  return { regions, headerRow: 0 };
}

// ==== Extract unique row names from all regions ====

export function extractRowNames(workbook: XLSX.WorkBook, sheetName: string, layout: SourceLayout): string[] {
  const ws = workbook.Sheets[sheetName];
  const grid = sheetToGrid(ws);
  if (grid.length < 2) return [];

  const names: string[] = [];
  const seen = new Set<string>();

  for (const region of layout.regions) {
    const dataStart = regionDataStart(region, layout.headerRow);
    for (let r = dataStart; r < grid.length; r++) {
      const cell = grid[r]?.[region.descriptionColumn];
      const name = cell != null ? String(cell).trim() : '';
      if (name && !seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }

  return names;
}

// ==== Parse workbook (no mapping transforms, for Dashboard fallback) ====

export function parseWorkbook(
  workbook: XLSX.WorkBook,
  sheetName: string,
  layout?: SourceLayout,
): { headers: string[]; rows: Row[] } {
  const ws = workbook.Sheets[sheetName];
  const grid = sheetToGrid(ws);
  if (grid.length < 2) return { headers: [], rows: [] };

  const resolvedLayout = layout ?? autoDetectLayout(workbook, sheetName);
  const { regions, headerRow } = resolvedLayout;

  const primaryRegion = regions[0];
  const primaryDataStart = primaryRegion ? regionDataStart(primaryRegion, headerRow) : headerRow + 1;
  const primaryHeaderRow = Math.max(0, primaryDataStart - 1);

  const descRaw = grid[primaryHeaderRow]?.[primaryRegion?.descriptionColumn ?? 0];
  const descHeader = descRaw != null && descRaw !== '' ? String(descRaw) : 'Description';
  const outHeaders: string[] = [descHeader];

  if (primaryRegion) {
    const primaryValCols = primaryRegion.valueColumns.length > 0
      ? primaryRegion.valueColumns
      : inferValueColumns(grid, primaryRegion.descriptionColumn, regions);
    for (const vc of primaryValCols) {
      const raw = grid[primaryHeaderRow]?.[vc];
      outHeaders.push(raw != null && raw !== '' ? String(raw) : `Column ${vc + 1}`);
    }
  }

  const rows: Row[] = [];
  for (const region of regions) {
    const valCols = region.valueColumns.length > 0
      ? region.valueColumns
      : inferValueColumns(grid, region.descriptionColumn, regions);
    const dataStart = regionDataStart(region, headerRow);

    for (let r = dataStart; r < grid.length; r++) {
      const descCell = grid[r]?.[region.descriptionColumn];
      const desc = descCell != null ? String(descCell).trim() : '';
      const hasAnyValue = valCols.some((c) => {
        const v = grid[r]?.[c];
        return v != null && v !== '';
      });
      if (!desc && !hasAnyValue) continue;

      const outRow: Row = { [descHeader]: desc };
      valCols.forEach((vc, vi) => {
        const header = outHeaders[vi + 1];
        if (header !== undefined) outRow[header] = grid[r]?.[vc] ?? '';
      });

      rows.push(outRow);
    }
  }

  return { headers: outHeaders, rows };
}

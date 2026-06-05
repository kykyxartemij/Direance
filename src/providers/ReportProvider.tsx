'use client';

import { createContext, useContext, useState } from 'react';
import * as XLSX from 'xlsx';
import type { ArtColor } from '@/components/ui/art.types';
import type { MappingModel } from '@/models/mapping.models';
import {
  applyMappingMultiSheet,
  type TotalColumnInfo,
} from '@/page/mapping/applyMapping';

// ==== Types ====

type Row = Record<string, unknown>;

// Single derived view of one report after mapping is applied.
// All view consumers (Dashboard table, ExcelViewer, Export) read from this —
// no caller re-runs mapping derivation.
export type MappedReport = {
  headers: string[];
  rows: Row[];
  rowColors: (ArtColor | undefined)[];
  valueColors: (ArtColor | undefined)[];
  totalColumns?: TotalColumnInfo[];
  /** Single-sheet workbook built from headers + rows — fed to ExcelViewer + export. */
  workbook: XLSX.WorkBook;
  /** Sheets from the ORIGINAL workbook that should not surface when includeOriginalSheets is on. */
  skippedSheets: string[];
};

export type UploadedReport = {
  id: string;
  fileName: string;
  /** Raw uploaded workbook — never re-derived. */
  workbook: XLSX.WorkBook;
  activeSheet: string;
  /** Indent level of the first column cell per data row (skip header). Used for visual hierarchy. */
  rowIndents: number[];
  /** Full mapping model in effect (saved mapping or local edits on top). Undefined = no mapping applied yet. */
  mapping?: MappingModel;
  /** Derived once when `mapping` is set. Source of truth for Dashboard rendering + export. */
  mapped?: MappedReport;
};

type ReportContextValue = {
  reports: UploadedReport[];
  addReport: (file: File) => Promise<void>;
  removeReport: (id: string) => void;
  /** Patch the raw report (does NOT recompute mapped). For setting the applied mapping, use setMapping. */
  updateReport: (id: string, patch: Partial<UploadedReport>) => void;
  /** Apply (or clear) a mapping. Recomputes `mapped` so callers never run mapping logic themselves. */
  setMapping: (id: string, mapping: MappingModel | undefined) => void;
};

// ==== Helpers ====

function buildMappedReport(report: UploadedReport, mapping: MappingModel): MappedReport {
  const sheetsConfig = mapping.config.sheetsConfig ?? {};
  const skippedSheets = report.workbook.SheetNames.filter((s) => sheetsConfig[s]?.mode === 'skip');
  const usedSheets = report.workbook.SheetNames.filter((s) => sheetsConfig[s]?.mode !== 'skip');
  const effectiveSheets = usedSheets.length > 0 ? usedSheets : [report.workbook.SheetNames[0]];

  const applied = applyMappingMultiSheet(report.workbook, effectiveSheets, mapping.config);

  // Build a real single-sheet workbook from the applied output.
  // Dashboard ExcelViewer and export step both read from this.
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

// ==== Context ====

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const [reports, setReports] = useState<UploadedReport[]>([]);

  async function addReport(file: File) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellStyles: true });
    const activeSheet = workbook.SheetNames[0];
    const ws = workbook.Sheets[activeSheet];
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');

    // Read indent of first column per data row (row 0 is the header — skip it)
    const rowIndents: number[] = [];
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: range.s.c })];
      rowIndents.push(cell?.s?.alignment?.indent ?? 0);
    }

    setReports((prev) => [
      ...prev,
      { id: crypto.randomUUID(), fileName: file.name, workbook, activeSheet, rowIndents },
    ]);
  }

  function removeReport(id: string) {
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  function updateReport(id: string, patch: Partial<UploadedReport>) {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function setMapping(id: string, mapping: MappingModel | undefined) {
    setReports((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      if (!mapping) return { ...r, mapping: undefined, mapped: undefined };
      const mapped = buildMappedReport(r, mapping);
      return { ...r, mapping, mapped };
    }));
  }

  return (
    <ReportContext.Provider value={{ reports, addReport, removeReport, updateReport, setMapping }}>
      {children}
    </ReportContext.Provider>
  );
}

export function useReports(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error('useReports must be used inside ReportProvider');
  return ctx;
}

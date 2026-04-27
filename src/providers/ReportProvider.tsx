'use client';

import { createContext, useContext, useState } from 'react';
import * as XLSX from 'xlsx';
import type { ArtColor } from '@/components/ui/art.types';
import type { ExportSetting } from '@/models/export-settings.models';
import type { TotalColumnInfo } from '@/page/mapping/applyMapping';

// ==== Types ====

type Row = Record<string, unknown>;

export type UploadedReport = {
  id: string;
  fileName: string;
  workbook: XLSX.WorkBook;
  activeSheet: string;
  /** Indent level of the first column cell per data row (skip header). Used for visual hierarchy. */
  rowIndents: number[];
  /** ID of the applied mapping (undefined = none). */
  mappingId?: string;
  /** Pre-processed output from applyMapping — set by MappingStep before navigating to Dashboard. */
  processedHeaders?: string[];
  processedRows?: Row[];
  /** Name color per data row, from mapping. */
  rowColors?: (ArtColor | undefined)[];
  /** Value color per data row, from mapping. */
  valueColors?: (ArtColor | undefined)[];
  /** Total column metadata from applyMapping — enables SUM formulas in Excel export */
  totalColumns?: TotalColumnInfo[];
  /** Sheet names to exclude when includeOriginalSheets is on — sheets with mode='skip' */
  skippedSheets?: string[];
  /** Linked export setting (from mapping). */
  exportSetting?: ExportSetting | null;
};

type ReportContextValue = {
  reports: UploadedReport[];
  addReport: (file: File) => Promise<void>;
  removeReport: (id: string) => void;
  updateReport: (id: string, patch: Partial<UploadedReport>) => void;
};

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

  return (
    <ReportContext.Provider value={{ reports, addReport, removeReport, updateReport }}>
      {children}
    </ReportContext.Provider>
  );
}

export function useReports(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error('useReports must be used inside ReportProvider');
  return ctx;
}

'use client';

import { createContext, use, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { ArtColor } from '@/components/ui/art.types';
import type { MappingModel, ReportType } from '@/models/mapping.models';
import type { ConnectionLightModel, ConnectionType } from '@/models/connection.models';
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
  /** 'file' = xlsx upload; 'connection' = data fetched via a Connection driver. */
  source: 'file' | 'connection';
  /** Originating Connection id (only set when source === 'connection'). Used to refetch with new filters. */
  connectionId?: string;
  /** Driver type of the originating Connection — drives per-driver filter UI. */
  connectionType?: ConnectionType;
  /** ISO timestamp of last successful fetch from the connection (connection sources only). */
  fetchedAt?: string;
  /** Whether this report contributes to the combined Dashboard view. Defaults to true. */
  active: boolean;
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

/** Shape produced by connection drivers (src/lib/connections/*). */
export type ConnectionSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

type ReportContextValue = {
  reports: UploadedReport[];
  addReport: (file: File) => Promise<void>;
  /** Add a report built from connection-driver output. Builds a synthetic xlsx workbook so the rest of the pipeline (mapping, viewer, export) works unchanged. */
  addReportFromSheets: (fileName: string, sheets: ConnectionSheet[], opts?: { connectionId?: string; connectionType?: ConnectionType; fetchedAt?: string }) => string;
  /** Replace the data of an existing connection-sourced report (refetch path). Re-applies the existing mapping if one was set. */
  replaceReportSheets: (id: string, sheets: ConnectionSheet[], fetchedAt?: string) => void;
  removeReport: (id: string) => void;
  /** Patch the raw report (does NOT recompute mapped). For setting the applied mapping, use setMapping. */
  updateReport: (id: string, patch: Partial<UploadedReport>) => void;
  /** Apply (or clear) a mapping. Recomputes `mapped` so callers never run mapping logic themselves. */
  setMapping: (id: string, mapping: MappingModel | undefined) => void;
  /** Toggle whether the report contributes to the combined Dashboard view. */
  setActive: (id: string, active: boolean) => void;
};

// ==== Helpers ====

// Connection-sourced reports are typed by their Connection (always known).
// File-sourced reports are untyped until a Mapping is applied — undefined until then,
// which is why every consumer that splits reports by type must handle the undefined case.
export function getReportType(report: UploadedReport, connections: ConnectionLightModel[]): ReportType | undefined {
  if (report.connectionId) return connections.find((c) => c.id === report.connectionId)?.reportType;
  return report.mapping?.reportType;
}

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

// ==== Helpers ====

function buildSheetsWorkbook(sheets: ConnectionSheet[]): { workbook: XLSX.WorkBook; activeSheet: string; rowIndents: number[] } {
  const workbook = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(workbook, ws, s.name.slice(0, 31)); // xlsx caps at 31 chars
  }
  const activeSheet = workbook.SheetNames[0] ?? 'Sheet1';
  const rowIndents = (sheets[0]?.rows ?? []).map(() => 0);
  return { workbook, activeSheet, rowIndents };
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
      { id: crypto.randomUUID(), fileName: file.name, source: 'file', active: true, workbook, activeSheet, rowIndents },
    ]);
  }

  function addReportFromSheets(fileName: string, sheets: ConnectionSheet[], opts?: { connectionId?: string; connectionType?: ConnectionType; fetchedAt?: string }): string {
    const { workbook, activeSheet, rowIndents } = buildSheetsWorkbook(sheets);
    const id = crypto.randomUUID();
    setReports((prev) => [
      ...prev,
      { id, fileName, source: 'connection', connectionId: opts?.connectionId, connectionType: opts?.connectionType, fetchedAt: opts?.fetchedAt, active: true, workbook, activeSheet, rowIndents },
    ]);
    return id;
  }

  function replaceReportSheets(id: string, sheets: ConnectionSheet[], fetchedAt?: string) {
    const { workbook, activeSheet, rowIndents } = buildSheetsWorkbook(sheets);
    setReports((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, workbook, activeSheet, rowIndents, fetchedAt, mapped: undefined as MappedReport | undefined };
      // Re-derive mapped view if a mapping was already in effect.
      if (r.mapping) next.mapped = buildMappedReport(next, r.mapping);
      return next;
    }));
  }

  function setActive(id: string, active: boolean) {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, active } : r)));
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

  const ctx = useMemo(
    () => ({ reports, addReport, addReportFromSheets, replaceReportSheets, removeReport, updateReport, setMapping, setActive }),
    [reports],
  );

  return (
    <ReportContext.Provider value={ctx}>
      {children}
    </ReportContext.Provider>
  );
}

export function useReports(): ReportContextValue {
  const ctx = use(ReportContext);
  if (!ctx) throw new Error('useReports must be used inside ReportProvider');
  return ctx;
}

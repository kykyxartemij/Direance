'use client';

import { createContext, use, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { ArtColor } from '@/components/ui/art.types';
import type { MappingModel, ReportType } from '@/models/mapping.models';
import type { ConnectionLightModel, ConnectionType } from '@/models/connection.models';
import { type TotalColumnInfo } from '@/page/mapping/applyMapping';
import { buildMappedReport } from '@/page/reports/buildReport';

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

type ReportContextValue = {
  /** File uploads + local edits only. Connection reports are NOT stored here — the report
   *  pages derive those straight from their react-query fetch (see buildConnectionReport),
   *  so a report page merges these with its own connection reports at render time. */
  reports: UploadedReport[];
  addReport: (file: File) => Promise<void>;
  removeReport: (id: string) => void;
  /** Patch the raw report (does NOT recompute mapped). For setting the applied mapping, use setMapping. */
  updateReport: (id: string, patch: Partial<UploadedReport>) => void;
  /** Apply (or clear) a mapping. Recomputes `mapped` so callers never run mapping logic themselves. */
  setMapping: (id: string, mapping: MappingModel | undefined) => void;
  /** Toggle whether the report contributes to the combined Dashboard view. */
  setActive: (id: string, active: boolean) => void;
  /**
   * Explicit user overrides of a connection's active state, keyed by connection id.
   * Absence means "follow `isDefault`" — see isConnectionActive. Only ever holds ids the
   * user actually clicked; `isDefault` itself lives in the connections query, never copied
   * into local state, so there's nothing here to seed or sync on load.
   */
  connectionOverrides: Map<string, boolean>;
  /** Marks a connection active/inactive. Turning off also drops its loaded report, if any. */
  setConnectionActive: (connectionId: string, active: boolean) => void;
};

// ==== Helpers ====

// Connection-sourced reports are typed by their Connection (always known).
// File-sourced reports are untyped until a Mapping is applied — undefined until then,
// which is why every consumer that splits reports by type must handle the undefined case.
export function getReportType(report: UploadedReport, connections: ConnectionLightModel[]): ReportType | undefined {
  if (report.connectionId) return connections.find((c) => c.id === report.connectionId)?.reportType;
  return report.mapping?.reportType;
}

// No override recorded yet → falls back to the connection's own `isDefault` from the
// connections query. Nothing to seed or sync: the default lives in server data, read live.
export function isConnectionActive(connection: ConnectionLightModel, overrides: Map<string, boolean>): boolean {
  return overrides.get(connection.id) ?? connection.isDefault;
}

// ==== Context ====

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const [reports, setReports] = useState<UploadedReport[]>([]);
  const [connectionOverrides, setConnectionOverrides] = useState<Map<string, boolean>>(new Map());

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

  function setActive(id: string, active: boolean) {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, active } : r)));
  }

  // Pure override write — no report side effects. Deactivating a connection drops it from
  // the active id set the report page fetches, so its report simply stops being derived;
  // nothing to remove from a store, because connection reports were never stored here.
  function setConnectionActive(connectionId: string, active: boolean) {
    setConnectionOverrides((prev) => {
      const next = new Map(prev);
      next.set(connectionId, active);
      return next;
    });
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
    () => ({
      reports, addReport, removeReport, updateReport, setMapping, setActive,
      connectionOverrides, setConnectionActive,
    }),
    [reports, connectionOverrides],
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

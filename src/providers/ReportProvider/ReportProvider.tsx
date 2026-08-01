'use client';

import { createContext, use, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { MappingModel } from '@/models/mapping.models';
import { buildMappedReport } from '@/page/reports/buildReport';
import type { ReportContextValue, UploadedReport } from './types';

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

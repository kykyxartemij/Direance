import type * as XLSX from 'xlsx';
import type { ArtColor } from '@/components/ui/art.types';
import type { MappingModel } from '@/models/mapping.models';
import type { ConnectionType } from '@/models/connection.models';
import type { TotalColumnInfo } from '@/page/mapping/applyMapping';

export type Row = Record<string, unknown>;

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

export type ReportContextValue = {
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

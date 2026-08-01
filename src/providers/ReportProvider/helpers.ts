import type { ReportType } from '@/models/mapping.models';
import type { ConnectionLightModel } from '@/models/connection.models';
import type { UploadedReport } from './types';

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

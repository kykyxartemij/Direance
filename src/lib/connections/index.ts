import 'server-only';
import type { ConnectionType, ConnectionSecret, FetchFiltersModel } from '@/models/connection.models';
import { runMeritDriver } from './merit';
import { runOdooDriver } from './odoo';

// ==== Driver dispatch ====
// Each driver returns a normalized RawReport — the same shape xlsx parsing
// produces — so applyMappingMultiSheet can consume it identically.

export type RawReportSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

export type RawReport = {
  sheets: RawReportSheet[];
  fetchedAt: string;
};

export type DriverInput = {
  type: ConnectionType;
  /** Report type scoped on the Connection row — determines which endpoint the driver calls. */
  reportType: string;
  config: Record<string, unknown>;
  secret: ConnectionSecret;
  filters: FetchFiltersModel;
};

export async function runConnectionDriver(input: DriverInput): Promise<RawReport> {
  switch (input.type) {
    case 'merit': return runMeritDriver(input);
    case 'odoo':  return runOdooDriver(input);
    default: throw new Error(`Unknown connection type: ${input.type}`);
  }
}

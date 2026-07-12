import 'server-only';
import type { ConnectionType, ConnectionSecret, PnlFetchFiltersModel, FinancialPositionFetchFiltersModel } from '@/models/connection.models';
import { runMeritPnlDriver, runMeritFinancialPositionDriver } from './merit';
import { runOdooPnlDriver, runOdooFinancialPositionDriver } from './odoo';

// ==== Driver dispatch ====
// Each driver returns a normalized RawReport — the same shape xlsx parsing
// produces — so applyMappingMultiSheet can consume it identically.
//
// Two dispatchers, not one — runPnlConnectionDriver only ever sees
// PnlFetchFiltersModel, runFinancialPositionConnectionDriver only ever sees
// FinancialPositionFetchFiltersModel. Each picks the merit/odoo driver for
// its own report type; there's no shared "DriverFetchFilters" blending both.

export type RawReportSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

export type RawReport = {
  sheets: RawReportSheet[];
  fetchedAt: string;
};

type ConnectionDriverInput<F> = {
  type: ConnectionType;
  config: Record<string, unknown>;
  secret: ConnectionSecret;
  filters: F;
};

export async function runPnlConnectionDriver(input: ConnectionDriverInput<PnlFetchFiltersModel>): Promise<RawReport> {
  if (input.type === 'merit_estonia' || input.type === 'merit_poland') return runMeritPnlDriver({ ...input, type: input.type });
  if (input.type === 'odoo') return runOdooPnlDriver(input);
  throw new Error(`Unknown connection type: ${input.type}`);
}

export async function runFinancialPositionConnectionDriver(input: ConnectionDriverInput<FinancialPositionFetchFiltersModel>): Promise<RawReport> {
  if (input.type === 'merit_estonia' || input.type === 'merit_poland') return runMeritFinancialPositionDriver({ ...input, type: input.type });
  if (input.type === 'odoo') return runOdooFinancialPositionDriver(input);
  throw new Error(`Unknown connection type: ${input.type}`);
}

import 'server-only';
import type { ConnectionType, ConnectionSecret, PnlFetchFiltersModel, FinancialPositionFetchFiltersModel } from '@/models/connection.models';
import { runMeritPnlDriver, runMeritFinancialPositionDriver } from './merit';
import { runOdooPnlDriver, runOdooFinancialPositionDriver, testOdooConnection } from './odoo';

// ==== Driver dispatch ====
// RawReport mirrors xlsx parsing's output shape so applyMappingMultiSheet stays generic.

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

// NOTE: two dispatchers, not one — each only ever sees its own report type's filter model, no shared union.
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

// ==== Test connection ====

type TestConnectionInput = {
  type: ConnectionType;
  config: Record<string, unknown>;
  secret: ConnectionSecret;
};

// NOTE: Merit has no auth-only endpoint, so its test runs a real perCount: 1 report call, not a true no-data ping.
export async function testPnlConnectionDriver(input: TestConnectionInput): Promise<void> {
  if (input.type === 'odoo') return testOdooConnection(input.config, input.secret);
  if (input.type === 'merit_estonia' || input.type === 'merit_poland') {
    await runMeritPnlDriver({ type: input.type, config: input.config, secret: input.secret, filters: { periods: 1 } });
    return;
  }
  throw new Error(`Unknown connection type: ${input.type}`);
}

export async function testFinancialPositionConnectionDriver(input: TestConnectionInput): Promise<void> {
  if (input.type === 'odoo') return testOdooConnection(input.config, input.secret);
  if (input.type === 'merit_estonia' || input.type === 'merit_poland') {
    await runMeritFinancialPositionDriver({ type: input.type, config: input.config, secret: input.secret, filters: { periods: 1 } });
    return;
  }
  throw new Error(`Unknown connection type: ${input.type}`);
}

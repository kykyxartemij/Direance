import type { FinancialPositionFetchFiltersModel } from '@/models/connection.models';

// ==== Financial Position filter values — separate type from P&L on purpose ====
// No sumPeriods — see connection.models.ts: FinancialPositionFetchFiltersModel
// is its own type, not a shared shape with PnlFetchFiltersModel.
// FinancialPositionFilterForm renders these fields explicitly — no shared
// generic filter renderer.

export type FinancialPositionFilterValues = {
  dateFrom: string;
  dateTo: string;
  perCount: string;
  endDate: string;
  journalIds: string;
  accountPrefix: string;
};

export function defaultFinancialPositionFilterValues(): FinancialPositionFilterValues {
  return {
    dateFrom: '',
    dateTo: '',
    perCount: '1',
    endDate: new Date().toISOString().slice(0, 10),
    journalIds: '',
    accountPrefix: '',
  };
}

export function buildFinancialPositionFetchFilters(values: FinancialPositionFilterValues): { reportType: 'financial_position' } & FinancialPositionFetchFiltersModel {
  const journalIds = values.journalIds
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const extras: Record<string, unknown> = {};
  if (journalIds.length > 0) extras.journalIds = journalIds;
  if (values.accountPrefix) extras.accountPrefix = values.accountPrefix;

  return {
    reportType: 'financial_position',
    ...(values.dateFrom ? { dateFrom: values.dateFrom } : {}),
    ...(values.dateTo ? { dateTo: values.dateTo } : {}),
    ...(values.perCount ? { perCount: Number(values.perCount) } : {}),
    ...(values.endDate ? { endDate: values.endDate } : {}),
    ...(Object.keys(extras).length > 0 ? { extras } : {}),
  };
}

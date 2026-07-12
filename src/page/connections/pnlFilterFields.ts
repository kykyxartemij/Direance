import type { PnlFetchFiltersModel } from '@/models/connection.models';

// ==== P&L filter values — separate type from Financial Position on purpose ====
// See connection.models.ts: PnlFetchFiltersModel is its own type, not a shared
// shape with FinancialPositionFetchFiltersModel. PnlFilterForm renders the
// subset of these fields each connection type actually supports — Merit
// (perCount/endDate/depFilter) and Odoo (dateFrom/dateTo/journalIds/accountPrefix)
// each only understand their own fields; the driver ignores the rest.

export type PnlFilterValues = {
  dateFrom: string;
  dateTo: string;
  perCount: string;
  endDate: string;
  depFilter: string;
  journalIds: string;
  accountPrefix: string;
};

export function defaultPnlFilterValues(): PnlFilterValues {
  return {
    dateFrom: '',
    dateTo: '',
    perCount: '1',
    endDate: new Date().toISOString().slice(0, 10),
    depFilter: '',
    journalIds: '',
    accountPrefix: '',
  };
}

export function buildPnlFetchFilters(values: PnlFilterValues): { reportType: 'pnl' } & PnlFetchFiltersModel {
  const journalIds = values.journalIds
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const extras: Record<string, unknown> = {};
  if (journalIds.length > 0) extras.journalIds = journalIds;
  if (values.accountPrefix) extras.accountPrefix = values.accountPrefix;

  return {
    reportType: 'pnl',
    ...(values.dateFrom ? { dateFrom: values.dateFrom } : {}),
    ...(values.dateTo ? { dateTo: values.dateTo } : {}),
    ...(values.perCount ? { perCount: Number(values.perCount) } : {}),
    ...(values.endDate ? { endDate: values.endDate } : {}),
    ...(values.depFilter ? { depFilter: values.depFilter } : {}),
    ...(Object.keys(extras).length > 0 ? { extras } : {}),
  };
}

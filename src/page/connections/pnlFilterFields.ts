import type { PnlFetchFiltersModel } from '@/models/connection.models';

// ==== P&L filter values — universal across drivers ====
// dateTo/dateFrom/periods map onto every driver's own native params — see
// PnlFetchFiltersModel and lib/connections/*. No per-driver field split.

export type PnlFilterValues = {
  dateTo: string;
  dateFrom: string;
  periods: string;
};

export function defaultPnlFilterValues(): PnlFilterValues {
  return {
    dateTo: new Date().toISOString().slice(0, 10),
    dateFrom: '',
    periods: '1',
  };
}

export function buildPnlFetchFilters(values: PnlFilterValues): { reportType: 'pnl' } & PnlFetchFiltersModel {
  return {
    reportType: 'pnl',
    ...(values.dateTo ? { dateTo: values.dateTo } : {}),
    ...(values.dateFrom ? { dateFrom: values.dateFrom } : {}),
    ...(values.periods ? { periods: Number(values.periods) } : {}),
  };
}

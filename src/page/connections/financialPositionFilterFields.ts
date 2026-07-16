import type { FinancialPositionFetchFiltersModel } from '@/models/connection.models';

// ==== Financial Position filter values — universal across drivers ====
// dateTo (balance date) + periods map onto every driver's own native params.
// No dateFrom — balance sheet is as-of, not a range. See
// FinancialPositionFetchFiltersModel and lib/connections/*.

export type FinancialPositionFilterValues = {
  dateTo: string;
  periods: string;
};

export function defaultFinancialPositionFilterValues(): FinancialPositionFilterValues {
  return {
    dateTo: new Date().toISOString().slice(0, 10),
    periods: '1',
  };
}

export function buildFinancialPositionFetchFilters(values: FinancialPositionFilterValues): { reportType: 'financial_position' } & FinancialPositionFetchFiltersModel {
  return {
    reportType: 'financial_position',
    ...(values.dateTo ? { dateTo: values.dateTo } : {}),
    ...(values.periods ? { periods: Number(values.periods) } : {}),
  };
}

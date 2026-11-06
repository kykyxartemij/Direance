'use client';

import ArtInput from '@/components/ui/ArtInput';
import ArtDatePicker from '@/components/ui/ArtDatePicker';
import type { FinancialPositionFilterValues } from './financialPositionFilterFields';

// ==== Financial Position filter form — universal across drivers ====
// dateTo (balance date) + periods map onto every connection's own driver —
// see financialPositionFilterFields.ts and lib/connections/*. No dateFrom —
// balance sheet is as-of, not a range.

type Props = {
  values: FinancialPositionFilterValues;
  onChange: (key: keyof FinancialPositionFilterValues, value: string) => void;
};

// Bare fields — the page owns the 3-per-row grid layout.
export default function FinancialPositionFilterForm({ values, onChange }: Props) {
  return (
    <>
      <ArtDatePicker
        label="Balance date"
        clearable={false}
        value={values.dateTo}
        onChange={(v) => onChange('dateTo', v)}
        helperText="Balances on this date. Today by default."
      />
      <ArtInput
        label="Periods"
        type="number"
        placeholder="1"
        value={values.periods}
        onChange={(e) => onChange('periods', e.target.value)}
        helperText="Balance date, plus the end of each earlier month."
      />
    </>
  );
}

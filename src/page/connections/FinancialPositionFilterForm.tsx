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

export default function FinancialPositionFilterForm({ values, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ArtDatePicker
        label="Balance date"
        value={values.dateTo}
        onChange={(v) => onChange('dateTo', v)}
        helperText="Snapshot date each period's balance is taken as of. Defaults to today."
      />
      <ArtInput
        label="Periods"
        type="number"
        placeholder="1"
        value={values.periods}
        onChange={(e) => onChange('periods', e.target.value)}
        helperText="Number of periods (months) to include, counted back from the balance date."
      />
    </div>
  );
}

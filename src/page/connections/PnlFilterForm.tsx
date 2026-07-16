'use client';

import ArtInput from '@/components/ui/ArtInput';
import ArtDatePicker from '@/components/ui/ArtDatePicker';
import type { PnlFilterValues } from './pnlFilterFields';

// ==== P&L filter form — universal across drivers ====
// dateTo/dateFrom/periods map onto every connection's own driver — see
// pnlFilterFields.ts and lib/connections/*. No per-driver branching.

type Props = {
  values: PnlFilterValues;
  onChange: (key: keyof PnlFilterValues, value: string) => void;
};

export default function PnlFilterForm({ values, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <ArtDatePicker
        label="Period end date"
        value={values.dateTo}
        onChange={(v) => onChange('dateTo', v)}
        helperText="Last day of the period range. Defaults to today."
      />
      <ArtInput
        label="Periods"
        type="number"
        placeholder="1"
        value={values.periods}
        onChange={(e) => onChange('periods', e.target.value)}
        helperText="Number of periods (months) to include, counted back from the end date."
      />
      <ArtDatePicker
        label="Date from"
        value={values.dateFrom}
        onChange={(v) => onChange('dateFrom', v)}
        helperText="Explicit range start — overrides periods when set. Leave blank to use periods instead."
      />
    </div>
  );
}

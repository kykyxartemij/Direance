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

// Bare fields — the page owns the 3-per-row grid layout.
export default function PnlFilterForm({ values, onChange }: Props) {
  return (
    <>
      <ArtDatePicker
        label="Period end date"
        clearable={false}
        value={values.dateTo}
        onChange={(v) => onChange('dateTo', v)}
        helperText="Last day of the report. Today by default."
      />
      <ArtInput
        label="Periods"
        type="number"
        placeholder="1"
        value={values.periods}
        disabled={!!values.dateFrom}
        onChange={(e) => onChange('periods', e.target.value)}
        helperText="Months to show, going back from the end date."
      />
      <ArtDatePicker
        label="Date from"
        value={values.dateFrom}
        onChange={(v) => onChange('dateFrom', v)}
        helperText="First day of the report. When set, Periods is not used."
      />
    </>
  );
}

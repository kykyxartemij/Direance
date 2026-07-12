'use client';

import ArtInput from '@/components/ui/ArtInput';
import ArtDatePicker from '@/components/ui/ArtDatePicker';
import type { PnlFilterValues } from './pnlFilterFields';
import type { ConnectionType } from '@/models/connection.models';

// ==== P&L filter form — fields depend on the connection's driver ====
// Merit (getprofitrep) and Odoo (account.move.line search) accept completely
// different parameters — showing both sets regardless of connectionType used
// to silently no-op half the form. See pnlFilterFields.ts for the real,
// per-driver field list this mirrors.

type Props = {
  connectionType: ConnectionType;
  values: PnlFilterValues;
  onChange: (key: keyof PnlFilterValues, value: string) => void;
};

export default function PnlFilterForm({ connectionType, values, onChange }: Props) {
  if (connectionType === 'merit_estonia' || connectionType === 'merit_poland') {
    return (
      <div className="grid grid-cols-4 gap-3">
        <ArtInput
          label="Periods"
          type="number"
          placeholder="1"
          value={values.perCount}
          onChange={(e) => onChange('perCount', e.target.value)}
          helperText="Number of periods (months) to include, counted back from the period end date."
        />
        <ArtDatePicker
          label="Period end date"
          value={values.endDate}
          onChange={(v) => onChange('endDate', v)}
          helperText="Last day of the period range (Merit: EndDate)."
        />
        <ArtInput
          label="Department"
          placeholder="e.g. 10"
          value={values.depFilter}
          onChange={(e) => onChange('depFilter', e.target.value)}
          helperText="Optional Merit department code to filter by. Leave blank for all departments."
        />
        <ArtDatePicker label="Date from" disabled value="" onChange={() => {}} helperText="Not supported by Merit — only period end date + periods." />
        <ArtDatePicker label="Date to" disabled value="" onChange={() => {}} helperText="Not supported by Merit — only period end date + periods." />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      <ArtDatePicker
        label="Date from"
        value={values.dateFrom}
        onChange={(v) => onChange('dateFrom', v)}
        helperText="Start of the date range pulled from the ledger. Leave blank for no lower bound."
      />
      <ArtDatePicker
        label="Date to"
        value={values.dateTo}
        onChange={(v) => onChange('dateTo', v)}
        helperText="End of the date range pulled from the ledger. Leave blank for no upper bound."
      />
      <ArtInput
        label="Journal IDs"
        placeholder="1,2,5"
        value={values.journalIds}
        onChange={(e) => onChange('journalIds', e.target.value)}
        helperText="Comma-separated journal IDs to restrict the report to. Leave blank for all journals."
      />
      <ArtInput
        label="Account prefix"
        placeholder="411"
        value={values.accountPrefix}
        onChange={(e) => onChange('accountPrefix', e.target.value)}
        helperText="Only include accounts whose code starts with this prefix."
      />
    </div>
  );
}

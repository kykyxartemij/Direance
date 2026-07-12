'use client';

import ArtInput from '@/components/ui/ArtInput';
import ArtDatePicker from '@/components/ui/ArtDatePicker';
import type { FinancialPositionFilterValues } from './financialPositionFilterFields';
import type { ConnectionType } from '@/models/connection.models';

// ==== Financial Position filter form — fields depend on the connection's driver ====
// Merit (getbalancerep) accepts only EndDate + PerCount — no DepFilter, unlike
// getprofitrep (see PnlFilterForm). Odoo uses the same account.move.line domain
// filters as P&L. See financialPositionFilterFields.ts for the real field list.

type Props = {
  connectionType: ConnectionType;
  values: FinancialPositionFilterValues;
  onChange: (key: keyof FinancialPositionFilterValues, value: string) => void;
};

export default function FinancialPositionFilterForm({ connectionType, values, onChange }: Props) {
  if (connectionType === 'merit_estonia' || connectionType === 'merit_poland') {
    return (
      <div className="grid grid-cols-4 gap-3">
        <ArtInput
          label="Periods"
          type="number"
          placeholder="1"
          value={values.perCount}
          onChange={(e) => onChange('perCount', e.target.value)}
          helperText="Number of periods (months) to include, counted back from the balance date."
        />
        <ArtDatePicker
          label="Balance date"
          value={values.endDate}
          onChange={(v) => onChange('endDate', v)}
          helperText="Snapshot date each period's balance is taken as of (Merit: EndDate)."
        />
        <ArtDatePicker label="Date from" disabled value="" onChange={() => {}} helperText="Not supported by Merit — only balance date + periods." />
        <ArtDatePicker label="Date to" disabled value="" onChange={() => {}} helperText="Not supported by Merit — only balance date + periods." />
        <ArtInput label="Department" disabled value="" helperText="Not supported on the balance sheet endpoint (P&L only)." />
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

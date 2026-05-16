'use client';

import { useFormContext } from 'react-hook-form';
import { useCurrencyOptions } from '@/hooks/currencies.hooks';
import type { ArtSelectOption } from '@/components/ui/ArtSelect';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import ArtComboBox from '@/components/ui/ArtComboBox';
import ArtCollapse from '@/components/ui/ArtCollapse';
import { ArtFormSelect, ArtFormComboBox } from '@/components/form';

// ==== Constants ====

const REPORT_TYPE_OPTIONS: ArtSelectOption[] = [
  { label: 'Profit & Loss', value: 'pnl' },
  { label: 'Financial Position', value: 'financial_position' },
];

// ==== Props ====

interface MappingMetaSectionProps {
  /** Show the "pick existing mapping" combo (excel flow). Hide for the form flow. */
  showMappingSelector?: boolean;
  /** Required when showMappingSelector is true. */
  mappingOptions?: ArtComboBoxOption[];
  selectedMappingOption?: ArtComboBoxOption | null;
  onMappingChange?: (opt: ArtComboBoxOption | null) => void;
  /** Optional banner under the grid — e.g. "Editing: My mapping" or global-mapping notice. */
  hint?: string;
}

// ==== Section ====
// Caller must wrap with <FormProvider> and register `reportType`, `fromCurrency`,
// `toCurrency` in its RHF schema. Values use the same names as MappingStep so
// callers can lift the same yup schema fragment.

export default function MappingMetaSection({
  showMappingSelector = false,
  mappingOptions = [],
  selectedMappingOption = null,
  onMappingChange,
  hint,
}: MappingMetaSectionProps) {
  const { setValue } = useFormContext();
  const currencyOptions = useCurrencyOptions();

  return (
    <ArtCollapse title="Mapping" defaultOpen>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <ArtFormSelect
            name="reportType"
            label="Report Type"
            options={REPORT_TYPE_OPTIONS}
            required
          />

          {showMappingSelector && (
            <ArtComboBox
              label="Mapping"
              options={mappingOptions}
              selected={selectedMappingOption}
              onChange={onMappingChange}
              placeholder="Select or create mapping…"
              clearable
            />
          )}

          <ArtFormComboBox
            name="fromCurrency"
            label="From Currency"
            options={currencyOptions}
            placeholder="EUR"
            searchable
            onSubmit={(text) => { if (text) setValue('fromCurrency', text.toUpperCase()); }}
          />

          <ArtFormComboBox
            name="toCurrency"
            label="To Currency"
            options={currencyOptions}
            placeholder="EUR"
            searchable
            onSubmit={(text) => { if (text) setValue('toCurrency', text.toUpperCase()); }}
          />
        </div>

        {hint && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>
        )}
      </div>
    </ArtCollapse>
  );
}

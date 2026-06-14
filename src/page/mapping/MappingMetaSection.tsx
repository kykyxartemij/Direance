'use client';

import { useFormContext } from 'react-hook-form';
import { useCurrencyOptions } from '@/hooks/currencies.hooks';
import FormSection from '@/components/FormSection';
import { ArtFormComboBox } from '@/components/form';

// ==== Section ====
// Mapping-side meta: currencies only. Identity fields (Name/Mapping picker,
// Visibility, Report Type) live in a separate top "unique" section in the parent
// so the page top is always the page-defining identity, not currency knobs.
// Caller must wrap with <FormProvider> and register `fromCurrency`, `toCurrency`.

export default function MappingMetaSection() {
  const { setValue } = useFormContext();
  const currencyOptions = useCurrencyOptions();

  return (
    <FormSection title="Mapping">
      <div className="grid grid-cols-2 gap-4">
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
    </FormSection>
  );
}

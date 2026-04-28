'use client';

import { Controller, useFormContext } from 'react-hook-form';
import ArtComboBox, { type ArtComboBoxSingleProps, type ArtComboBoxOption } from '@/components/ui/ArtComboBox';

// ==== Types ====

interface ArtFormComboBoxProps extends Omit<ArtComboBoxSingleProps, 'name' | 'selected' | 'onChange'> {
  name: string;
  helperText?: string;
}

// ==== Component ====

// field.value is the option's .value string (or null) — not the full ArtComboBoxOption object.
export function ArtFormComboBox({ name, helperText, options = [], ...props }: ArtFormComboBoxProps) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <ArtComboBox
          {...props}
          options={options}
          selected={options.find((o) => o.value === (field.value as string | null | undefined)) ?? null}
          onChange={(opt: ArtComboBoxOption | null) => field.onChange(opt?.value ?? null)}
          helperText={fieldState.error?.message ?? helperText}
          ref={field.ref}
        />
      )}
    />
  );
}

export default ArtFormComboBox;

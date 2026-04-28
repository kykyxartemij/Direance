'use client';

import { Controller, useFormContext } from 'react-hook-form';
import ArtSelect, { type ArtSelectProps, type ArtSelectOption } from '@/components/ui/ArtSelect';

// ==== Types ====

interface ArtFormSelectProps extends Omit<ArtSelectProps, 'name' | 'selected' | 'onChange'> {
  name: string;
  helperText?: string;
}

// ==== Component ====

// field.value is the option's .value string (or null) — not the full ArtSelectOption object.
export function ArtFormSelect({ name, helperText, options = [], ...props }: ArtFormSelectProps) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <ArtSelect
          {...props}
          options={options}
          selected={options.find((o) => o.value === (field.value as string | null | undefined)) ?? null}
          onChange={(opt: ArtSelectOption | null) => field.onChange(opt?.value ?? null)}
          helperText={fieldState.error?.message ?? helperText}
          ref={field.ref}
        />
      )}
    />
  );
}

export default ArtFormSelect;

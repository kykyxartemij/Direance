'use client';

import { Controller, useFormContext } from 'react-hook-form';
import ArtDatePicker, { type ArtDatePickerProps } from '@/components/ui/ArtDatePicker';

// ==== Types ====

interface ArtFormDatePickerProps extends Omit<ArtDatePickerProps, 'name' | 'value' | 'onChange'> {
  name: string;
}

// ==== Component ====

export function ArtFormDatePicker({ name, helperText, ...props }: ArtFormDatePickerProps) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <ArtDatePicker
          {...props}
          value={field.value ?? ''}
          onChange={field.onChange}
          errorText={fieldState.error?.message}
          helperText={helperText}
        />
      )}
    />
  );
}

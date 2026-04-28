'use client';

import { Controller, useFormContext } from 'react-hook-form';
import ArtTextarea, { type ArtTextareaProps } from '@/components/ui/ArtTextarea';

// ==== Types ====

interface ArtFormTextareaProps extends Omit<ArtTextareaProps, 'name'> {
  name: string;
}

// ==== Component ====

export function ArtFormTextarea({ name, helperText, ...props }: ArtFormTextareaProps) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <ArtTextarea
          {...props}
          {...field}
          value={field.value ?? ''}
          error={!!fieldState.error}
          helperText={fieldState.error?.message ?? helperText}
        />
      )}
    />
  );
}

export default ArtFormTextarea;

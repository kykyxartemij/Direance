'use client';

import { Controller, useFormContext } from 'react-hook-form';
import ArtInput, { type ArtInputProps } from '@/components/ui/ArtInput';

// ==== Types ====

interface ArtFormInputProps extends Omit<ArtInputProps, 'name'> {
  name: string;
}

// ==== Component ====

export function ArtFormInput({ name, helperText, ...props }: ArtFormInputProps) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <ArtInput
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

export default ArtFormInput;

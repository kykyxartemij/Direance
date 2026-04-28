'use client';

import { Controller, useFormContext } from 'react-hook-form';
import ArtCheckbox, { type ArtCheckboxProps } from '@/components/ui/ArtCheckbox';

// ==== Types ====

interface ArtFormCheckboxProps extends Omit<ArtCheckboxProps, 'name' | 'checked' | 'onChange'> {
  name: string;
}

// ==== Component ====

export function ArtFormCheckbox({ name, helperText, ...props }: ArtFormCheckboxProps) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <ArtCheckbox
          {...props}
          checked={field.value ?? false}
          onChange={(e) => field.onChange(e.target.checked)}
          ref={field.ref}
          helperText={fieldState.error?.message ?? helperText}
        />
      )}
    />
  );
}

export default ArtFormCheckbox;

'use client';

import { Controller, useFormContext } from 'react-hook-form';
import ArtSwitch, { type ArtSwitchProps } from '@/components/ui/ArtSwitch';

// ==== Types ====

interface ArtFormSwitchProps extends Omit<ArtSwitchProps, 'name' | 'checked' | 'onChange'> {
  name: string;
}

// ==== Component ====

export function ArtFormSwitch({ name, helperText, ...props }: ArtFormSwitchProps) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <ArtSwitch
          {...props}
          checked={field.value ?? false}
          onChange={(e) => field.onChange(e.target.checked)}
          ref={field.ref}
          errorText={fieldState.error?.message}
          helperText={helperText}
        />
      )}
    />
  );
}

export default ArtFormSwitch;

'use client';

import { Controller, useFormContext } from 'react-hook-form';
import ArtListbox, { type ArtListboxProps, type ArtListboxOption } from '@/components/ui/ArtListbox';

// ==== Types ====

interface ArtFormListboxProps extends Omit<ArtListboxProps, 'selectedValues' | 'onSelect'> {
  name: string;
  helperText?: string;
}

// ==== Component ====

export function ArtFormListbox({ name, helperText, ...props }: ArtFormListboxProps) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <>
          <ArtListbox
            {...props}
            selectedValues={field.value as string[]}
            onSelect={(opt: ArtListboxOption) => {
              const current = (field.value as string[]) ?? [];
              const next = current.includes(opt.value)
                ? current.filter((v) => v !== opt.value)
                : [...current, opt.value];
              field.onChange(next);
            }}
          />
          {(fieldState.error?.message ?? helperText) && (
            <p className="art-field-helper">{fieldState.error?.message ?? helperText}</p>
          )}
        </>
      )}
    />
  );
}

export default ArtFormListbox;

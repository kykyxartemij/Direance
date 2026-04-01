'use client';

import ArtSelect, { type ArtSelectOption } from '@/components/ui/ArtSelect';
import type { ArtColor } from '@/components/ui/art.types';

// ==== Options ====

const COLOR_OPTIONS: ArtSelectOption[] = [
  { label: 'Neutral', value: 'neutral' },
  { label: 'Primary', value: 'primary', color: 'primary' },
  { label: 'Success', value: 'success', color: 'success' },
  { label: 'Warning', value: 'warning', color: 'warning' },
  { label: 'Danger', value: 'danger', color: 'danger' },
];

// ==== Component ====

interface ColorSelectProps {
  value?: ArtColor;
  onChange: (color: ArtColor | undefined) => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ColorSelect({ value, onChange, placeholder = 'Color', size = 'sm' }: ColorSelectProps) {
  const selected = COLOR_OPTIONS.find((o) => o.value === value) ?? null;

  return (
    <ArtSelect
      options={COLOR_OPTIONS}
      selected={selected}
      onChange={(opt) => {
        const v = opt?.value as ArtColor | undefined;
        onChange(!v || v === 'neutral' ? undefined : v);
      }}
      placeholder={placeholder}
      size={size}
      clearable
    />
  );
}

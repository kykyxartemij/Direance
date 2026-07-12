'use client';

import ArtInput from './ArtInput';

interface ArtDatePickerProps {
  label?: string;
  helperText?: string;
  errorText?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}

// Thin wrapper over ArtInput[type=date] — value-based onChange, no native event leak.
function ArtDatePicker({ label, helperText, errorText, value, onChange, disabled, required }: ArtDatePickerProps) {
  return (
    <ArtInput
      label={label}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      helperText={helperText}
      errorText={errorText}
      disabled={disabled}
      required={required}
    />
  );
}

ArtDatePicker.displayName = 'ArtDatePicker';

export default ArtDatePicker;
export { ArtDatePicker };
export type { ArtDatePickerProps };

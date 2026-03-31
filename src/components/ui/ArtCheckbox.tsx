'use client';

import { forwardRef, useId, useState } from 'react';
import ArtIcon from './ArtIcon';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

// ==== Types ====

interface ArtCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: ArtColor;
}

const SIZE_CLASS: Record<NonNullable<ArtCheckboxProps['size']>, string> = {
  sm: 'art-checkbox--sm',
  md: '',
  lg: 'art-checkbox--lg',
};

// ==== Component ====

const ArtCheckbox = forwardRef<HTMLInputElement, ArtCheckboxProps>((
  { label, size = 'md', color, id: idProp, className, checked, defaultChecked, onChange, disabled, readOnly, required, ...rest },
  ref,
) => {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  // ==== Controlled / uncontrolled state ====
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(defaultChecked ?? false);
  const isChecked = isControlled ? checked : internal;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange?.(e);
  };

  // ==== Render ====
  return (
    <label
      htmlFor={id}
      className={cn(
        'art-checkbox-root',
        SIZE_CLASS[size],
        color && ART_COLOR_CLASS[color],
        disabled && 'art-checkbox-root--disabled',
        className,
      )}
    >
      {/* Native checkbox — hidden, drives :checked CSS + form value */}
      <input
        {...rest}
        ref={ref}
        id={id}
        type="checkbox"
        className="art-checkbox-input"
        checked={isChecked}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        onChange={handleChange}
      />
      {/* Visual box — shows check icon when checked */}
      <span className="art-checkbox-box" aria-hidden>
        <ArtIcon name="Check" size={10} />
      </span>
      {label && (
        <span className="art-checkbox-label">
          {label}
          {required && <span className="art-label-required" aria-hidden>*</span>}
        </span>
      )}
    </label>
  );
});

ArtCheckbox.displayName = 'ArtCheckbox';
export default ArtCheckbox;
export { ArtCheckbox };
export type { ArtCheckboxProps };

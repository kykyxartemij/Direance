'use client';

import { forwardRef, useId, useState } from 'react';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtSwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: ArtColor;
}

const SIZE_CLASS: Record<NonNullable<ArtSwitchProps['size']>, string> = {
  sm: 'art-switch--sm',
  md: '',
  lg: 'art-switch--lg',
};

const ArtSwitch = forwardRef<HTMLInputElement, ArtSwitchProps>((
  { label, size = 'md', color, id: idProp, className, checked, defaultChecked, onChange, disabled, readOnly, required, ...rest },
  ref,
) => {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  // ==== Uncontrolled state ====
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(defaultChecked ?? false);
  const isChecked = isControlled ? checked : internal;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange?.(e);
  };

  return (
    <label
      htmlFor={id}
      className={cn(
        'art-switch-root',
        SIZE_CLASS[size],
        color && ART_COLOR_CLASS[color],
        disabled && 'art-switch-root--disabled',
        className,
      )}
    >
      {/* Native checkbox — hidden, drives :checked CSS + form value */}
      <input
        {...rest}
        ref={ref}
        id={id}
        type="checkbox"
        className="art-switch-input"
        checked={isChecked}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        onChange={handleChange}
      />
      {/* Visual track + thumb */}
      <span className="art-switch-track" aria-hidden>
        <span className="art-switch-thumb" />
      </span>
      {label && (
        <span className="art-switch-label">
          {label}
          {required && <span className="art-label-required" aria-hidden>*</span>}
        </span>
      )}
    </label>
  );
});

ArtSwitch.displayName = 'ArtSwitch';
export default ArtSwitch;
export { ArtSwitch };
export type { ArtSwitchProps };

'use client';

import React, { forwardRef, useCallback, useId, useRef, useState } from 'react';
import { ArtIcon, ArtIconProps } from './ArtIcon';
import ArtIconButton from './ArtIconButton';
import ArtLabel from './ArtLabel';
import { useArtDebounced } from './art.hooks';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  icon?: ArtIconProps;
  clearable?: boolean;
  helperText?: string;
  debounce?: boolean | number;
  onDebouncedChange?: (value: string) => void;
  color?: ArtColor;
  error?: boolean;
  onClear?: () => void;
  label?: string;
}

const ArtInput = forwardRef<HTMLInputElement, ArtInputProps>((props, ref) => {
  const {
    className,
    icon,
    clearable,
    helperText,
    debounce: debounceMs = false,
    onDebouncedChange,
    onChange,
    color,
    error,
    onClear,
    label,
    id: idProp,
    required,
    readOnly,
    ...rest
  } = props;

  const generatedId = useId();
  const id = idProp ?? generatedId;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hasValue, setHasValue] = useState(false);

  // ---- ref forwarding ----
  const setRef = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (!ref) return;
    typeof ref === 'function' ? ref(el) : (ref.current = el);
  };

  // ---- debounce ----
  const debounced = useArtDebounced(onDebouncedChange, debounceMs);

  // ---- handlers ----
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value.length > 0);
      onChange?.(e);
      debounced(e.target.value);
    },
    [onChange, debounced],
  );

  const handleClear = () => {
    const el = inputRef.current;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    setHasValue(false);
    onClear?.();
  };

  // For controlled inputs, derive from the value prop directly; for uncontrolled, use tracked state
  const controlledValue = rest.value as string | undefined;
  const showClear = clearable && !readOnly && (controlledValue !== undefined ? controlledValue.length > 0 : hasValue);

  return (
    <div className={cn('art-field-wrapper', color && ART_COLOR_CLASS[color], error && 'art-field-wrapper--error')}>
      {label && <ArtLabel htmlFor={id} required={required}>{label}</ArtLabel>}
      <div className="art-field-inner">
        {icon && (
          <span className="art-field-icon" aria-hidden>
            <ArtIcon {...icon} />
          </span>
        )}
        <input
          {...rest}
          ref={setRef}
          id={id}
          required={required}
          readOnly={readOnly}
          className={cn('art-field', className)}
          onChange={handleChange}
        />
        {showClear && (
          <ArtIconButton
            icon={{ name: 'Close', size: 14 }}
            aria-label="Clear"
            className="art-field-clear"
            onClick={handleClear}
            tabIndex={-1}
          />
        )}
      </div>
      {helperText && <p className="art-field-helper">{helperText}</p>}
    </div>
  );
});

ArtInput.displayName = 'ArtInput';

export default ArtInput;
export { ArtInput };
export type { ArtInputProps };

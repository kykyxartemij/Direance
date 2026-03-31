'use client';

import { useId } from 'react';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import ArtIcon, { type ArtIconName } from './ArtIcon';
import { cn } from './art.utils';

// ==== Types ====

export interface ArtRadioOption {
  value: string;
  label: string;
  description?: string;
  icon?: ArtIconName;
  disabled?: boolean;
}

interface ArtRadioProps {
  options: ArtRadioOption[];
  value: string | null;
  onChange: (value: string) => void;
  /**
   * Hide the indicator circle — selection shown by background tint only.
   * Default: false
   */
  hideIndicator?: boolean;
  orientation?: 'horizontal' | 'vertical';
  color?: ArtColor;
  className?: string;
}

// ==== Component ====
// Native <input type="radio"> inside each <label> — visually hidden via art-radio-input.
// useId() gives each group a unique name so arrow-key navigation stays scoped to this group.
// :active on <label> works without e.preventDefault(), so no data-pressing needed.
// :has(input:focus-visible) shows a focus ring when keyboard-navigating.

function ArtRadio({
  options,
  value,
  onChange,
  hideIndicator = false,
  orientation = 'vertical',
  color,
  className,
}: ArtRadioProps) {
  const groupName = useId();

  return (
    <div
      role="radiogroup"
      className={cn('art-radio', orientation === 'horizontal' && 'art-radio--horizontal', className)}
    >
      {options.map((opt) => {
        const checked = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn(
              'art-radio-item',
              checked && 'art-radio-item--checked',
              opt.disabled && 'art-radio-item--disabled',
              color && ART_COLOR_CLASS[color],
            )}
          >
            <input
              type="radio"
              className="art-radio-input"
              name={groupName}
              value={opt.value}
              checked={checked}
              disabled={opt.disabled}
              onChange={() => onChange(opt.value)}
            />
            {!hideIndicator && <span className="art-radio-dot" aria-hidden="true" />}
            <span className="art-radio-item-inner">
              {opt.icon && <ArtIcon name={opt.icon} size="sm" />}
              <span className="art-radio-item-label">
                {opt.label}
                {opt.description && (
                  <span className="art-radio-item-desc">{opt.description}</span>
                )}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

ArtRadio.displayName = 'ArtRadio';
export default ArtRadio;
export { ArtRadio };
export type { ArtRadioProps };

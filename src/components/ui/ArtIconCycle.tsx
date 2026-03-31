'use client';

import { forwardRef, useState } from 'react';
import ArtButton, { type ArtButtonProps } from './ArtButton';
import ArtIcon, { type ArtIconName } from './ArtIcon';
import ArtTooltip from './ArtTooltip';
import { type ButtonHTMLAttributes } from 'react';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

// ==== Types ====

export interface ArtIconCycleOption<T extends string = string> {
  value: T;
  icon: ArtIconName;
  tooltip?: string;
  color?: ArtColor;
}

interface ArtIconCycleProps<T extends string = string>
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'color'> {
  options: ArtIconCycleOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  size?: ArtButtonProps['size'];
  variant?: ArtButtonProps['variant'];
}

const ICON_SIZE: Record<NonNullable<ArtIconCycleProps['size']>, number> = {
  sm: 14, md: 16, lg: 20,
};

// ==== Component ====

function ArtIconCycleInner<T extends string = string>(
  { options, value: valueProp, defaultValue, onChange, size = 'md', variant = 'ghost', className = '', onClick, ...rest }: ArtIconCycleProps<T>,
  ref: React.ForwardedRef<HTMLButtonElement>,
) {
  const [internal, setInternal] = useState<T>(defaultValue ?? options[0]?.value);
  const isControlled = valueProp !== undefined;
  const current = isControlled ? valueProp! : internal;

  const opt = options.find((o) => o.value === current) ?? options[0];

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const idx = options.findIndex((o) => o.value === current);
    const next = options[(idx + 1) % options.length].value;
    if (!isControlled) setInternal(next);
    onChange?.(next);
    onClick?.(e);
  };

  const button = (
    <ArtButton
      ref={ref}
      variant={variant}
      size={size}
      aria-label={opt?.tooltip}
      className={cn('art-icon-btn', opt?.color && ART_COLOR_CLASS[opt.color], className)}
      onClick={handleClick}
      {...rest}
    >
      <ArtIcon size={ICON_SIZE[size]} name={opt.icon} />
    </ArtButton>
  );

  if (!opt?.tooltip) return button;
  return <ArtTooltip label={opt.tooltip}>{button}</ArtTooltip>;
}

// forwardRef doesn't play well with generics — cast via a typed const
const ArtIconCycle = forwardRef(ArtIconCycleInner) as <T extends string = string>(
  props: ArtIconCycleProps<T> & { ref?: React.ForwardedRef<HTMLButtonElement> },
) => React.ReactElement;

(ArtIconCycle as React.FC).displayName = 'ArtIconCycle';

export default ArtIconCycle;
export { ArtIconCycle };
export type { ArtIconCycleProps };

'use client';

import React, { type InputHTMLAttributes } from 'react';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtSliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'size'> {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** 'md' = default track height, 'sm' = thinner. Default: 'md' */
  size?: 'sm' | 'md';
  color?: ArtColor;
  readOnly?: boolean;
}

const ArtSlider = ({ value, min = 0, max = 1, onChange, size = 'md', color, readOnly = false, className, style, ...rest }: ArtSliderProps) => {
  // Drives the webkit track fill (Firefox uses native ::-moz-range-progress).
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step="any"
      value={value}
      onChange={(e) => { if (!readOnly) onChange(Number(e.target.value)); }}
      tabIndex={readOnly ? -1 : undefined}
      className={cn('art-slider', `art-slider--${size}`, color && ART_COLOR_CLASS[color], readOnly && 'art-slider--readonly', className)}
      style={{ '--art-slider-pct': `${pct}%`, ...style } as React.CSSProperties}
      {...rest}
    />
  );
};

ArtSlider.displayName = 'ArtSlider';
export default ArtSlider;
export { ArtSlider };
export type { ArtSliderProps };

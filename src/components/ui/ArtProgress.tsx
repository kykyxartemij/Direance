'use client';

import { type ProgressHTMLAttributes } from 'react';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtProgressProps extends Omit<ProgressHTMLAttributes<HTMLProgressElement>, 'value' | 'max'> {
  /** Normalized 0–1, or use min/max for a custom range */
  value: number;
  min?: number;
  max?: number;
  /** 'md' = default height, 'sm' = thinner. Default: 'md' */
  size?: 'sm' | 'md';
  color?: ArtColor;
}

const ArtProgress = ({ value, min = 0, max = 1, size = 'md', color, className, ...rest }: ArtProgressProps) => {
  // Native <progress> has no min, so shift the range to start at 0.
  const span = max - min;
  return (
    <progress
      value={Math.max(0, Math.min(span, value - min))}
      max={span}
      className={cn('art-progress', `art-progress--${size}`, color && ART_COLOR_CLASS[color], className)}
      {...rest}
    />
  );
};

ArtProgress.displayName = 'ArtProgress';
export default ArtProgress;
export { ArtProgress };
export type { ArtProgressProps };

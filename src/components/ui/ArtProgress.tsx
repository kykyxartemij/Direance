'use client';

import { type HTMLAttributes } from 'react';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** Normalized 0–1, or use min/max for a custom range */
  value: number;
  min?: number;
  max?: number;
  /** 'md' = default height, 'sm' = thinner (good for video bars). Default: 'md' */
  size?: 'sm' | 'md';
  color?: ArtColor;
}

const ArtProgress = ({
  value,
  min = 0,
  max = 1,
  size = 'md',
  color,
  className,
  ...rest
}: ArtProgressProps) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className={cn('art-progress', `art-progress--${size}`, color && ART_COLOR_CLASS[color], className)}
      {...rest}
    >
      <div className="art-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
};

ArtProgress.displayName = 'ArtProgress';
export default ArtProgress;
export { ArtProgress };
export type { ArtProgressProps };

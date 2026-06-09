'use client';

import { type HTMLAttributes } from 'react';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtLoadingBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Normalized 0–1 fill. Omit to let CSS drive the fill (animated/indeterminate). */
  value?: number;
  size?: 'sm' | 'md';
  color?: ArtColor;
}

// Div+fill bar for animated/indeterminate fills (e.g. snackbar countdown). For a
// plain determinate value/max bar use ArtProgress (native <progress>).
const ArtLoadingBar = ({ value, size = 'md', color, className, ...rest }: ArtLoadingBarProps) => {
  const pct = value === undefined ? undefined : Math.max(0, Math.min(100, value * 100));
  return (
    <div
      className={cn('art-loading-bar', `art-loading-bar--${size}`, color && ART_COLOR_CLASS[color], className)}
      {...rest}
    >
      <div className="art-loading-bar-fill" style={pct === undefined ? undefined : { width: `${pct}%` }} />
    </div>
  );
};

ArtLoadingBar.displayName = 'ArtLoadingBar';
export default ArtLoadingBar;
export { ArtLoadingBar };
export type { ArtLoadingBarProps };

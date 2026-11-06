'use client';

import { type HTMLAttributes } from 'react';
import { cn } from './art.utils';

// CSS-driven fill (e.g. snackbar countdown). For a plain value/max bar use ArtProgress.
const ArtLoadingBar = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('art-loading-bar', className)} {...rest}>
    <div className="art-loading-bar-fill" />
  </div>
);

ArtLoadingBar.displayName = 'ArtLoadingBar';
export default ArtLoadingBar;
export { ArtLoadingBar };

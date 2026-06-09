'use client';

import { type ReactNode } from 'react';
import { cn } from './art.utils';
import { initTooltipSingleton } from './artTooltipSingleton';

initTooltipSingleton();

interface ArtTooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

const ArtTooltip = ({ label, children, className }: ArtTooltipProps) => {
  return (
    <span className={cn('inline-flex', className)} data-tooltip={label}>
      {children}
    </span>
  );
};

ArtTooltip.displayName = 'ArtTooltip';

export default ArtTooltip;
export { ArtTooltip };

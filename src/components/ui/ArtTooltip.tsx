'use client';

import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './art.utils';

interface ArtTooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

const ArtTooltip = ({ label, children, className }: ArtTooltipProps) => {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    const tooltip = tooltipRef.current;
    const wrapper = wrapperRef.current;
    if (!tooltip || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    tooltip.style.top = `${rect.top}px`;
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '1';
  };

  const handleMouseLeave = () => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    tooltip.style.visibility = 'hidden';
    tooltip.style.opacity = '0';
  };

  return (
    <span
      ref={wrapperRef}
      className={cn('inline-flex', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {createPortal(
        <span
          ref={tooltipRef}
          className="art-tooltip"
          role="tooltip"
          style={{
            position: 'fixed',
            visibility: 'hidden',
            opacity: '0',
            transform: 'translate(-50%, calc(-100% - 6px))',
          }}
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
};

ArtTooltip.displayName = 'ArtTooltip';

export default ArtTooltip;
export { ArtTooltip };

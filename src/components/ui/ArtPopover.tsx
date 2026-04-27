'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredPanel } from './art.hooks';
import { cn } from './art.utils';
import type { ReactNode } from 'react';

// ==== Types ====

interface ArtPopoverProps {
  /** The element that opens/closes the popover on click */
  trigger: ReactNode;
  children: ReactNode;
  /** Which side of the trigger to open on. Default: 'bottom' */
  placement?: 'top' | 'bottom';
  /** When true, the popover stretches to match the trigger's width. Default: false */
  trackWidth?: boolean;
  className?: string;
}

// ==== Component ====

function ArtPopover({ trigger, children, placement = 'bottom', trackWidth = false, className }: ArtPopoverProps) {
  const { triggerRef, panelRef, open, hide, toggle } =
    useAnchoredPanel<HTMLSpanElement, HTMLDivElement>({ placement, trackWidth });

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, hide]);

  return (
    <>
      <span ref={triggerRef} style={{ display: 'inline-flex' }} onClick={toggle}>
        {trigger}
      </span>

      {open && createPortal(
        <div
          ref={panelRef}
          className={cn('art-popover', className)}
          style={{ zIndex: 'var(--z-anchor)' as unknown as number }}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}

ArtPopover.displayName = 'ArtPopover';
export default ArtPopover;
export { ArtPopover };
export type { ArtPopoverProps };

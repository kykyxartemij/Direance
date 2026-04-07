'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './art.utils';

// ==== Types ====

interface ArtBaseCollapseProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

// ==== Helpers ====

/** Must match the CSS transition duration on .art-collapse */
const TRANSITION_MS = 220;

// ==== Component ====

/**
 * Pure animated height primitive — no trigger, no styling.
 * Animates height 0 ↔ auto via CSS grid-template-rows.
 * Switches overflow to visible after the open animation so absolutely-positioned
 * children (ComboBox/Select dropdowns) are not clipped.
 * Unmounts children after the close animation completes to avoid rendering
 * off-screen subtrees (dropdowns, data tables, etc.) while collapsed.
 *
 * Use this when you want full control over the trigger.
 * Use ArtCollapse for the batteries-included version with a built-in trigger header.
 */
const ArtBaseCollapse = ({ open, children, className }: ArtBaseCollapseProps) => {
  // keepMounted persists through the close animation so children don't vanish mid-transition.
  // We never set it to true inside an effect — when open is true, `open || keepMounted`
  // already renders children regardless of keepMounted's value.
  const [keepMounted, setKeepMounted] = useState(open);
  const [overflowVisible, setOverflowVisible] = useState(open);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overflowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (overflowTimerRef.current) clearTimeout(overflowTimerRef.current);
    if (open) {
      timerRef.current = setTimeout(() => setOverflowVisible(true), TRANSITION_MS);
    } else {
      overflowTimerRef.current = setTimeout(() => setOverflowVisible(false), 0);
      timerRef.current = setTimeout(() => setKeepMounted(false), TRANSITION_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (overflowTimerRef.current) clearTimeout(overflowTimerRef.current);
    };
  }, [open]);

  return (
    <div
      className={cn('art-collapse', open && 'art-collapse--open', className)}
      aria-hidden={!open}
    >
      <div
        className="art-collapse-inner"
        style={{ overflow: overflowVisible ? 'visible' : 'hidden' }}
      >
        {(open || keepMounted) && children}
      </div>
    </div>
  );
};

ArtBaseCollapse.displayName = 'ArtBaseCollapse';
export default ArtBaseCollapse;
export { ArtBaseCollapse };
export type { ArtBaseCollapseProps };

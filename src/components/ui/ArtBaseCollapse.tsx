'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './art.utils';

// ==== Types ====

interface ArtBaseCollapseProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

// ==== Component ====

const ArtBaseCollapse = ({ open, children, className }: ArtBaseCollapseProps) => {
  const [mounted, setMounted] = useState(false);
  const [overflowVisible, setOverflowVisible] = useState(false);
  const initialOpenRef = useRef(open);

  // Render-time sync: React immediately re-renders when setState is called during render.
  if (open && !mounted) setMounted(true);
  if (!open && overflowVisible) setOverflowVisible(false);

  // On mount, if already open, set overflow visible — no animation ran so onTransitionEnd won't fire.
  useLayoutEffect(() => {
    if (initialOpenRef.current) setOverflowVisible(true);
  }, []);

  return (
    <div
      className={cn('art-collapse', open && 'art-collapse--open', className)}
      aria-hidden={!open}
    >
      <div
        className="art-collapse-inner"
        style={{ overflow: overflowVisible ? 'visible' : 'hidden' }}
        onTransitionEnd={(e) => {
          if (e.target !== e.currentTarget) return;
          if (!open) setMounted(false);
          else setOverflowVisible(true);
        }}
      >
        {(open || mounted) && children}
      </div>
    </div>
  );
};

ArtBaseCollapse.displayName = 'ArtBaseCollapse';
export default ArtBaseCollapse;
export { ArtBaseCollapse };
export type { ArtBaseCollapseProps };

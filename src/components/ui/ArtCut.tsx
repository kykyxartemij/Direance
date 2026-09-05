'use client';

import React, { type ReactNode } from 'react';

// ==== ArtCut ====
// Hard-constrains content to exactly `width` and/or `height`. Sets min/max on each axis
// so nothing — layout, children, or overflow — can push past the boundary.

interface ArtCutProps {
  width?: number | string;
  height?: number | string;
  /** Truncate text with ellipsis instead of hard-clipping (width axis only) */
  text?: boolean;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// ArtTooltip's singleton reads data-tooltip on native mouseover (see artTooltipSingleton.ts) —
// checking scrollWidth vs clientWidth here, lazily on first hover, needs no React state/effect.
function checkTruncatedOnHover(e: React.MouseEvent<HTMLSpanElement>) {
  const el = e.currentTarget;
  if (el.dataset.tooltipChecked) return;
  el.dataset.tooltipChecked = 'true';
  if (el.scrollWidth > el.clientWidth) el.dataset.tooltip = el.textContent ?? '';
}

export default function ArtCut({ width, height, text, children, className, style }: ArtCutProps) {
  const ellipsisMode = !!(text && width);

  // Ellipsis must live on an inner block-level span, not a flex container itself —
  // flex items ignore text-overflow (min-width:auto blocks shrinking).
  const content = ellipsisMode
    ? (
      <span
        onMouseEnter={checkTruncatedOnHover}
        style={{ display: 'block', width: '100%', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
      >
        {children}
      </span>
    )
    : children;

  return (
    <div
      className={`art-cut${className ? ` ${className}` : ''}`}
      style={{
        ...style,
        ...(width  ? { width,  minWidth:  width,  maxWidth:  width  } : {}),
        ...(height ? { minHeight: height, maxHeight: height, display: 'flex', alignItems: 'center', overflowY: 'hidden' } : {}),
        ...(width  ? { overflow: 'hidden' } : {}),
      }}
    >
      {content}
    </div>
  );
}

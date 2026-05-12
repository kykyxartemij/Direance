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

export default function ArtCut({ width, height, text, children, className, style }: ArtCutProps) {
  return (
    <div
      className={`art-cut${className ? ` ${className}` : ''}`}
      style={{
        ...style,
        ...(width  ? { width,  minWidth:  width,  maxWidth:  width  } : {}),
        ...(height ? { minHeight: height, maxHeight: height, display: 'flex', alignItems: 'center', overflowY: 'hidden' } : {}),
        ...(width  ? { overflow: 'hidden' } : {}),
        ...(text && width ? { whiteSpace: 'nowrap', textOverflow: 'ellipsis' } : {}),
      }}
    >
      {children}
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';

// Wraps the caller's renderRow prop in its own component so React keeps row state
// stable across re-renders (avoids no-render-in-render remounts).
export function RenderedRow({ render, row, index }: { render: (row: unknown, index: number) => ReactNode; row: unknown; index: number }) {
  return <>{render(row, index)}</>;
}

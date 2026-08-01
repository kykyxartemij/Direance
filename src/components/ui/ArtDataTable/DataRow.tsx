'use client';

import React from 'react';
import ArtCut from '../ArtCut';
import { cn } from '../art.utils';
import { FILLER_KEY, type ProcessedColumn } from './types';

export interface InternalRowProps {
  row: unknown;
  columns: ProcessedColumn<unknown>[];
  index: number;
  onRowClick?: (row: unknown, index: number) => void;
  isClickable: boolean;
  rowClassName?: string;
  rowHeight?: number;
}

export const DataRow = React.memo(function DataRow({
  row,
  columns,
  index,
  onRowClick,
  isClickable,
  rowClassName,
  rowHeight,
}: InternalRowProps) {
  const cellContent = (col: ProcessedColumn<unknown>) => {
    const raw = col.render
      ? col.render(row, index)
      : String((row as Record<string, unknown>)[col.key] ?? '');
    if (col._cutWidth || rowHeight) {
      return (
        <ArtCut
          width={col._cutWidth}
          height={rowHeight}
          text={!col.render && !!col._cutWidth}
          style={col._isLast ? { justifyContent: 'flex-end' } : undefined}
        >
          {raw}
        </ArtCut>
      );
    }
    return raw;
  };

  const handleActivate = () => onRowClick?.(row, index);

  return (
    <tr
      className={cn('art-data-tr', isClickable && 'art-data-tr--clickable', rowClassName)}
      onClick={isClickable ? handleActivate : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActivate(); } } : undefined}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? 'button' : undefined}
    >
      {columns.map((col) => {
        if (col._isFiller) return <td key={FILLER_KEY} className="art-data-filler-col" aria-label="spacer" />;
        const isLeft  = col.sticky === true || col.sticky === 'left';
        const isRight = col.sticky === 'right';
        return (
          <td
            key={col.key}
            className={cn(
              'art-data-td',
              isLeft  && 'art-data-sticky',
              isRight && 'art-data-sticky-right',
            )}
            style={{
              ...(isLeft  ? { left:  col._stickyLeft       } : {}),
              ...(isRight ? { right: col._stickyRight ?? 0 } : {}),
            }}
          >
            {cellContent(col)}
          </td>
        );
      })}
    </tr>
  );
});

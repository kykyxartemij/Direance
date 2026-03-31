'use client';

import React, { useMemo } from 'react';
import ArtIcon from './ArtIcon';
import ArtSkeleton from './ArtSkeleton';
import { cn } from './art.utils';
import { type ReactNode } from 'react';

// ==== Types ====

export interface ArtColumn<T> {
  /** Key used to read `row[key]` when no `render` is provided. Also used as the sort key. */
  key: string;
  label: string;
  /**
   * Pin column to viewport edge during horizontal scroll.
   * true / 'left'  → pin to the left edge (auto-computes left offset from preceding sticky-left widths)
   * 'right'        → pin to the right edge (auto-computes right offset from following sticky-right widths)
   */
  sticky?: boolean | 'left' | 'right';
  sortable?: boolean;
  /** Clip overflowing text with ellipsis. Works reliably with table-layout: fixed. */
  truncate?: boolean;
  /**
   * Pixel width used by the <col> element (table-layout: fixed).
   * Keeps skeleton rows and data rows at the same width — no layout shift on load/page change.
   */
  width?: number | string;
  render?: (row: T, index: number) => ReactNode;
  /**
   * Set `true` to auto-shimmer this column during loading.
   * ArtDataTable calls `render` with a blank row and wraps the output in `<ArtSkeleton wrap>`,
   * so the shimmer exactly matches the component's natural height — no hardcoded size needed.
   *
   * Rule: use `width` (hard-cut) OR `renderLoading: true` (auto-sized) — not both.
   *
   *   { key: 'status', render: (row) => <ArtBadge>{row.status}</ArtBadge>, renderLoading: true }
   *
   * Falls back to a plain shimmer bar if `render` throws with a blank row.
   */
  renderLoading?: boolean;
}

// ==== Internal helpers ====

/** Parses a column width to pixels if possible, 0 otherwise */
function colWidthPx(w: number | string | undefined): number {
  if (typeof w === 'number') return w;
  if (typeof w === 'string' && w.endsWith('px')) return parseFloat(w);
  return 0;
}

/** ArtColumn enriched with pre-computed sticky offsets and an optional filler flag */
type ProcessedColumn<T> = ArtColumn<T> & {
  _stickyLeft: number;
  _stickyRight?: number;
  /** True for the virtual filler column — renders an unstyled cell to extend row dividers to the right edge */
  _isFiller?: boolean;
};

const FILLER_KEY = '__art_filler__';

interface ArtDataTableProps<T> {
  columns: ArtColumn<T>[];
  data: T[];
  loading?: boolean;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  onRowClick?: (row: T, index: number) => void;
  emptyMessage?: string;
  /** Provide a stable key per row to avoid unnecessary re-renders */
  rowKey?: (row: T, index: number) => string | number;
  /**
   * Rows per page. Drives both pagination display and skeleton row count during loading —
   * the same value the BE uses for `take` / `pageSize`. Default: 5.
   */
  pageSize?: number;
  className?: string;
}

// ==== Internal memoised row ====
// Typed as `unknown` so React.memo works — type safety enforced at the ArtDataTable call site.

interface InternalRowProps {
  row: unknown;
  columns: ProcessedColumn<unknown>[];
  index: number;
  onRowClick?: (row: unknown, index: number) => void;
  isClickable: boolean;
}

const DataRow = React.memo(function DataRow({
  row,
  columns,
  index,
  onRowClick,
  isClickable,
}: InternalRowProps) {
  return (
    <tr
      className={cn('art-data-tr', isClickable && 'art-data-tr--clickable')}
      onClick={isClickable ? () => onRowClick?.(row, index) : undefined}
    >
      {columns.map((col) => {
        if (col._isFiller) return <td key={FILLER_KEY} className="art-data-filler-col" />;
        const isLeft  = col.sticky === true || col.sticky === 'left';
        const isRight = col.sticky === 'right';
        return (
          <td
            key={col.key}
            className={cn(
              'art-data-td',
              isLeft  && 'art-data-sticky',
              isRight && 'art-data-sticky-right',
              col.truncate && 'art-data-td--truncate',
            )}
            style={{
              ...(isLeft  ? { left:  col._stickyLeft          } : {}),
              ...(isRight ? { right: col._stickyRight ?? 0    } : {}),
            }}
          >
            {col.render
              ? col.render(row, index)
              : String((row as Record<string, unknown>)[col.key] ?? '')}
          </td>
        );
      })}
    </tr>
  );
});

// ==== Component ====

function ArtDataTable<T>({
  columns,
  data,
  loading,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  emptyMessage = 'No data',
  rowKey,
  pageSize = 5,
  className,
}: ArtDataTableProps<T>) {
  // ==== Pre-compute sticky offsets + insert filler ====
  // Left-sticky: forward pass — sum widths of preceding left-sticky columns.
  // Right-sticky: reverse pass — sum widths of following right-sticky columns.
  // Filler: a zero-width virtual column inserted between the last non-right-sticky
  //   and the first right-sticky column. Its <col> has no width, so it absorbs all
  //   remaining table width — extending border-bottom lines to the right edge and
  //   eliminating the "row divider cut short" visual artifact.

  const processedColumns = useMemo((): ProcessedColumn<T>[] => {
    // Forward pass: left offsets — reduce avoids mutating an outer variable (react-hooks/immutability)
    const [withLeft] = columns.reduce<[ProcessedColumn<T>[], number]>(
      ([cols, off], col) => {
        const isLeft = col.sticky === true || col.sticky === 'left';
        return isLeft
          ? [[...cols, { ...col, _stickyLeft: off }], off + colWidthPx(col.width)]
          : [[...cols, { ...col, _stickyLeft: 0 }], off];
      },
      [[], 0],
    );

    // Reverse pass: right offsets
    const [computed] = [...withLeft].reverse().reduce<[ProcessedColumn<T>[], number]>(
      ([cols, off], col) => col.sticky === 'right'
        ? [[...cols, { ...col, _stickyRight: off }], off + colWidthPx(col.width)]
        : [[...cols, col], off],
      [[], 0],
    );
    computed.reverse();

    // Split and insert filler between non-right-sticky and right-sticky columns
    const nonRight  = computed.filter(col => col.sticky !== 'right');
    const rightCols = computed.filter(col => col.sticky === 'right');
    const filler: ProcessedColumn<T> = { key: FILLER_KEY, label: '', _stickyLeft: 0, _isFiller: true } as ProcessedColumn<T>;

    return [...nonRight, filler, ...rightCols];
  }, [columns]);

  // min-width from declared column widths (excluding the filler) so the table
  // never collapses narrower than the sum of all column widths.
  const tableMinWidth = useMemo(() => {
    const sum = columns.reduce((s, col) => s + colWidthPx(col.width), 0);
    return sum > 0 ? sum : undefined;
  }, [columns]);

  // ==== Sort handler ====

  const handleSort = (col: ArtColumn<T>) => {
    if (!col.sortable || !onSort) return;
    const newDir = sortKey === col.key && sortDir === 'asc' ? 'desc' : 'asc';
    onSort(col.key, newDir);
  };

  // ==== Render ====

  return (
    <div className={cn('art-data-table-wrapper', className)}>
      <div className="art-data-table-scroll art-scrollable">
        <table
          className="art-data-table"
          style={tableMinWidth ? { minWidth: tableMinWidth } : undefined}
        >
          <colgroup>
            {/* text columns: min-width keeps them from collapsing; component columns (renderLoading:true) size to ghost content */}
            {processedColumns.map((col) => (
              <col key={col.key} style={!col._isFiller && col.width ? { minWidth: col.width } : undefined} />
            ))}
          </colgroup>

          <thead>
            <tr>
              {processedColumns.map((col) => {
                if (col._isFiller) return <th key={FILLER_KEY} className="art-data-th art-data-filler-col" />;
                const isLeft  = col.sticky === true || col.sticky === 'left';
                const isRight = col.sticky === 'right';
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'art-data-th',
                      isLeft  && 'art-data-sticky',
                      isRight && 'art-data-sticky-right',
                      col.sortable && 'art-data-th--sortable',
                    )}
                    style={{
                      ...(isLeft  ? { left:  col._stickyLeft          } : {}),
                      ...(isRight ? { right: col._stickyRight ?? 0    } : {}),
                    }}
                    onClick={() => handleSort(col)}
                  >
                    <span className="art-data-th-inner">
                      {col.label}
                      {col.sortable && (
                        <ArtIcon
                          name="ChevronDown"
                          size={12}
                          className={cn(
                            'art-data-sort-icon',
                            sortKey === col.key && 'art-data-sort-icon--active',
                            sortKey === col.key && sortDir === 'asc' && 'art-data-sort-icon--asc',
                          )}
                        />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: pageSize }, (_, i) => (
                <tr key={i}>
                  {processedColumns.map((col) =>
                    col._isFiller ? (
                      <td key={FILLER_KEY} className="art-data-filler-col" />
                    ) : (
                      <td key={col.key} className="art-data-td">
                        {col.renderLoading && col.render
                          ? (() => {
                              try {
                                return <ArtSkeleton wrap>{col.render({} as T, i)}</ArtSkeleton>;
                              } catch {
                                return <ArtSkeleton style={{ height: 14, borderRadius: 4 }} />;
                              }
                            })()
                          : <ArtSkeleton style={{ height: 14, borderRadius: 4 }} />}
                      </td>
                    )
                  )}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={processedColumns.length} className="art-data-empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <DataRow
                  key={rowKey ? rowKey(row, index) : index}
                  row={row as unknown}
                  columns={processedColumns as ProcessedColumn<unknown>[]}
                  index={index}
                  onRowClick={onRowClick as InternalRowProps['onRowClick']}
                  isClickable={!!onRowClick}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

ArtDataTable.displayName = 'ArtDataTable';
export default ArtDataTable;
export { ArtDataTable };
export type { ArtDataTableProps };

'use client';

import React, { useMemo } from 'react';
import ArtIcon from './ArtIcon';
import ArtSkeleton from './ArtSkeleton';
import ArtCut from './ArtCut';
import { cn } from './art.utils';
import { type ReactNode } from 'react';

// ==== Types ====

export interface ArtColumn<T> {
  key: string;
  label: string;
  /** true / 'left' → pin left edge. 'right' → pin right edge. Pixel string widths required for stacking offsets. */
  sticky?: boolean | 'left' | 'right';
  sortable?: boolean;
  render?: (row: T, index: number) => ReactNode;
  /**
   * width: number → percentage mode (÷10 = %). width: 300 = 30%.
   *   Last column auto-gets remaining % (100 - sum of others). Sum > 100 → horizontal scroll.
   * width: string → literal CSS value ("200px") for sticky-offset columns.
   * renderLoading: show shimmer bar during loading.
   */
  sizing: {
    width?: number | string;
    renderLoading?: boolean;
  };
}

// ==== Internal helpers ====

function colWidthPx(w: number | string | undefined): number {
  if (typeof w === 'string' && w.endsWith('px')) return parseFloat(w);
  return 0;
}

function colWidthAsPct(w: number | string | undefined): number {
  return typeof w === 'number' ? w / 10 : 0;
}

type ProcessedColumn<T> = ArtColumn<T> & {
  _stickyLeft: number;
  _stickyRight?: number;
  _isFiller?: boolean;
  _cutWidth?: string | number;
  _isLast?: boolean;
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
  rowKey?: (row: T, index: number) => string | number;
  rowClassName?: (row: T, index: number) => string | undefined;
  /** Drives skeleton row count. Default: 5. */
  pageSize?: number;
  /** Fixed height per row (px). Applied via ArtCut so both skeleton and data rows match. */
  rowHeight?: number;
  className?: string;
  /**
   * Custom row renderer. ArtDataTable owns wrapper, scroll, colgroup, thead.
   * Loading and empty states still managed by ArtDataTable.
   */
  renderRow?: (row: T, index: number) => ReactNode;
}

// ==== Internal row (memoised) ====

interface InternalRowProps {
  row: unknown;
  columns: ProcessedColumn<unknown>[];
  index: number;
  onRowClick?: (row: unknown, index: number) => void;
  isClickable: boolean;
  rowClassName?: string;
  rowHeight?: number;
}

const DataRow = React.memo(function DataRow({
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

  return (
    <tr
      className={cn('art-data-tr', isClickable && 'art-data-tr--clickable', rowClassName)}
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

// ==== Skeleton cell ====

function renderSkeletonCell(col: ProcessedColumn<unknown>): ReactNode {
  const content = col.render ? col.render({} as unknown, 0) : <span>&nbsp;</span>;
  return (
    <ArtCut width={col._cutWidth ?? '100%'}>
      <ArtSkeleton wrap>{content}</ArtSkeleton>
    </ArtCut>
  );
}

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
  rowClassName,
  pageSize = 5,
  rowHeight,
  className,
  renderRow,
}: ArtDataTableProps<T>) {
  const processedColumns = useMemo((): ProcessedColumn<T>[] => {
    const [withLeft] = columns.reduce<[ProcessedColumn<T>[], number]>(
      ([cols, off], col) => {
        const isLeft = col.sticky === true || col.sticky === 'left';
        return isLeft
          ? [[...cols, { ...col, _stickyLeft: off }], off + colWidthPx(col.sizing.width)]
          : [[...cols, { ...col, _stickyLeft: 0 }], off];
      },
      [[], 0],
    );

    const [computed] = [...withLeft].reverse().reduce<[ProcessedColumn<T>[], number]>(
      ([cols, off], col) => col.sticky === 'right'
        ? [[...cols, { ...col, _stickyRight: off }], off + colWidthPx(col.sizing.width)]
        : [[...cols, col], off],
      [[], 0],
    );
    computed.reverse();

    const pctMode = columns.some(col => typeof col.sizing.width === 'number');
    const withCut = computed.map((col, i) => ({
      ...col,
      _cutWidth: pctMode
        ? (col.sizing.width !== undefined ? '100%' : undefined)
        : col.sizing.width,
      _isLast: i === computed.length - 1,
    }));

    const rightCols = withCut.filter(col => col.sticky === 'right');
    const nonRight  = withCut.filter(col => col.sticky !== 'right');
    const filler: ProcessedColumn<T> = { key: FILLER_KEY, label: '', _stickyLeft: 0, _isFiller: true, sizing: {} } as ProcessedColumn<T>;

    if (rightCols.length > 0) return [...nonRight, filler, ...rightCols];
    const last = nonRight[nonRight.length - 1];
    const body = nonRight.slice(0, -1);
    return last ? [...body, filler, last] : [...body, filler];
  }, [columns]);

  const { tableMinWidth, colPercents } = useMemo(() => {
    const usingPct = columns.some(col => typeof col.sizing.width === 'number');
    if (usingPct) {
      const nonLast = columns.slice(0, -1);
      const last    = columns[columns.length - 1];
      const percents = new Map<string, number>();
      const nonLastSum = nonLast.reduce((s, col) => {
        const pct = colWidthAsPct(col.sizing.width);
        if (pct > 0) percents.set(col.key, pct); // skip 0 — column stays flexible
        return s + pct;
      }, 0);
      if (last) {
        const lastPct = Math.max(0, 100 - nonLastSum);
        percents.set(last.key, lastPct);
      }
      const totalPct = Math.max(100, nonLastSum + Math.max(0, 100 - nonLastSum));
      return {
        tableMinWidth: totalPct > 100 ? `${totalPct}%` : undefined,
        colPercents: percents,
      };
    }
    const pxSum = columns.reduce((s, col) => s + colWidthPx(col.sizing.width), 0);
    return { tableMinWidth: pxSum > 0 ? pxSum : undefined, colPercents: new Map<string, number>() };
  }, [columns]);

  const handleSort = (col: ArtColumn<T>) => {
    if (!col.sortable || !onSort) return;
    const newDir = sortKey === col.key && sortDir === 'asc' ? 'desc' : 'asc';
    onSort(col.key, newDir);
  };

  return (
    <div className={cn('art-data-table-wrapper', className)}>
      <div className="art-data-table-scroll art-scrollable" style={{ '--art-rows': pageSize } as React.CSSProperties}>
        <table
          className="art-data-table"
          style={tableMinWidth ? { minWidth: tableMinWidth } : undefined}
        >
          <colgroup>
            {processedColumns.map((col) => {
              if (col._isFiller) return <col key={col.key} />;
              const pct = colPercents.get(col.key);
              const w = pct !== undefined ? `${pct}%` : col.sizing.width;
              return <col key={col.key} style={w ? { width: w } : undefined} />;
            })}
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
                      ...(isLeft  ? { left:  col._stickyLeft       } : {}),
                      ...(isRight ? { right: col._stickyRight ?? 0 } : {}),
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
                        {renderSkeletonCell(col as ProcessedColumn<unknown>)}
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
            ) : renderRow ? (
              data.map((row, index) => (
                <React.Fragment key={rowKey ? rowKey(row, index) : index}>
                  {renderRow(row, index)}
                </React.Fragment>
              ))
            ) : (
              data.map((row, index) => (
                <DataRow
                  key={rowKey ? rowKey(row, index) : index}
                  row={row as unknown}
                  columns={processedColumns as ProcessedColumn<unknown>[]}
                  index={index}
                  onRowClick={onRowClick as InternalRowProps['onRowClick']}
                  isClickable={!!onRowClick}
                  rowClassName={rowClassName?.(row, index)}
                  rowHeight={rowHeight}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==== Row primitives ====
// Use these inside renderRow so callers never depend on internal CSS class names.

export function ArtDataTr({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('art-data-tr', className)} {...props}>{children}</tr>;
}

export function ArtDataTd({
  children,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('art-data-td', className)} {...props}>{children}</td>;
}

ArtDataTable.displayName = 'ArtDataTable';
export default ArtDataTable;
export { ArtDataTable };
export type { ArtDataTableProps };

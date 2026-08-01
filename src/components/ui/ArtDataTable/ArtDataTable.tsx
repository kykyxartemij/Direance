'use client';

import React, { useMemo, type ReactNode } from 'react';
import ArtIcon from '../ArtIcon';
import { cn } from '../art.utils';
import { DataRow, type InternalRowProps } from './DataRow';
import { SkeletonCell } from './SkeletonCell';
import { RenderedRow } from './RenderedRow';
import { FILLER_KEY, colWidthPx, colWidthAsPct, type ArtColumn, type ArtDataTableProps, type ProcessedColumn } from './types';

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
  lastColRightAlign = true,
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
    if (!lastColRightAlign) return [...nonRight, filler];
    const last = nonRight[nonRight.length - 1];
    const body = nonRight.slice(0, -1);
    return last ? [...body, filler, last] : [...body, filler];
  }, [columns, lastColRightAlign]);

  const { tableMinWidth, colPercents } = useMemo(() => {
    const usingPct = columns.some(col => typeof col.sizing.width === 'number');
    if (usingPct) {
      const nonLast = columns.slice(0, -1);
      const last    = columns[columns.length - 1];
      const percents = new Map<string, number>();
      const nonLastSum = nonLast.reduce((s, col) => {
        const pct = colWidthAsPct(col.sizing.width);
        if (pct > 0) percents.set(col.key, pct);
        return s + pct;
      }, 0);

      const allOthersConstrained = nonLast.every(col => typeof col.sizing.width === 'number' && col.sizing.width > 0);
      const lastExplicit = typeof last?.sizing.width === 'number' && last.sizing.width > 0;

      if (last && allOthersConstrained && !lastExplicit) {
        const lastPct = Math.max(0, 100 - nonLastSum);
        percents.set(last.key, lastPct);
      } else if (last && lastExplicit) {
        percents.set(last.key, colWidthAsPct(last.sizing.width));
      }

      const fullyExplicit = allOthersConstrained && lastExplicit;
      const explicitSum = nonLastSum + (lastExplicit ? colWidthAsPct(last.sizing.width) : 0);
      if (fullyExplicit && explicitSum > 0 && explicitSum < 100) {
        const scale = 100 / explicitSum;
        for (const [key, pct] of percents) percents.set(key, pct * scale);
      }

      const totalPct = explicitSum;
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
      <div
        className="art-data-table-scroll art-scrollable"
        style={{ '--art-rows': pageSize, '--art-row-height': rowHeight ? `${rowHeight}px` : undefined } as React.CSSProperties}
      >
        <table
          className="art-data-table"
          style={tableMinWidth ? { minWidth: tableMinWidth } : undefined}
        >
          <colgroup>
            {processedColumns.map((col) => {
              if (col._isFiller) {
                // Pin to 0 when pct widths already fill 100% so the filler
                // doesn't render as a visible empty cell on the right.
                const pctSum = [...colPercents.values()].reduce((s, p) => s + p, 0);
                const fillerW = pctSum >= 99.99 ? 0 : undefined;
                return <col key={col.key} style={fillerW !== undefined ? { width: fillerW } : undefined} />;
              }
              const pct = colPercents.get(col.key);
              const w = pct !== undefined ? `${pct}%` : col.sizing.width;
              return <col key={col.key} style={w ? { width: w } : undefined} />;
            })}
          </colgroup>

          <thead>
            <tr>
              {processedColumns.map((col) => {
                if (col._isFiller) return <th key={FILLER_KEY} className="art-data-th art-data-filler-col" aria-label="spacer" />;
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
                    onKeyDown={col.sortable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col); } } : undefined}
                    tabIndex={col.sortable ? 0 : undefined}
                    role={col.sortable ? 'button' : undefined}
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
                      <td key={FILLER_KEY} className="art-data-filler-col" aria-label="spacer" />
                    ) : (
                      <td key={col.key} className="art-data-td">
                        <SkeletonCell col={col as ProcessedColumn<unknown>} />
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
                <RenderedRow
                  key={rowKey ? rowKey(row, index) : index}
                  render={renderRow as (row: unknown, index: number) => ReactNode}
                  row={row as unknown}
                  index={index}
                />
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

ArtDataTable.displayName = 'ArtDataTable';
export default ArtDataTable;
export { ArtDataTable };

import type { ReactNode } from 'react';

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

export type ProcessedColumn<T> = ArtColumn<T> & {
  _stickyLeft: number;
  _stickyRight?: number;
  _isFiller?: boolean;
  _cutWidth?: string | number;
  _isLast?: boolean;
};

export const FILLER_KEY = '__art_filler__';

export interface ArtDataTableProps<T> {
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
  /**
   * When true (default): filler col inserted before the last column so the
   * last column sits flush against the right edge (e.g. action columns).
   * When false: columns flow left-to-right, filler appended at the end —
   * use this for data tables where the natural last column shouldn't be
   * forced to the right edge.
   */
  lastColRightAlign?: boolean;
}

export function colWidthPx(w: number | string | undefined): number {
  if (typeof w === 'string' && w.endsWith('px')) return parseFloat(w);
  return 0;
}

export function colWidthAsPct(w: number | string | undefined): number {
  return typeof w === 'number' ? w / 10 : 0;
}

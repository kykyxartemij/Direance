'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import ArtDataFilters from './ArtDataFilters';
import ArtDataTable, { type ArtColumn } from './ArtDataTable';
import ArtPagination from './ArtPagination';
import { cn } from './art.utils';

// ==== Types ====

interface ArtDataProps<T> {
  columns: ArtColumn<T>[];
  data: T[];
  loading?: boolean;

  // ==== Search ====
  searchPlaceholder?: string;
  /** Custom row-level filter fn for client-side search. Default: match any stringified value. */
  searchFilter?: (row: T, query: string) => boolean;

  // ==== Advanced filters ====
  advancedFilters?: ReactNode;
  activeFilterCount?: number;

  // ==== Pagination ====
  /** Enables pagination. Omit for no pagination (show all rows). */
  pageSize?: number;
  /** When provided, shows a rows-per-page selector in the pagination bar. */
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;

  // ==== Server-side overrides ====
  // Provide `total` to switch to server-side mode: ArtData won't filter/sort/paginate `data`
  // itself — it just fires the callbacks and renders what you pass.
  total?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (q: string) => void;
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';

  // ==== Table ====
  onRowClick?: (row: T, index: number) => void;
  emptyMessage?: string;
  rowKey?: (row: T, index: number) => string | number;

  className?: string;
}

// ==== Component ====

function ArtData<T>({
  columns,
  data,
  loading,
  searchPlaceholder,
  searchFilter,
  advancedFilters,
  activeFilterCount,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  total,
  page,
  onPageChange,
  onSearch,
  onSort,
  sortKey,
  sortDir,
  onRowClick,
  emptyMessage,
  rowKey,
  className,
}: ArtDataProps<T>) {
  // ==== Mode detection ====
  // Server-side: parent provides `total` and controls data externally.
  // Client-side: ArtData filters, sorts, and paginates `data` internally.

  const serverSide = total !== undefined;

  // ==== Client-side state ====

  const [internalSearch, setInternalSearch] = useState('');
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(pageSize ?? 10);
  const [internalSortKey, setInternalSortKey] = useState<string | undefined>(sortKey);
  const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc'>(sortDir ?? 'asc');

  // ==== Effective values ====

  const effectivePage     = serverSide ? (page ?? 1) : internalPage;
  const effectivePageSize = serverSide ? (pageSize ?? 10) : internalPageSize;
  const effectiveSortKey = serverSide ? sortKey : internalSortKey;
  const effectiveSortDir = serverSide ? (sortDir ?? 'asc') : internalSortDir;

  // ==== Client-side pipeline: filter → sort → paginate ====

  const filteredData = useMemo(() => {
    if (serverSide || !internalSearch) return data;
    const q = internalSearch.toLowerCase();
    return data.filter((row) =>
      searchFilter
        ? searchFilter(row, q)
        : Object.values(row as object).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, internalSearch, searchFilter, serverSide]);

  const sortedData = useMemo(() => {
    if (serverSide || !effectiveSortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const av = (a as Record<string, unknown>)[effectiveSortKey];
      const bv = (b as Record<string, unknown>)[effectiveSortKey];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
      return effectiveSortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, effectiveSortKey, effectiveSortDir, serverSide]);

  const pagedData = useMemo(() => {
    if (serverSide || !effectivePageSize) return sortedData;
    const start = (effectivePage - 1) * effectivePageSize;
    return sortedData.slice(start, start + effectivePageSize);
  }, [sortedData, effectivePage, effectivePageSize, serverSide]);

  // Server-side: pass total as-is (undefined hides pagination until BE confirms total).
  // Client-side: always known (sortedData.length).
  const effectiveTotal = serverSide ? total : sortedData.length;

  // ==== Callbacks ====

  const handleSearch = useCallback(
    (q: string) => {
      if (serverSide) {
        onSearch?.(q);
      } else {
        setInternalSearch(q);
        setInternalPage(1);
      }
    },
    [serverSide, onSearch],
  );

  const handlePageChange = useCallback(
    (p: number) => {
      if (serverSide) {
        onPageChange?.(p);
      } else {
        setInternalPage(p);
      }
    },
    [serverSide, onPageChange],
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      if (serverSide) {
        onPageSizeChange?.(size);
      } else {
        setInternalPageSize(size);
        setInternalPage(1);
      }
    },
    [serverSide, onPageSizeChange],
  );

  const handleSort = useCallback(
    (key: string, dir: 'asc' | 'desc') => {
      if (serverSide) {
        onSort?.(key, dir);
      } else {
        setInternalSortKey(key);
        setInternalSortDir(dir);
        setInternalPage(1);
      }
    },
    [serverSide, onSort],
  );

  // ==== Render ====

  const showFilters = searchPlaceholder !== undefined || advancedFilters !== undefined;

  return (
    <div className={cn('art-data', className)}>
      {showFilters && (
        <ArtDataFilters
          searchPlaceholder={searchPlaceholder}
          onSearch={handleSearch}
          advancedFilters={advancedFilters}
          activeFilterCount={activeFilterCount}
        />
      )}

      <ArtDataTable
        columns={columns}
        data={pagedData}
        loading={loading}
        sortKey={effectiveSortKey}
        sortDir={effectiveSortDir}
        onSort={handleSort}
        onRowClick={onRowClick}
        emptyMessage={emptyMessage}
        rowKey={rowKey}
        pageSize={effectivePageSize}
      />

      {pageSize !== undefined && (
        <ArtPagination
          page={effectivePage}
          pageSize={effectivePageSize}
          total={effectiveTotal}
          onChange={handlePageChange}
          pageSizeOptions={pageSizeOptions ?? [10, 50, 100]}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}

ArtData.displayName = 'ArtData';
export default ArtData;
export { ArtData };
export type { ArtDataProps };

// ==== Paginated response helpers ====

import { type PaginatedResponse } from '@/models/paginated-response.model';
export type { PaginatedResponse };

/**
 * FE adapter — maps a PaginatedResponse from the BE model onto ArtData props.
 * `total` is always a number (ArtData server-side mode). Use without `total` spread for client-side mode.
 *
 * Usage:
 *   <ArtData columns={...} {...createPaginatedProps(response)} onPageChange={...} />
 */
export function createPaginatedProps<T>(response: PaginatedResponse<T>) {
  return { data: response.data, total: response.total, page: response.page };
}

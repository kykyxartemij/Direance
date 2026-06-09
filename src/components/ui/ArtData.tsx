'use client';

import { useCallback, useMemo, useReducer, type ReactNode } from 'react';
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
  /** Wire to clear all advanced filters (e.g. useUrlFilters().clearFilters). Shows a clear button in the filter bar. */
  onClearFilters?: () => void;

  // ==== Pagination ====
  /** Enables pagination. Omit for no pagination (show all rows). */
  pageSize?: number;
  /** Fixed height for each skeleton row in px. Set to match real row content height. */
  rowHeight?: number;
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

// ==== Client-side state reducer ====
// One reducer instead of five useState calls — each dispatch is a single render,
// and page resets that pair with another change happen atomically.

interface ClientState {
  search: string;
  page: number;
  pageSize: number;
  sortKey?: string;
  sortDir: 'asc' | 'desc';
}

type ClientAction =
  | { type: 'search'; value: string }
  | { type: 'page'; value: number }
  | { type: 'pageSize'; value: number }
  | { type: 'sort'; key: string; dir: 'asc' | 'desc' };

function clientReducer(state: ClientState, action: ClientAction): ClientState {
  switch (action.type) {
    case 'search':   return { ...state, search: action.value, page: 1 };
    case 'page':     return { ...state, page: action.value };
    case 'pageSize': return { ...state, pageSize: action.value, page: 1 };
    case 'sort':     return { ...state, sortKey: action.key, sortDir: action.dir, page: 1 };
  }
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
  onClearFilters,
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
  rowHeight,
  className,
}: ArtDataProps<T>) {
  // ==== Mode detection ====
  // Server-side: parent provides `total` and controls data externally.
  // Client-side: ArtData filters, sorts, and paginates `data` internally.

  const serverSide = total !== undefined;

  // ==== Client-side state ====

  const [client, dispatch] = useReducer(clientReducer, undefined, () => ({
    search: '',
    page: 1,
    pageSize: pageSize ?? 10,
    sortKey: undefined,
    sortDir: 'asc' as const,
  }));

  // ==== Effective values ====

  const effectivePage     = serverSide ? (page ?? 1) : client.page;
  const effectivePageSize = serverSide ? (pageSize ?? 10) : client.pageSize;
  const effectiveSortKey = serverSide ? sortKey : client.sortKey;
  const effectiveSortDir = serverSide ? (sortDir ?? 'asc') : client.sortDir;

  // ==== Client-side pipeline: filter → sort → paginate ====

  const filteredData = useMemo(() => {
    if (serverSide || !client.search) return data;
    const q = client.search.toLowerCase();
    return data.filter((row) =>
      searchFilter
        ? searchFilter(row, q)
        : Object.values(row as object).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, client.search, searchFilter, serverSide]);

  const sortedData = useMemo(() => {
    if (serverSide || !effectiveSortKey) return filteredData;
    return filteredData.toSorted((a, b) => {
      const av = (a as Record<string, unknown>)[effectiveSortKey];
      const bv = (b as Record<string, unknown>)[effectiveSortKey];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
      return effectiveSortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, effectiveSortKey, effectiveSortDir, serverSide]);

  // Server-side: pass total as-is (undefined hides pagination until BE confirms total).
  // Client-side: always known (sortedData.length).
  const effectiveTotal = serverSide ? total : sortedData.length;

  // Clamp the page during render so a shrinking dataset never leaves us on an
  // out-of-range page. Derived (not synced via effect) — the parent's stored page
  // self-heals on the next navigation.
  const totalPages = effectivePageSize > 0 && effectiveTotal !== undefined
    ? Math.max(1, Math.ceil(effectiveTotal / effectivePageSize))
    : 1;
  const clampedPage = Math.min(Math.max(1, effectivePage), totalPages);

  const pagedData = useMemo(() => {
    if (serverSide || !effectivePageSize) return sortedData;
    const start = (clampedPage - 1) * effectivePageSize;
    return sortedData.slice(start, start + effectivePageSize);
  }, [sortedData, clampedPage, effectivePageSize, serverSide]);

  // ==== Callbacks ====

  const handleSearch = useCallback(
    (q: string) => {
      if (serverSide) onSearch?.(q);
      else dispatch({ type: 'search', value: q });
    },
    [serverSide, onSearch],
  );

  const handlePageChange = useCallback(
    (p: number) => {
      if (serverSide) onPageChange?.(p);
      else dispatch({ type: 'page', value: p });
    },
    [serverSide, onPageChange],
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      if (serverSide) onPageSizeChange?.(size);
      else dispatch({ type: 'pageSize', value: size });
    },
    [serverSide, onPageSizeChange],
  );

  const handleSort = useCallback(
    (key: string, dir: 'asc' | 'desc') => {
      if (serverSide) onSort?.(key, dir);
      else dispatch({ type: 'sort', key, dir });
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
          onClearFilters={onClearFilters}
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
        rowHeight={rowHeight}
      />

      {pageSize !== undefined && (
        <ArtPagination
          page={clampedPage}
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

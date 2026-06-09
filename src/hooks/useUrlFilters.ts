'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// ==== useUrlFilters ====
// URL is the single source of truth for list filters — survives refresh, is
// shareable, drives back/forward. Replaces per-filter useState.
// NOTE: nextjs-no-use-search-params-without-suspense is a false positive here —
// consumer pages render under loading.tsx (a Suspense boundary). Left visible, not disabled.

export interface ArtDataUrlProps {
  page: number;
  onPageChange: (page: number) => void;
  onSearch: (query: string) => void;
  activeFilterCount: number;
}

export interface UseUrlFiltersResult<K extends string> {
  filters: Record<K, string | null>;
  search: string;
  page: number;
  activeCount: number;
  // Setters reset page to 1 (a filter/search change invalidates the old page).
  setFilter: (key: K, value: string | null) => void;
  setFilters: (updates: Partial<Record<K, string | null>>) => void;
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  clearFilters: () => void;
  dataProps: ArtDataUrlProps; // spread into ArtData server-side mode
}

const SEARCH_DEFAULT = 'q';
const PAGE_KEY = 'page';

export function useUrlFilters<K extends string>(
  keys: readonly K[],
  options?: { searchKey?: string },
): UseUrlFiltersResult<K> {
  const searchKey = options?.searchKey ?? SEARCH_DEFAULT;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Primitive dep — stable even if a caller passes a fresh array literal each render.
  const keyList = keys.join('|');

  const filters = useMemo(() => {
    const out = {} as Record<K, string | null>;
    for (const key of keyList ? (keyList.split('|') as K[]) : []) {
      out[key] = searchParams.get(key);
    }
    return out;
  }, [searchParams, keyList]);

  const search = searchParams.get(searchKey) ?? '';
  const page = Math.max(1, parseInt(searchParams.get(PAGE_KEY) ?? '1', 10) || 1);

  const activeCount = useMemo(
    () => (keyList ? keyList.split('|') : []).reduce((n, key) => n + (searchParams.get(key) ? 1 : 0), 0),
    [searchParams, keyList],
  );

  // Core writer: clone current params, apply mutations, push via replace.
  const writeParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const applyFilterUpdates = useCallback(
    (params: URLSearchParams, updates: Partial<Record<K, string | null>>) => {
      for (const [key, value] of Object.entries(updates) as [K, string | null][]) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      params.delete(PAGE_KEY); // any filter change returns to page 1
    },
    [],
  );

  const setFilters = useCallback(
    (updates: Partial<Record<K, string | null>>) => writeParams((p) => applyFilterUpdates(p, updates)),
    [writeParams, applyFilterUpdates],
  );

  const setFilter = useCallback(
    (key: K, value: string | null) => setFilters({ [key]: value } as Partial<Record<K, string | null>>),
    [setFilters],
  );

  const setSearch = useCallback(
    (value: string) =>
      writeParams((p) => {
        if (value) p.set(searchKey, value);
        else p.delete(searchKey);
        p.delete(PAGE_KEY);
      }),
    [writeParams, searchKey],
  );

  const setPage = useCallback(
    (next: number) =>
      writeParams((p) => {
        if (next <= 1) p.delete(PAGE_KEY);
        else p.set(PAGE_KEY, String(next));
      }),
    [writeParams],
  );

  const clearFilters = useCallback(
    () =>
      writeParams((p) => {
        for (const key of keyList ? keyList.split('|') : []) p.delete(key);
        p.delete(PAGE_KEY);
      }),
    [writeParams, keyList],
  );

  const dataProps = useMemo<ArtDataUrlProps>(
    () => ({ page, onPageChange: setPage, onSearch: setSearch, activeFilterCount: activeCount }),
    [page, setPage, setSearch, activeCount],
  );

  return { filters, search, page, activeCount, setFilter, setFilters, setSearch, setPage, clearFilters, dataProps };
}

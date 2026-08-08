// Centralized query keys for React Query
// Format: [resource, kind, subtype, ...args]

import type { MappingFilterYupModel } from '@/models/mapping.models';
import type { ConnectionFilterYupModel } from '@/models/connection.models';
import type { ExportSettingFilterYupModel } from '@/models/export-settings.models';

export const queryKeys = {
  user: {
    invalidate: {
      all: () => ['user'] as const,
    },
    me: () => ['user', 'single', 'me'] as const,
    byId: (id: string) => ['user', 'single', 'byId', id] as const,
    dbConsumption: () => ['user', 'single', 'dbConsumption'] as const,
  },
  report: {
    invalidate: {
      all: () => ['report'] as const,
      list: () => ['report', 'list'] as const,
    },
    all: () => ['report', 'list', 'all'] as const,
    byId: (id: string) => ['report', 'single', 'byId', id] as const,
  },
  mapping: {
    invalidate: {
      all: () => ['mapping'] as const,
      lists: () => ['mapping', 'list'] as const,
    },
    light: (reportType?: string) => ['mapping', 'list', 'light', reportType ?? ''] as const,
    paged: (page: number, pageSize: number, freeText?: string, filters?: MappingFilterYupModel) =>
      ['mapping', 'list', 'paged', page, pageSize, freeText ?? '', filters?.reportType ?? ''] as const,
    byId: (id: string) => ['mapping', 'single', 'byId', id] as const,
  },
  exportSetting: {
    invalidate: {
      all: () => ['exportSetting'] as const,
      lists: () => ['exportSetting', 'list'] as const,
    },
    light: () => ['exportSetting', 'list', 'light'] as const,
    paged: (page: number, pageSize: number, freeText?: string, filters?: ExportSettingFilterYupModel) =>
      ['exportSetting', 'list', 'paged', page, pageSize, freeText ?? '', filters?.hasTotalColumn ?? ''] as const,
    byId: (id: string) => ['exportSetting', 'single', 'byId', id] as const,
  },
  connection: {
    invalidate: {
      all: () => ['connection'] as const,
      lists: () => ['connection', 'list'] as const,
      // Every derived report fetch (both report types). Invalidate whenever a connection or
      // its linked mapping changes — the fetch result embeds the joined mapping, so stale
      // config/mapping would otherwise keep showing on the report pages until refetch.
      fetches: () => ['connection', 'fetchMany'] as const,
    },
    light: () => ['connection', 'list', 'light'] as const,
    paged: (page: number, pageSize: number, freeText?: string, filters?: ConnectionFilterYupModel) =>
      ['connection', 'list', 'paged', page, pageSize, freeText ?? '', filters?.type ?? '', filters?.reportType ?? ''] as const,
    byId: (id: string) => ['connection', 'single', 'byId', id] as const,
    fetch: (id: string, filters: object) => ['connection', 'fetch', id, filters] as const,
    fetchManyPnl: (connections: { id: string }[], filters: object) =>
      ['connection', 'fetchMany', 'pnl', connections.map((c) => c.id).toSorted(), filters] as const,
    fetchManyFinancialPosition: (connections: { id: string }[], filters: object) =>
      ['connection', 'fetchMany', 'financial_position', connections.map((c) => c.id).toSorted(), filters] as const,
  },
  // Separate namespace — never invalidated by exportSetting mutations (bytes can't be cached)
  logo: {
    invalidate: {
      all: () => ['logo'] as const,
      lists: () => ['logo', 'list'] as const,
    },
    light: () => ['logo', 'list', 'light'] as const,
    byId: (id: string) => ['logo', 'single', 'byId', id] as const,
  },
  admin: {
    dbStats: () => ['admin', 'dbStats'] as const,
  },
  invite: {
    lookup: (token: string) => ['invite', 'single', 'lookup', token] as const,
    limits: () => ['invite', 'limits'] as const,
  },
  users: {
    paged: (page: number, pageSize: number, freeText?: string) =>
      ['users', 'list', 'paged', page, pageSize, freeText ?? ''] as const,
  },
  // Currency data fetched from the open @fawazahmed0/currency-api CDN.
  // BE cache: 6h TTL. FE cache: 1h staleTime — refreshes from BE cache, cheap.
  currency: {
    list: () => ['currency', 'list'] as const,
    rate: (from: string, to: string) => ['currency', 'rate', from, to] as const,
  },
} as const;

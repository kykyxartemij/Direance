// Centralized query keys for React Query
// Format: [resource, kind, subtype, ...args]

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
    },
    light: () => ['mapping', 'list', 'light'] as const,
    paged: (page: number, pageSize: number, freeText?: string) =>
      ['mapping', 'list', 'paged', page, pageSize, freeText ?? ''] as const,
    byId: (id: string) => ['mapping', 'single', 'byId', id] as const,
  },
  exportSetting: {
    invalidate: {
      all: () => ['exportSetting'] as const,
    },
    light: () => ['exportSetting', 'list', 'light'] as const,
    paged: (page: number, pageSize: number, freeText?: string) =>
      ['exportSetting', 'list', 'paged', page, pageSize, freeText ?? ''] as const,
    byId: (id: string) => ['exportSetting', 'single', 'byId', id] as const,
  },
  // Separate namespace — never invalidated by exportSetting mutations (bytes can't be cached)
  logo: {
    invalidate: {
      all: () => ['logo'] as const,
    },
    light: () => ['logo', 'list', 'light'] as const,
    byId: (id: string) => ['logo', 'single', 'byId', id] as const,
    byExportSettingId: (id: string) => ['logo', 'single', 'byExportSettingId', id] as const,
  },
  admin: {
    dbStats: () => ['admin', 'dbStats'] as const,
  },
  invite: {
    lookup: (token: string) => ['invite', 'single', 'lookup', token] as const,
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

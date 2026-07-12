// Cache keys for server-side unstable_cache
// Format matches queryKeys.ts — use these to invalidate from services
// Key structure: [resource, userId, ...discriminators]
// revalidateTag(userId)        → per-user invalidation across all resources
// revalidateTag('resource')    → broad invalidation (admin / global mutations)

export const CACHE_KEYS = {
  user: {
    invalidate: () => ['user'],
    byId: (userId: string) => ['user', userId, 'byId'],
    byEmail: (email: string) => ['user', 'byEmail', email],
    dbConsumption: (userId: string) => ['user', userId, 'dbConsumption'],
    paged: (userId: string, page: number, pageSize: number, freeText?: string) => ['user', userId, 'paged', String(page), String(pageSize), freeText ?? ''],
    count: (userId: string, freeText?: string) => ['user', userId, 'count', freeText ?? ''],
  },
  mapping: {
    invalidate: (userId: string) => ['mapping', userId],
    invalidateAll: () => ['mapping'],
    light: (userId: string, reportType?: string) => ['mapping', userId, 'light', reportType ?? ''],
    paged: (userId: string, page: number, pageSize: number, freeText?: string) => ['mapping', userId, 'paged', String(page), String(pageSize), freeText ?? ''],
    count: (userId: string, freeText?: string) => ['mapping', userId, 'count', freeText ?? ''],
    byId: (userId: string, id: string) => ['mapping', userId, 'byId', id],
  },
  invite: {
    invalidate: () => ['invite'],
    byToken: (token: string) => ['invite', 'byToken', token],
    limits: () => ['invite', 'limits'],
    count: () => ['invite', 'count'],
  },
  admin: {
    dbSize: () => ['admin', 'db-size'],
    neonConsumption: () => ['admin', 'neon-consumption'],
  },
  currency: {
    list: () => ['currency', 'list'],
    rate: (from: string) => ['currency', 'rate', from],
  },
  logo: {
    invalidate: (userId: string) => ['logo', userId],
    light: (userId: string) => ['logo', userId, 'light'],
  },
  exportSetting: {
    invalidate: (userId: string) => ['exportSetting', userId],
    light: (userId: string) => ['exportSetting', userId, 'light'],
    paged: (userId: string, page: number, pageSize: number, freeText?: string) => ['exportSetting', userId, 'paged', String(page), String(pageSize), freeText ?? ''],
    count: (userId: string, freeText?: string) => ['exportSetting', userId, 'count', freeText ?? ''],
    byId: (userId: string, id: string) => ['exportSetting', userId, 'byId', id],
  },
  connection: {
    invalidate: (userId: string) => ['connection', userId],
    light: (userId: string) => ['connection', userId, 'light'],
    paged: (userId: string, page: number, pageSize: number, freeText?: string) => ['connection', userId, 'paged', String(page), String(pageSize), freeText ?? ''],
    count: (userId: string, freeText?: string) => ['connection', userId, 'count', freeText ?? ''],
    byId: (userId: string, id: string) => ['connection', userId, 'byId', id],
    fetch: (userId: string, reportType: string, id: string, filters: object) => ['connection', userId, 'fetch', reportType, id, JSON.stringify(filters)],
  },
};

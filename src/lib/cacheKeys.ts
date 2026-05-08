// Cache keys for server-side unstable_cache
// Format matches queryKeys.ts — use these to invalidate from services
// Key structure: [resource, userId, ...discriminators]
// revalidateTag(userId)        → per-user invalidation across all resources
// revalidateTag('resource')    → broad invalidation (admin / global mutations)

export const CACHE_KEYS = {
  user: {
    invalidate: (userId: string) => ['user', userId],
    byId: (userId: string) => ['user', userId, 'byId'],
    byEmail: (email: string) => ['user', 'byEmail', email],
    dbConsumption: (userId: string) => ['user', userId, 'dbConsumption'],
  },
  // report: {
  //   invalidate: () => ['report'],
  //   all: () => ['report', 'all'],
  //   byId: (id: string) => ['report', 'byId', id],
  // },
  mapping: {
    invalidate: (userId: string) => ['mapping', userId],
    invalidateAll: () => ['mapping'],
    light: (userId: string) => ['mapping', userId, 'light'],
    paged: (userId: string, page: number, pageSize: number, freeText?: string) => ['mapping', userId, 'paged', String(page), String(pageSize), freeText ?? ''],
    count: (userId: string, freeText?: string) => ['mapping', userId, 'count', freeText ?? ''],
    byId: (userId: string, id: string) => ['mapping', userId, 'byId', id],
  },
  invite: {
    invalidate: () => ['invite'],
    byToken: (token: string) => ['invite', 'byToken', token],
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
};

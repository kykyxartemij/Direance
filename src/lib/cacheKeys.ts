// Cache keys for server-side unstable_cache
// Format matches queryKeys.ts — use these to invalidate from services

export const CACHE_KEYS = {
  user: {
    invalidate: () => ['user'],
    byId: (id: string) => ['user', 'byId', id],
    byEmail: (email: string) => ['user', 'byEmail', email],
    dbConsumption: (userId: string) => ['user', 'dbConsumption', userId],
  },
  report: {
    invalidate: () => ['report'],
    all: () => ['report', 'all'],
    byId: (id: string) => ['report', 'byId', id],
  },
  mapping: {
    invalidate: () => ['mapping'],
    light: (userId: string) => ['mapping', 'light', userId],
    paged: (userId: string, page: number, pageSize: number) => ['mapping', 'paged', userId, String(page), String(pageSize)],
    count: (userId: string) => ['mapping', 'count', userId],
    byId: (id: string) => ['mapping', 'byId', id],
  },
  invite: {
    invalidate: () => ['invite'],
    byToken: (token: string) => ['invite', 'byToken', token],
  },
  admin: {
    dbSize: () => ['admin', 'db-size'],
    neonConsumption: () => ['admin', 'neon-consumption'],
  },
  logo: {
    invalidate: () => ['logo'],
    light: (userId: string) => ['logo', 'light', userId],
    byId: (id: string) => ['logo', 'byId', id],
    byExportSettingId: (id: string) => ['logo', 'byExportSettingId', id],
  },
  exportSetting: {
    invalidate: () => ['exportSetting'],
    light: (userId: string) => ['exportSetting', 'light', userId],
    paged: (userId: string, page: number, pageSize: number, freeText?: string) => [
      'exportSetting',
      'paged',
      userId,
      String(page),
      String(pageSize),
      freeText ?? '',
    ],
    count: (userId: string, freeText?: string) => [
      'exportSetting',
      'count',
      userId,
      freeText ?? '',
    ],
    byId: (id: string) => ['exportSetting', 'byId', id],
  },
};

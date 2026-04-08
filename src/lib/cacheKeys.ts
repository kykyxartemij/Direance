// Cache keys for server-side unstable_cache
// Format matches queryKeys.ts — use these to invalidate from services

export const CACHE_KEYS = {
  user: {
    invalidate: () => ['user'],
    byId: (id: string) => ['user', 'byId', id],
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

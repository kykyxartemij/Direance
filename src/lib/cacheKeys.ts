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
};

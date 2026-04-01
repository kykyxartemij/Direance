// Centralized query keys for React Query
// Format: [resource, kind, subtype, ...args]

export const queryKeys = {
  user: {
    invalidate: {
      all: () => ['user'] as const,
    },
    me: () => ['user', 'single', 'me'] as const,
    byId: (id: string) => ['user', 'single', 'byId', id] as const,
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
    all: () => ['mapping', 'list', 'all'] as const,
    byId: (id: string) => ['mapping', 'single', 'byId', id] as const,
  },
} as const;

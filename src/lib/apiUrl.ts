// Structure mirrors prisma/schema.prisma domains

export const API = {
  user: {
    me: () => '/api/user/me',
    update: () => '/api/user',
  },
  report: {
    list: () => '/api/report',
    byId: (id: string) => `/api/report/${id}`,
    upload: () => '/api/report/upload',
  },
  mapping: {
    list: () => '/api/mapping',
    byId: (id: string) => `/api/mapping/${id}`,
  },
} as const;

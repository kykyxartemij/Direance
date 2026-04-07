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
    paged: (page: number, pageSize: number) =>
      `/api/mapping/paged?page=${page}&pageSize=${pageSize}`,
    byId: (id: string) => `/api/mapping/${id}`,
  },
  exportSetting: {
    list: () => '/api/export-settings',
    paged: (page: number, pageSize: number) =>
      `/api/export-settings/paged?page=${page}&pageSize=${pageSize}`,
    byId: (id: string) => `/api/export-settings/${id}`,
    logo: (id: string) => `/api/export-settings/${id}/logo`,
  },
} as const;

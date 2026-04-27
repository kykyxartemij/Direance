// Structure mirrors prisma/schema.prisma domains

export const API = {
  user: {
    me: () => '/api/user/me',
    update: () => '/api/user/me',
    delete: () => '/api/user/me',
    dbConsumption: () => '/api/user/me/consumption',
  },
  invite: {
    send: () => '/api/invites',
    accept: () => '/api/invites/accept',
    lookup: (token: string) => `/api/invites/lookup?token=${encodeURIComponent(token)}`,
  },
  report: {
    list: () => '/api/report',
    byId: (id: string) => `/api/report/${id}`,
    upload: () => '/api/report/upload',
  },
  mapping: {
    list: () => '/api/mapping',
    light: () => '/api/mapping/light',
    paged: (page: number, pageSize: number) =>
      `/api/mapping/paged?page=${page}&pageSize=${pageSize}`,
    byId: (id: string) => `/api/mapping/${id}`,
  },
  logo: {
    list: () => '/api/logos',
    byId: (id: string) => `/api/logos/${id}`,
    byExportSettingId: (id: string) => `/api/export-settings/${id}/logo`,
  },
  exportSetting: {
    light: () => '/api/export-settings/light',
    list: () => '/api/export-settings',
    paged: (page: number, pageSize: number) =>
      `/api/export-settings/paged?page=${page}&pageSize=${pageSize}`,
    byId: (id: string) => `/api/export-settings/${id}`,
  },
  admin: {
    dbStats: () => '/api/admin/db-stats' as const,
  },
} as const;

// Structure mirrors prisma/schema.prisma domains

import type { MappingFilterModel } from '@/models/mapping.models';

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
    limits: () => '/api/invites/limits' as const,
  },
  report: {
    list: () => '/api/report',
    byId: (id: string) => `/api/report/${id}`,
    upload: () => '/api/report/upload',
  },
  mapping: {
    list: () => '/api/mapping',
    light: (reportType?: string) => `/api/mapping/light${reportType ? `?reportType=${reportType}` : ''}`,
    paged: (page: number, pageSize: number, freeText?: string, filters?: MappingFilterModel) =>
      `/api/mapping/paged?page=${page}&pageSize=${pageSize}${freeText ? `&freeText=${encodeURIComponent(freeText)}` : ''}${filters?.reportType ? `&reportType=${filters.reportType}` : ''}`,
    byId: (id: string) => `/api/mapping/${id}`,
  },
  logo: {
    list: () => '/api/logos',
    byId: (id: string) => `/api/logos/${id}`,
  },
  exportSetting: {
    light: () => '/api/export-settings/light',
    list: () => '/api/export-settings',
    paged: (page: number, pageSize: number, freeText?: string) =>
      `/api/export-settings/paged?page=${page}&pageSize=${pageSize}${freeText ? `&freeText=${encodeURIComponent(freeText)}` : ''}`,
    byId: (id: string) => `/api/export-settings/${id}`,
  },
  connection: {
    light: () => '/api/connections/light',
    list: () => '/api/connections',
    paged: (page: number, pageSize: number, freeText?: string) =>
      `/api/connections/paged?page=${page}&pageSize=${pageSize}${freeText ? `&freeText=${encodeURIComponent(freeText)}` : ''}`,
    byId: (id: string) => `/api/connections/${id}`,
    testProfit: () => '/api/connections/test/pnl',
    testFinancialPosition: () => '/api/connections/test/financial-position',
    fetchFinancialPosition: () => '/api/connections/fetch/financial-position',
    fetchProfit: () => '/api/connections/fetch/pnl',
    fetchFinancialPositionById: (id: string) => `/api/connections/${id}/fetch/financial-position`,
    fetchProfitById: (id: string) => `/api/connections/${id}/fetch/pnl`,
  },
  currency: {
    list: () => '/api/currencies',
    rate: (from: string) => `/api/currencies/rate/${encodeURIComponent(from)}`,
  },
  admin: {
    dbStats: () => '/api/admin/db-stats' as const,
  },
  users: {
    paged: (page: number, pageSize: number, freeText?: string) =>
      `/api/admin/users?page=${page}&pageSize=${pageSize}${freeText ? `&freeText=${encodeURIComponent(freeText)}` : ''}`,
  },
} as const;

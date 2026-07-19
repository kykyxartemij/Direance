'use client';

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { useReports } from '@/providers/ReportProvider';
import fetchClient from '@/lib/fetchClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type {
  ConnectionModel,
  ConnectionLightModel,
  ConnectionType,
  ConnectionConfig,
  ConnectionSecret,
  CreateConnectionModel,
  UpdateConnectionModel,
  PnlFetchFiltersModel,
  FinancialPositionFetchFiltersModel,
  ConnectionSheet,
  ConnectionFetchManyResponse,
} from '@/models/connection.models';
import type { PaginatedResponse } from '@/models/paginated-response.model';
import type { ApiError } from '@/models/api-error';

// #region Connections

// ==== Queries ====

export function useGetLightConnections(
  options?: Omit<UseQueryOptions<ConnectionLightModel[], ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ConnectionLightModel[], ApiError>({
    queryKey: queryKeys.connection.light(),
    queryFn: async () => {
      const { data } = await fetchClient.get<ConnectionLightModel[]>(API.connection.light());
      return data;
    },
    ...options,
  });
}

export function useGetPagedConnections(
  page: number,
  pageSize: number,
  freeText?: string,
  options?: Omit<UseQueryOptions<PaginatedResponse<ConnectionModel>, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<PaginatedResponse<ConnectionModel>, ApiError>({
    queryKey: queryKeys.connection.paged(page, pageSize, freeText),
    queryFn: async () => {
      const { data } = await fetchClient.get<PaginatedResponse<ConnectionModel>>(
        API.connection.paged(page, pageSize, freeText),
      );
      return data;
    },
    ...options,
  });
}

export function useGetConnectionById(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ConnectionModel, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ConnectionModel, ApiError>({
    queryKey: queryKeys.connection.byId(id!),
    queryFn: async () => {
      const { data } = await fetchClient.get<ConnectionModel>(API.connection.byId(id!));
      return data;
    },
    enabled: !!id,
    ...options,
  });
}

// ==== Mutations ====

export function useCreateConnection(
  options?: Omit<UseMutationOptions<ConnectionModel, ApiError, CreateConnectionModel>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<ConnectionModel, ApiError, CreateConnectionModel>({
    ...options,
    mutationFn: async (body) => {
      const { data } = await fetchClient.post<ConnectionModel>(API.connection.list(), body);
      return data;
    },
    onSuccess: (data, ...rest) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connection.invalidate.lists() });
      queryClient.setQueryData<ConnectionModel>(queryKeys.connection.byId(data.id), data);
      options?.onSuccess?.(data, ...rest);
    },
  });
}

export function useUpdateConnection(
  options?: Omit<UseMutationOptions<ConnectionModel, ApiError, { id: string; body: Omit<UpdateConnectionModel, 'id'> }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<ConnectionModel, ApiError, { id: string; body: Omit<UpdateConnectionModel, 'id'> }>({
    ...options,
    mutationFn: async ({ id, body }) => {
      const { data } = await fetchClient.patch<ConnectionModel>(API.connection.byId(id), body);
      return data;
    },
    onSuccess: (data, ...rest) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connection.invalidate.lists() });
      queryClient.setQueryData<ConnectionModel>(queryKeys.connection.byId(data.id), data);
      options?.onSuccess?.(data, ...rest);
    },
  });
}

export function useDeleteConnection(
  options?: Omit<UseMutationOptions<void, ApiError, string>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    ...options,
    mutationFn: async (id) => {
      await fetchClient.delete(API.connection.byId(id));
    },
    onSuccess: (data, id, ...rest) => {
      queryClient.removeQueries({ queryKey: queryKeys.connection.byId(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.connection.invalidate.lists() });
      options?.onSuccess?.(data, id, ...rest);
    },
  });
}

// #endregion
// #region Pnl

type RefreshResult = { reportId: string; sheets: ConnectionSheet[]; fetchedAt: string };
type TestConnectionInput = { type: ConnectionType; config: ConnectionConfig; secret: ConnectionSecret };

// ==== Fetch many connection sheets by ids (batch — 1 request per hook call, BE coalesces DB) ====
// mapping comes joined on the connection row server-side — no separate
// getMappingById round trip. null when the connection has no mapping linked.
type FetchPnlConnectionsInput = { ids: string[] } & PnlFetchFiltersModel;

export function useFetchPnlConnectionsByIds(
  options?: Omit<UseMutationOptions<ConnectionFetchManyResponse, ApiError, FetchPnlConnectionsInput>, 'mutationFn'>
) {
  return useMutation<ConnectionFetchManyResponse, ApiError, FetchPnlConnectionsInput>({
    ...options,
    mutationFn: async ({ ids, ...filters }) => {
      const { data } = await fetchClient.post<ConnectionFetchManyResponse>(API.connection.fetchProfit(), { ids, ...filters });
      return data;
    },
  });
}

// ==== Refresh connection report (single target — every caller refreshes one connection at a time) ====
// @deprecated — per-connection refresh UI (relTime + refresh icon) removed from ReportSidebar.
// Filters already force a refetch on their own; a manual single-report refresh is redundant
// and confusing. Kept for now, scheduled for removal — do not add new callers.
type RefreshPnlTarget = { reportId: string; connectionId: string } & PnlFetchFiltersModel;

export function useRefreshPnlConnectionById(
  options?: Omit<UseMutationOptions<RefreshResult, ApiError, RefreshPnlTarget>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  const { replaceReportSheets } = useReports();

  return useMutation<RefreshResult, ApiError, RefreshPnlTarget>({
    ...options,
    mutationFn: async ({ reportId, connectionId, ...filters }) => {
      const { data } = await fetchClient.post<ConnectionFetchManyResponse>(API.connection.fetchProfit(), { ids: [connectionId], ...filters });
      return { reportId, ...data[connectionId] };
    },
    onSuccess: (result, ...rest) => {
      replaceReportSheets(result.reportId, result.sheets, result.fetchedAt);
      queryClient.invalidateQueries({ queryKey: ['placeholder'] });
      options?.onSuccess?.(result, ...rest);
    },
  });
}

// ==== Test connection (no data saved — validates credentials against the real external API) ====

export function useTestPnlConnection(
  options?: Omit<UseMutationOptions<void, ApiError, TestConnectionInput>, 'mutationFn'>
) {
  return useMutation<void, ApiError, TestConnectionInput>({
    ...options,
    mutationFn: async (body) => {
      await fetchClient.post(API.connection.testProfit(), body);
    },
  });
}

// #endregion
// #region Financial Position

// ==== Fetch many connection sheets by ids (batch — 1 request per hook call, BE coalesces DB) ====
type FetchFinancialPositionConnectionsInput = { ids: string[] } & FinancialPositionFetchFiltersModel;

export function useFetchFinancialPositionConnectionsByIds(
  options?: Omit<UseMutationOptions<ConnectionFetchManyResponse, ApiError, FetchFinancialPositionConnectionsInput>, 'mutationFn'>
) {
  return useMutation<ConnectionFetchManyResponse, ApiError, FetchFinancialPositionConnectionsInput>({
    ...options,
    mutationFn: async ({ ids, ...filters }) => {
      const { data } = await fetchClient.post<ConnectionFetchManyResponse>(API.connection.fetchFinancialPosition(), { ids, ...filters });
      return data;
    },
  });
}

// ==== Refresh connection report (single target — every caller refreshes one connection at a time) ====
// @deprecated — per-connection refresh UI (relTime + refresh icon) removed from ReportSidebar.
// Filters already force a refetch on their own; a manual single-report refresh is redundant
// and confusing. Kept for now, scheduled for removal — do not add new callers.
type RefreshFinancialPositionTarget = { reportId: string; connectionId: string } & FinancialPositionFetchFiltersModel;

export function useRefreshFinancialPositionConnectionById(
  options?: Omit<UseMutationOptions<RefreshResult, ApiError, RefreshFinancialPositionTarget>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  const { replaceReportSheets } = useReports();

  return useMutation<RefreshResult, ApiError, RefreshFinancialPositionTarget>({
    ...options,
    mutationFn: async ({ reportId, connectionId, ...filters }) => {
      const { data } = await fetchClient.post<ConnectionFetchManyResponse>(API.connection.fetchFinancialPosition(), { ids: [connectionId], ...filters });
      return { reportId, ...data[connectionId] };
    },
    onSuccess: (result, ...rest) => {
      replaceReportSheets(result.reportId, result.sheets, result.fetchedAt);
      queryClient.invalidateQueries({ queryKey: ['placeholder'] });
      options?.onSuccess?.(result, ...rest);
    },
  });
}

// ==== Test connection (no data saved — validates credentials against the real external API) ====

export function useTestFinancialPositionConnection(
  options?: Omit<UseMutationOptions<void, ApiError, TestConnectionInput>, 'mutationFn'>
) {
  return useMutation<void, ApiError, TestConnectionInput>({
    ...options,
    mutationFn: async (body) => {
      await fetchClient.post(API.connection.testFinancialPosition(), body);
    },
  });
}

// #endregion

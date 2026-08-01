'use client';

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type {
  ConnectionModel,
  ConnectionLightModel,
  ConnectionPagedModel,
  ConnectionType,
  ConnectionConfig,
  ConnectionSecret,
  CreateConnectionModel,
  UpdateConnectionModel,
  PnlFetchFiltersModel,
  FinancialPositionFetchFiltersModel,
  ConnectionFetchManyResponse,
  ConnectionFetchResult,
} from '@/models/connection.models';
import type { PaginatedResponse } from '@/models/paginated-response.model';
import type { ApiError } from '@/models/api-error';
import type { UploadedReport } from '@/providers/ReportProvider';
import { buildConnectionReport } from '@/page/reports/buildReport';

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
  options?: Omit<UseQueryOptions<PaginatedResponse<ConnectionPagedModel>, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<PaginatedResponse<ConnectionPagedModel>, ApiError>({
    queryKey: queryKeys.connection.paged(page, pageSize, freeText),
    queryFn: async () => {
      const { data } = await fetchClient.get<PaginatedResponse<ConnectionPagedModel>>(
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
      queryClient.invalidateQueries({ queryKey: queryKeys.connection.invalidate.fetches() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.connection.invalidate.fetches() });
      options?.onSuccess?.(data, id, ...rest);
    },
  });
}

// #endregion
// #region Pnl

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

// ==== Same endpoint as the mutation above, but as a query — for state-driven report pages ====
// Two hooks, one endpoint, on purpose: `useFetchPnlConnectionsByIds` is the imperative form
// (fire on click, e.g. previewing a sample in a mapping form), this is the reactive form
// (react-query owns the trigger via `enabled`, so the report page needs no effect). Naming
// follows the file's convention — useGet* is a query, useFetch/useCreate/... is a mutation.
// Returns ready-to-render UploadedReports, built inside queryFn so the XLSX work is cached
// and never repeats per render. Caller passes the already-active connections of the right
// type, so the hook stays generic.
export function useGetPnlReportsByConnections(
  connections: ConnectionLightModel[],
  filters: PnlFetchFiltersModel,
  options?: Omit<UseQueryOptions<UploadedReport[], ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<UploadedReport[], ApiError>({
    queryKey: queryKeys.connection.fetchManyPnl(connections, filters),
    queryFn: async () => {
      const ids = connections.map((c) => c.id);
      const { data } = await fetchClient.post<ConnectionFetchManyResponse>(API.connection.fetchProfit(), { ids, ...filters });
      return connections.flatMap((c) => (data[c.id] ? [buildConnectionReport(c, data[c.id])] : []));
    },
    enabled: connections.length > 0,
    ...options,
  });
}

// ==== Fetch a single connection (id from the route) — imperative ====
// One connection at a time; returns the raw fetch result (sheets + joined mapping), not a
// keyed map. For callers that already know the one connection they want (e.g. previewing a
// sample inside a mapping form) rather than the whole active set.
type FetchPnlConnectionByIdInput = { id: string } & PnlFetchFiltersModel;

export function useFetchPnlConnectionById(
  options?: Omit<UseMutationOptions<ConnectionFetchResult, ApiError, FetchPnlConnectionByIdInput>, 'mutationFn'>
) {
  return useMutation<ConnectionFetchResult, ApiError, FetchPnlConnectionByIdInput>({
    ...options,
    mutationFn: async ({ id, ...filters }) => {
      const { data } = await fetchClient.post<ConnectionFetchResult>(API.connection.fetchProfitById(id), filters);
      return data;
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

// ==== Same endpoint as the mutation above, as a query — see useGetPnlReportsByConnections. ====
export function useGetFinancialPositionReportsByConnections(
  connections: ConnectionLightModel[],
  filters: FinancialPositionFetchFiltersModel,
  options?: Omit<UseQueryOptions<UploadedReport[], ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<UploadedReport[], ApiError>({
    queryKey: queryKeys.connection.fetchManyFinancialPosition(connections, filters),
    queryFn: async () => {
      const ids = connections.map((c) => c.id);
      const { data } = await fetchClient.post<ConnectionFetchManyResponse>(API.connection.fetchFinancialPosition(), { ids, ...filters });
      return connections.flatMap((c) => (data[c.id] ? [buildConnectionReport(c, data[c.id])] : []));
    },
    enabled: connections.length > 0,
    ...options,
  });
}

// ==== Fetch a single connection (id from the route) — see useFetchPnlConnectionById. ====
type FetchFinancialPositionConnectionByIdInput = { id: string } & FinancialPositionFetchFiltersModel;

export function useFetchFinancialPositionConnectionById(
  options?: Omit<UseMutationOptions<ConnectionFetchResult, ApiError, FetchFinancialPositionConnectionByIdInput>, 'mutationFn'>
) {
  return useMutation<ConnectionFetchResult, ApiError, FetchFinancialPositionConnectionByIdInput>({
    ...options,
    mutationFn: async ({ id, ...filters }) => {
      const { data } = await fetchClient.post<ConnectionFetchResult>(API.connection.fetchFinancialPositionById(id), filters);
      return data;
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

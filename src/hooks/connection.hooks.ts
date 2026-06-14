'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReports, type ConnectionSheet } from '@/providers/ReportProvider';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import fetchClient from '@/lib/fetchClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type {
  ConnectionModel,
  ConnectionLightModel,
  CreateConnectionModel,
  UpdateConnectionModel,
  FetchFiltersModel,
} from '@/models/connection.models';
import type { PaginatedResponse } from '@/models/paginated-response.model';
import type { ApiError } from '@/models/api-error';

// ==== Queries ====

export function useGetLightConnections() {
  return useQuery<ConnectionLightModel[], ApiError>({
    queryKey: queryKeys.connection.light(),
    queryFn: async () => {
      const { data } = await fetchClient.get<ConnectionLightModel[]>(API.connection.light());
      return data;
    },
  });
}

export function useGetPagedConnections(page: number, pageSize: number, freeText?: string) {
  return useQuery<PaginatedResponse<ConnectionModel>, ApiError>({
    queryKey: queryKeys.connection.paged(page, pageSize, freeText),
    queryFn: async () => {
      const { data } = await fetchClient.get<PaginatedResponse<ConnectionModel>>(
        API.connection.paged(page, pageSize, freeText),
      );
      return data;
    },
  });
}

export function useGetConnectionById(id: string | undefined) {
  return useQuery<ConnectionModel, ApiError>({
    queryKey: queryKeys.connection.byId(id!),
    queryFn: async () => {
      const { data } = await fetchClient.get<ConnectionModel>(API.connection.byId(id!));
      return data;
    },
    enabled: !!id,
  });
}

// ==== Mutations ====

export function useCreateConnection() {
  const queryClient = useQueryClient();
  return useMutation<ConnectionModel, ApiError, CreateConnectionModel>({
    mutationFn: async (body) => {
      const { data } = await fetchClient.post<ConnectionModel>(API.connection.list(), body);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connection.invalidate.all() });
      queryClient.setQueryData<ConnectionModel>(queryKeys.connection.byId(data.id), data);
    },
  });
}

export function useUpdateConnection() {
  const queryClient = useQueryClient();
  return useMutation<ConnectionModel, ApiError, { id: string; body: Omit<UpdateConnectionModel, 'id'> }>({
    mutationFn: async ({ id, body }) => {
      const { data } = await fetchClient.patch<ConnectionModel>(API.connection.byId(id), body);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connection.invalidate.all() });
      queryClient.setQueryData<ConnectionModel>(queryKeys.connection.byId(data.id), data);
    },
  });
}

export function useDeleteConnection() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: async (id) => {
      await fetchClient.delete(API.connection.byId(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connection.invalidate.all() });
    },
  });
}

// ==== Fetch external data ====
// FE-cached per (connection, filters) for the session. staleTime: Infinity so
// the same filter set never re-hits BE in one session — matches the "one
// session thing" expectation. User must explicitly refetch to bust.

export function useFetchFromConnection(id: string | undefined, filters: FetchFiltersModel, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.connection.fetch(id ?? '', filters),
    queryFn: async () => {
      const { data } = await fetchClient.post(API.connection.fetch(id!), filters);
      return data;
    },
    enabled: !!id && enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

// ==== Refresh connection reports ====
// All business logic lives here: fetch each active connection, replace sheets,
// surface success/error via snackbar. Component calls mutate() with no try/catch.

type RefreshTarget = { reportId: string; connectionId: string; filters: FetchFiltersModel };
type RefreshResult = { reportId: string; sheets: ConnectionSheet[]; fetchedAt: string };

export function useRefreshConnectionReports() {
  const queryClient = useQueryClient();
  const { replaceReportSheets } = useReports();
  const { enqueueError, enqueueSuccess } = useArtSnackbar();

  return useMutation<RefreshResult[], ApiError, RefreshTarget[]>({
    mutationFn: async (targets) =>
      Promise.all(
        targets.map(async (t) => {
          const { data } = await fetchClient.post<{ sheets: ConnectionSheet[]; fetchedAt: string }>(
            API.connection.fetch(t.connectionId),
            t.filters,
          );
          return { reportId: t.reportId, sheets: data.sheets, fetchedAt: data.fetchedAt };
        }),
      ),
    onSuccess: (results) => {
      for (const r of results) replaceReportSheets(r.reportId, r.sheets, r.fetchedAt);
      enqueueSuccess(`Refreshed ${results.length} report${results.length > 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['placeholder'] })
    },
    onError: (err) => {
      enqueueError(err as Error, 'Failed to refresh');
    },
  });
}

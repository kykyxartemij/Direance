'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useReports, type ConnectionSheet } from '@/providers/ReportProvider';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import fetchClient from '@/lib/fetchClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type {
  ConnectionModel,
  ConnectionLightModel,
  ConnectionType,
  CreateConnectionModel,
  UpdateConnectionModel,
  PnlFetchFiltersModel,
  FinancialPositionFetchFiltersModel,
} from '@/models/connection.models';
import type { MappingModel } from '@/models/mapping.models';
import type { PaginatedResponse } from '@/models/paginated-response.model';
import type { ApiError } from '@/models/api-error';

// Two independent request shapes — see connection.models.ts. Not one shared
// FetchFiltersModel; this union exists only so a single hook can route to
// whichever of the two BE endpoints matches.
type ConnectionFetchFilters =
  | ({ reportType: 'pnl' } & PnlFetchFiltersModel)
  | ({ reportType: 'financial_position' } & FinancialPositionFetchFiltersModel);

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

// ==== Fetch many connection sheets by ids (batch — 1 request per reportType, BE coalesces DB) ====
// Two BE endpoints (financial-position / pnl) behind one call — the only
// branching FE does is picking the URL for the reportType already on the
// filters; no merit/odoo knowledge here at all.

// mapping comes joined on the connection row server-side — no separate
// getMappingById round trip. null when the connection has no mapping linked.
type FetchManyResult = Record<string, { sheets: ConnectionSheet[]; fetchedAt: string; mapping: MappingModel | null }>;

async function fetchConnectionsByIds(ids: string[], filters: ConnectionFetchFilters): Promise<FetchManyResult> {
  const url = filters.reportType === 'pnl' ? API.connection.fetchProfit() : API.connection.fetchFinancialPosition();
  const { data } = await fetchClient.post<FetchManyResult>(url, { ids, ...filters });
  return data;
}

type FetchManyInput = { ids: string[] } & ConnectionFetchFilters;

export function useFetchFromConnectionsByIds() {
  return useMutation<FetchManyResult, ApiError, FetchManyInput>({
    mutationFn: ({ ids, ...filters }) => fetchConnectionsByIds(ids, filters),
  });
}

// ==== Refresh connection reports ====
// All business logic lives here: fetch each target, replace sheets, surface
// success/error via snackbar. Component calls mutate() with no try/catch.

type RefreshTarget = { reportId: string; connectionId: string; filters: ConnectionFetchFilters };
type RefreshResult = { reportId: string; sheets: ConnectionSheet[]; fetchedAt: string };

export function useRefreshConnectionReports() {
  const queryClient = useQueryClient();
  const { replaceReportSheets } = useReports();
  const { enqueueError, enqueueSuccess } = useArtSnackbar();

  return useMutation<RefreshResult[], ApiError, RefreshTarget[]>({
    mutationFn: (targets) =>
      Promise.all(targets.map(async (t) => {
        const data = await fetchConnectionsByIds([t.connectionId], t.filters);
        return { reportId: t.reportId, ...data[t.connectionId] };
      })),
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

// ==== Import from connection ====

type ConnectionImportInput = {
  connectionId: string;
  connectionName: string;
  connectionType: ConnectionType | undefined;
  filters: ConnectionFetchFilters;
  skipMapping: boolean;
};

export function useImportFromConnection() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addReportFromSheets, setMapping } = useReports();
  const { enqueueError } = useArtSnackbar();

  return useMutation({
    mutationFn: async ({ connectionId, connectionName, connectionType, filters, skipMapping }: ConnectionImportInput) => {
      const result = await fetchConnectionsByIds([connectionId], filters);
      const data = result[connectionId];
      const fileName = `${connectionName}-${new Date(data.fetchedAt).toISOString().slice(0, 10)}`;
      const id = addReportFromSheets(fileName, data.sheets, {
        connectionId,
        connectionType,
        fetchedAt: data.fetchedAt,
      });
      if (!skipMapping && data.mapping) setMapping(id, data.mapping);
      return { skipMapping, hasMappingId: !!data.mapping };
    },
    onSuccess: ({ skipMapping, hasMappingId }) => {
      queryClient.invalidateQueries({ queryKey: ['placeholder'] });
      router.push(skipMapping || !hasMappingId ? '/' : '/upload/mapping');
    },
    onError: (err) => {
      enqueueError(err as Error, 'Failed to import from connection');
    },
  });
}

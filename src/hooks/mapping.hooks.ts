'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { QueryClient } from '@tanstack/react-query';
import type { MappingModel, MappingLightModel, CreateMappingModel, UpdateMappingModel } from '@/models/mapping.models';
import type { PaginatedResponse } from '@/models/paginated-response.model';
import type { ApiError } from '@/models/api-error';

// ==== Queries ====

export function useGetPagedMappings(page: number, pageSize: number) {
  return useQuery<PaginatedResponse<MappingModel>, ApiError>({
    queryKey: queryKeys.mapping.paged(page, pageSize),
    queryFn: async () => {
      const { data } = await fetchClient.get<PaginatedResponse<MappingModel>>(
        API.mapping.paged(page, pageSize)
      );
      return data;
    },
  });
}

export function useGetLightMappings() {
  return useQuery<MappingLightModel[], ApiError>({
    queryKey: queryKeys.mapping.light(),
    queryFn: async () => {
      const { data } = await fetchClient.get<MappingLightModel[]>(API.mapping.light());
      return data;
    },
  });
}

export function useGetMappingById(id: string | undefined) {
  return useQuery<MappingModel, ApiError>({
    queryKey: queryKeys.mapping.byId(id!),
    queryFn: async () => {
      const { data } = await fetchClient.get<MappingModel>(API.mapping.byId(id!));
      return data;
    },
    enabled: !!id,
  });
}

/** Ensure a full MappingModel is in cache, fetching if needed. Use in event handlers (not hooks). */
export function fetchMappingById(queryClient: QueryClient, id: string) {
  return queryClient.ensureQueryData<MappingModel>({
    queryKey: queryKeys.mapping.byId(id),
    queryFn: async () => {
      const { data } = await fetchClient.get<MappingModel>(API.mapping.byId(id));
      return data;
    },
  });
}

// ==== Mutations ====

export function useCreateMapping() {
  const queryClient = useQueryClient();
  return useMutation<MappingModel, ApiError, CreateMappingModel>({
    mutationFn: async (body) => {
      const { data } = await fetchClient.post<MappingModel>(API.mapping.list(), body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mapping.invalidate.all() });
    },
  });
}

export function useUpdateMapping() {
  const queryClient = useQueryClient();
  return useMutation<MappingModel, ApiError, { id: string; body: Omit<UpdateMappingModel, 'id'> }>({
    mutationFn: async ({ id, body }) => {
      const { data } = await fetchClient.patch<MappingModel>(API.mapping.byId(id), body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mapping.invalidate.all() });
    },
  });
}

export function useDeleteMapping() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: async (id) => {
      await fetchClient.delete(API.mapping.byId(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mapping.invalidate.all() });
    },
  });
}

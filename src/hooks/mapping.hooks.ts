'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/lib/axiosClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { QueryClient } from '@tanstack/react-query';
import type { MappingModel, MappingLightItem, MappingCreateInput, MappingUpdateInput } from '@/models/mapping.models';
import type { PaginatedResponse } from '@/models/paginated-response.model';
import type { ApiError } from '@/models/api-error';

// ==== Queries ====

export function useGetPagedMappings(page: number, pageSize: number) {
  return useQuery<PaginatedResponse<MappingModel>, ApiError>({
    queryKey: queryKeys.mapping.paged(page, pageSize),
    queryFn: async () => {
      const { data } = await axiosClient.get<PaginatedResponse<MappingModel>>(
        API.mapping.paged(page, pageSize)
      );
      return data;
    },
  });
}

export function useGetLightMappings() {
  return useQuery<MappingLightItem[], ApiError>({
    queryKey: queryKeys.mapping.light(),
    queryFn: async () => {
      const { data } = await axiosClient.get(API.mapping.light());
      return data;
    },
  });
}

export function useGetMappingById(id: string | undefined) {
  return useQuery<MappingModel, ApiError>({
    queryKey: queryKeys.mapping.byId(id!),
    queryFn: async () => {
      const { data } = await axiosClient.get<MappingModel>(API.mapping.byId(id!));
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
      const { data } = await axiosClient.get<MappingModel>(API.mapping.byId(id));
      return data;
    },
  });
}

// ==== Mutations ====

export function useCreateMapping() {
  const queryClient = useQueryClient();
  return useMutation<MappingModel, ApiError, MappingCreateInput>({
    mutationFn: async (body) => {
      const { data } = await axiosClient.post<MappingModel>(API.mapping.list(), body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mapping.invalidate.all() });
    },
  });
}

export function useUpdateMapping() {
  const queryClient = useQueryClient();
  return useMutation<MappingModel, ApiError, { id: string; body: MappingUpdateInput }>({
    mutationFn: async ({ id, body }) => {
      const { data } = await axiosClient.patch<MappingModel>(API.mapping.byId(id), body);
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
      await axiosClient.delete(API.mapping.byId(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mapping.invalidate.all() });
    },
  });
}

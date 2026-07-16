'use client';

import {
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseSuspenseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { QueryClient } from '@tanstack/react-query';
import type { MappingModel, MappingLightModel, CreateMappingModel, UpdateMappingModel } from '@/models/mapping.models';
import type { PaginatedResponse } from '@/models/paginated-response.model';
import type { ApiError } from '@/models/api-error';

// ==== Queries ====

export function useGetPagedMappings(
  page: number,
  pageSize: number,
  freeText?: string,
  options?: Omit<UseQueryOptions<PaginatedResponse<MappingModel>, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<PaginatedResponse<MappingModel>, ApiError>({
    queryKey: queryKeys.mapping.paged(page, pageSize, freeText),
    queryFn: async () => {
      const { data } = await fetchClient.get<PaginatedResponse<MappingModel>>(
        API.mapping.paged(page, pageSize, freeText)
      );
      return data;
    },
    ...options,
  });
}

export function useGetLightMappings(
  reportType?: string,
  options?: Omit<UseQueryOptions<MappingLightModel[], ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<MappingLightModel[], ApiError>({
    queryKey: queryKeys.mapping.light(reportType),
    queryFn: async () => {
      const { data } = await fetchClient.get<MappingLightModel[]>(API.mapping.light(reportType));
      return data;
    },
    ...options,
  });
}

export function useGetMappingById(
  id: string,
  options?: Omit<UseSuspenseQueryOptions<MappingModel, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useSuspenseQuery<MappingModel, ApiError>({
    queryKey: queryKeys.mapping.byId(id),
    queryFn: async () => {
      const { data } = await fetchClient.get<MappingModel>(API.mapping.byId(id));
      return data;
    },
    ...options,
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

export function useCreateMapping(
  options?: Omit<UseMutationOptions<MappingModel, ApiError, CreateMappingModel>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<MappingModel, ApiError, CreateMappingModel>({
    ...options,
    mutationFn: async (body) => {
      const { data } = await fetchClient.post<MappingModel>(API.mapping.list(), body);
      return data;
    },
    onSuccess: (data, ...rest) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mapping.invalidate.lists() });
      queryClient.setQueryData<MappingModel>(queryKeys.mapping.byId(data.id), data);
      options?.onSuccess?.(data, ...rest);
    },
  });
}

export function useUpdateMapping(
  options?: Omit<UseMutationOptions<MappingModel, ApiError, { id: string; body: UpdateMappingModel }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<MappingModel, ApiError, { id: string; body: UpdateMappingModel }>({
    ...options,
    mutationFn: async ({ id, body }) => {
      const { data } = await fetchClient.patch<MappingModel>(API.mapping.byId(id), body);
      return data;
    },
    onSuccess: (data, ...rest) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mapping.invalidate.lists() });
      queryClient.setQueryData<MappingModel>(queryKeys.mapping.byId(data.id), data);
      options?.onSuccess?.(data, ...rest);
    },
  });
}

export function useDeleteMapping(
  options?: Omit<UseMutationOptions<void, ApiError, string>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    ...options,
    mutationFn: async (id) => {
      await fetchClient.delete(API.mapping.byId(id));
    },
    onSuccess: (data, id, ...rest) => {
      queryClient.removeQueries({ queryKey: queryKeys.mapping.byId(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mapping.invalidate.lists() });
      options?.onSuccess?.(data, id, ...rest);
    },
  });
}

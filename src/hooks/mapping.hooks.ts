'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/lib/axiosClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { MappingModel, MappingCreateInput, MappingUpdateInput } from '@/models/mapping.models';
import type { ApiError } from '@/models/api-error';

export function useMappings() {
  return useQuery<MappingModel[], ApiError>({
    queryKey: queryKeys.mapping.all(),
    queryFn: async () => {
      const { data } = await axiosClient.get<MappingModel[]>(API.mapping.list());
      return data;
    },
  });
}

export function useMapping(id: string | undefined) {
  return useQuery<MappingModel, ApiError>({
    queryKey: queryKeys.mapping.byId(id!),
    queryFn: async () => {
      const { data } = await axiosClient.get<MappingModel>(API.mapping.byId(id!));
      return data;
    },
    enabled: !!id,
  });
}

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

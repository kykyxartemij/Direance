'use client';

import {
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseSuspenseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { bytesClient } from '@/lib/images/bytesClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { ApiError } from '@/models/api-error';
import type { LogoModel, LogoBytesModel, LogoMetadataModel } from '@/models/logo.model';

export type { LogoModel, LogoBytesModel };

// ==== Queries ====

export function useGetLightLogos(
  options?: Omit<UseSuspenseQueryOptions<LogoModel[], ApiError>, 'queryKey' | 'queryFn'>
) {
  return useSuspenseQuery<LogoModel[], ApiError>({
    queryKey: queryKeys.logo.light(),
    queryFn: async () => {
      const { data } = await fetchClient.get<LogoModel[]>(API.logo.list());
      return data;
    },
    ...options,
  });
}

// Logo bytes never auto-refetch — staleTime + gcTime: Infinity.
// Fetched as binary (33% smaller than base64 JSON), decoded to base64 in bytesClient.
// TanStack Query is the primary cache — independent of browser cache.
export function useGetLogoById(
  id: string,
  options?: Omit<UseQueryOptions<LogoBytesModel, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<LogoBytesModel, ApiError>({
    queryKey: queryKeys.logo.byId(id),
    queryFn: async () => {
      const result = await bytesClient.get<LogoMetadataModel>(API.logo.byId(id));
      return {
        id,
        data: result?.data ?? null,
        mime: result?.mime ?? null,
        name: result?.meta.name ?? null };
    },
    enabled: !!id,
    staleTime: Infinity,
    gcTime: Infinity,
    ...options,
  });
}

// ==== Mutations ====

export function useCreateLogo(
  options?: Omit<UseMutationOptions<LogoBytesModel, ApiError, File>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<LogoBytesModel, ApiError, File>({
    ...options,
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('logo', file);
      const result = await bytesClient.post<LogoMetadataModel>(API.logo.list(), formData);
      return {
        id: result!.meta.id!,
        name: result!.meta.name,
        mime: result!.mime,
        data: result!.data,
      };
    },
    onSuccess: (result, ...rest) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logo.invalidate.lists() });
      queryClient.setQueryData<LogoBytesModel>(queryKeys.logo.byId(result.id), result);
      options?.onSuccess?.(result, ...rest);
    },
  });
}

export function useDeleteLogo(
  options?: Omit<UseMutationOptions<void, ApiError, { logoId: string; exportSettingId?: string }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { logoId: string; exportSettingId?: string }>({
    ...options,
    mutationFn: async ({ logoId }) => {
      await fetchClient.delete(API.logo.byId(logoId));
    },
    onSuccess: (data, variables, ...rest) => {
      queryClient.removeQueries({ queryKey: queryKeys.logo.byId(variables.logoId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.logo.invalidate.lists() });
      if (variables.exportSettingId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.byId(variables.exportSettingId) });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
      }
      options?.onSuccess?.(data, variables, ...rest);
    },
  });
}

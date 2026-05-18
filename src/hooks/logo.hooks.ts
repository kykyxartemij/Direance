'use client';

import { useQuery, useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { bytesClient } from '@/lib/images/bytesClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { ApiError } from '@/models/api-error';
import type { LogoModel, LogoBytesModel, LogoMetadataModel } from '@/models/logo.model';

export type { LogoModel, LogoBytesModel };

// ==== Queries ====

export function useGetLightLogos() {
  return useSuspenseQuery<LogoModel[], ApiError>({
    queryKey: queryKeys.logo.light(),
    queryFn: async () => {
      const { data } = await fetchClient.get<LogoModel[]>(API.logo.list());
      return data;
    },
  });
}

// Logo bytes never auto-refetch — staleTime + gcTime: Infinity.
// Fetched as binary (33% smaller than base64 JSON), decoded to base64 in bytesClient.
// TanStack Query is the primary cache — independent of browser cache.
export function useGetLogoById(id: string) {
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
  });
}

export function useGetLogoByExportSettingId(exportSettingId: string) {
  return useQuery<LogoBytesModel | null, ApiError>({
    queryKey: queryKeys.logo.byExportSettingId(exportSettingId),
    queryFn: async () => {
      const result = await bytesClient.get<LogoMetadataModel>(API.logo.byExportSettingId(exportSettingId));
      if (!result) return null;
      return { 
        id: result.meta.id, 
        data: result.data, 
        mime: result.mime, 
        name: result.meta.name 
      };
    },
    enabled: !!exportSettingId,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

// ==== Mutations ====

export function useCreateLogo() {
  const queryClient = useQueryClient();
  return useMutation<LogoBytesModel, ApiError, File>({
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logo.invalidate.all() });
      queryClient.setQueryData<LogoBytesModel>(queryKeys.logo.byId(result.id), result);
    },
  });
}

export function useDeleteLogo() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { logoId: string; exportSettingId?: string }>({
    mutationFn: async ({ logoId }) => {
      await fetchClient.delete(API.logo.byId(logoId));
    },
    onSuccess: (_data, { exportSettingId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logo.invalidate.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
      if (exportSettingId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.logo.byExportSettingId(exportSettingId) });
      }
    },
  });
}

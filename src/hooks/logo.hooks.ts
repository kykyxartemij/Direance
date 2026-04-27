'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { ApiError } from '@/models/api-error';
import type { LogoModel, LogoBytesModel } from '@/models/logo.model';

export type { LogoModel, LogoBytesModel };

// ==== Queries ====

export function useGetLightLogos() {
  return useQuery<LogoModel[], ApiError>({
    queryKey: queryKeys.logo.light(),
    queryFn: async () => {
      const { data } = await fetchClient.get<LogoModel[]>(API.logo.list());
      return data;
    },
  });
}

// Logo bytes never auto-refetch — staleTime + gcTime: Infinity.
// Cache is populated via setQueryData after upload mutations.
// Explicit .refetch() or invalidation are the only ways to update it.
export function useGetLogoByExportSettingId(id: string) {
  return useQuery<LogoBytesModel, ApiError>({
    queryKey: queryKeys.logo.byExportSettingId(id),
    queryFn: async () => {
      const { data } = await fetchClient.get<LogoBytesModel>(API.logo.byExportSettingId(id));
      return data;
    },
    enabled: !!id,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

// ==== Mutations ====

export function useCreateLogo() {
  const queryClient = useQueryClient();
  return useMutation<LogoModel, ApiError, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('logo', file);
      const { data } = await fetchClient.post<LogoModel>(API.logo.list(), formData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logo.invalidate.all() });
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

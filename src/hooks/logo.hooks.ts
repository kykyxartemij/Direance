'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/lib/axiosClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { ApiError } from '@/models/api-error';
import type { LogoLight, LogoBytes } from '@/models/logo.model';

export type { LogoLight, LogoBytes };

// ==== Queries ====

export function useGetLightLogos() {
  return useQuery<LogoLight[], ApiError>({
    queryKey: queryKeys.logo.light(),
    queryFn: async () => {
      const { data } = await axiosClient.get<LogoLight[]>(API.logo.list());
      return data;
    },
  });
}

// Logo bytes never auto-refetch — staleTime + gcTime: Infinity.
// Cache is populated via setQueryData after upload mutations.
// Explicit .refetch() or invalidation are the only ways to update it.
export function useGetLogoByExportSettingId(id: string) {
  return useQuery<LogoBytes, ApiError>({
    queryKey: queryKeys.logo.byExportSettingId(id),
    queryFn: async () => {
      const { data } = await axiosClient.get<LogoBytes>(API.logo.byExportSettingId(id));
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
  return useMutation<LogoLight, ApiError, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('logo', file);
      const { data } = await axiosClient.post<LogoLight>(API.logo.list(), formData);
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
      await axiosClient.delete(API.logo.byId(logoId));
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

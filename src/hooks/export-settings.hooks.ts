'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/lib/axiosClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type {
  ExportSetting,
  ExportSettingCreateInput,
  ExportSettingUpdateInput,
} from '@/models/export-settings.models';
import type { PaginatedResponse } from '@/models/paginated-response.model';
import type { ApiError } from '@/models/api-error';

// ==== Queries ====

export function useGetPagedExportSettings(page: number, pageSize: number) {
  return useQuery<PaginatedResponse<ExportSetting>, ApiError>({
    queryKey: queryKeys.exportSetting.paged(page, pageSize),
    queryFn: async () => {
      const { data } = await axiosClient.get<PaginatedResponse<ExportSetting>>(
        API.exportSetting.paged(page, pageSize)
      );
      return data;
    },
  });
}

export function useGetExportSettingById(id: string | undefined) {
  return useQuery<ExportSetting, ApiError>({
    queryKey: queryKeys.exportSetting.byId(id!),
    queryFn: async () => {
      const { data } = await axiosClient.get<ExportSetting>(API.exportSetting.byId(id!));
      return data;
    },
    enabled: !!id,
  });
}

// Logo is never cached — bytes can't survive JSON serialization.
// Uses an isolated key prefix so normal exportSetting invalidation doesn't touch it.
// staleTime: Infinity prevents auto-refetch; enabled: false means fetch only on .refetch().
export function useGetExportSettingLogoById(id: string | undefined) {
  return useQuery<
    { logoData: string | null; logoMime: string | null; logoName: string | null },
    ApiError
  >({
    queryKey: queryKeys.exportSettingLogo.byId(id!),
    queryFn: async () => {
      const { data } = await axiosClient.get(API.exportSetting.logo(id!));
      return data;
    },
    enabled: false,
    staleTime: Infinity,
    gcTime: 0,
  });
}

// ==== Mutations ====

export function useCreateExportSetting() {
  const queryClient = useQueryClient();
  return useMutation<ExportSetting, ApiError, ExportSettingCreateInput>({
    mutationFn: async (body) => {
      const { data } = await axiosClient.post<ExportSetting>(API.exportSetting.list(), body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
    },
  });
}

export function useUpdateExportSetting() {
  const queryClient = useQueryClient();
  return useMutation<ExportSetting, ApiError, { id: string; body: ExportSettingUpdateInput }>({
    mutationFn: async ({ id, body }) => {
      const { data } = await axiosClient.patch<ExportSetting>(API.exportSetting.byId(id), body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
    },
  });
}

// Only invalidates metadata (name, logoName) — not the logo bytes query (separate key prefix)
export function useUpdateExportSettingLogo() {
  const queryClient = useQueryClient();
  return useMutation<
    { logoData: string; logoMime: string; logoName: string },
    ApiError,
    { id: string; file: File }
  >({
    mutationFn: async ({ id, file }) => {
      const formData = new FormData();
      formData.append('logo', file);
      const { data } = await axiosClient.post(API.exportSetting.logo(id), formData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
    },
  });
}

export function useDeleteExportSettingLogo() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: async (id) => {
      await axiosClient.delete(API.exportSetting.logo(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
    },
  });
}

export function useDeleteExportSetting() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: async (id) => {
      await axiosClient.delete(API.exportSetting.byId(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
    },
  });
}

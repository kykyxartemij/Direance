'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/lib/axiosClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type {
  ExportSetting,
  ExportSettingLightItem,
  ExportSettingCreateInput,
  ExportSettingUpdateInput,
} from '@/models/export-settings.models';
import type { PaginatedResponse } from '@/models/paginated-response.model';
import type { ApiError } from '@/models/api-error';
import type { LogoLight, LogoBytes } from '@/hooks/logo.hooks';

// ==== Helpers ====

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==== Queries ====

export function useGetLightExportSettings() {
  return useQuery<ExportSettingLightItem[], ApiError>({
    queryKey: queryKeys.exportSetting.light(),
    queryFn: async () => {
      const { data } = await axiosClient.get<ExportSettingLightItem[]>(API.exportSetting.light());
      return data;
    },
  });
}

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

// ==== Mutations ====

// logo?: File  → creates logo first, links logoId to the new ExportSetting
// logo?: string → treats the value as logoId directly (existing logo)
export function useCreateExportSetting() {
  const queryClient = useQueryClient();
  return useMutation<ExportSetting, ApiError, { body: ExportSettingCreateInput; logo?: File | string }>({
    mutationFn: async ({ body, logo }) => {
      let logoId = body.logoId;

      if (logo instanceof File) {
        const formData = new FormData();
        formData.append('logo', logo);
        const { data: created } = await axiosClient.post<LogoLight>(API.logo.list(), formData);
        logoId = created.id;
      } else if (typeof logo === 'string') {
        logoId = logo;
      }

      const { data } = await axiosClient.post<ExportSetting>(API.exportSetting.list(), { ...body, logoId });
      return data;
    },
    onSuccess: (setting, { logo }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
      if (logo instanceof File) {
        queryClient.invalidateQueries({ queryKey: queryKeys.logo.invalidate.all() });
        void fileToBase64(logo).then(logoData => {
          queryClient.setQueryData<LogoBytes>(queryKeys.logo.byExportSettingId(setting.id), {
            logoData,
            logoMime: logo.type,
            logoName: logo.name,
          });
        });
      }
    },
  });
}

// logo?: File  → creates logo first, links logoId via PATCH
// logo?: string → treats the value as logoId directly
export function useUpdateExportSetting() {
  const queryClient = useQueryClient();
  return useMutation<ExportSetting, ApiError, { id: string; body: ExportSettingUpdateInput; logo?: File | string }>({
    mutationFn: async ({ id, body, logo }) => {
      let logoId = body.logoId;

      if (logo instanceof File) {
        const formData = new FormData();
        formData.append('logo', logo);
        const { data: created } = await axiosClient.post<LogoLight>(API.logo.list(), formData);
        logoId = created.id;
      } else if (typeof logo === 'string') {
        logoId = logo;
      }

      const { data } = await axiosClient.patch<ExportSetting>(API.exportSetting.byId(id), { ...body, logoId });
      return data;
    },
    onSuccess: (setting, { logo }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
      if (logo instanceof File) {
        queryClient.invalidateQueries({ queryKey: queryKeys.logo.invalidate.all() });
        void fileToBase64(logo).then(logoData => {
          queryClient.setQueryData<LogoBytes>(queryKeys.logo.byExportSettingId(setting.id), {
            logoData,
            logoMime: logo.type,
            logoName: logo.name,
          });
        });
      }
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

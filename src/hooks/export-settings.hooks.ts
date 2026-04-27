'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type {
  ExportSettingModel,
  ExportSettingLightModel,
  CreateExportSettingModel,
  UpdateExportSettingModel,
} from '@/models/export-settings.models';
import type { PaginatedResponse } from '@/models/paginated-response.model';
import type { ApiError } from '@/models/api-error';
import type { LogoModel, LogoBytesModel } from '@/hooks/logo.hooks';

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
  return useQuery<ExportSettingLightModel[], ApiError>({
    queryKey: queryKeys.exportSetting.light(),
    queryFn: async () => {
      const { data } = await fetchClient.get<ExportSettingLightModel[]>(API.exportSetting.light());
      return data;
    },
  });
}

export function useGetPagedExportSettings(page: number, pageSize: number) {
  return useQuery<PaginatedResponse<ExportSettingModel>, ApiError>({
    queryKey: queryKeys.exportSetting.paged(page, pageSize),
    queryFn: async () => {
      const { data } = await fetchClient.get<PaginatedResponse<ExportSettingModel>>(
        API.exportSetting.paged(page, pageSize)
      );
      return data;
    },
  });
}

export function useGetExportSettingById(id: string | undefined) {
  return useQuery<ExportSettingModel, ApiError>({
    queryKey: queryKeys.exportSetting.byId(id!),
    queryFn: async () => {
      const { data } = await fetchClient.get<ExportSettingModel>(API.exportSetting.byId(id!));
      return data;
    },
    enabled: !!id,
  });
}

// ==== Mutations ====

// logo?: File  → creates logo first, links logoId to the new ExportSettingModel
// logo?: string → treats the value as logoId directly (existing logo)
export function useCreateExportSetting() {
  const queryClient = useQueryClient();
  return useMutation<ExportSettingModel, ApiError, { body: CreateExportSettingModel; logo?: File | string }>({
    mutationFn: async ({ body, logo }) => {
      let logoId = body.logoId;

      if (logo instanceof File) {
        const formData = new FormData();
        formData.append('logo', logo);
        const { data: created } = await fetchClient.post<LogoModel>(API.logo.list(), formData);
        logoId = created.id;
      } else if (typeof logo === 'string') {
        logoId = logo;
      }

      const { data } = await fetchClient.post<ExportSettingModel>(API.exportSetting.list(), { ...body, logoId });
      return data;
    },
    onSuccess: (setting, { logo }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
      if (logo instanceof File) {
        queryClient.invalidateQueries({ queryKey: queryKeys.logo.invalidate.all() });
        void fileToBase64(logo).then(logoData => {
          queryClient.setQueryData<LogoBytesModel>(queryKeys.logo.byExportSettingId(setting.id), {
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
  return useMutation<ExportSettingModel, ApiError, { id: string; body: Omit<UpdateExportSettingModel, 'id'>; logo?: File | string }>({
    mutationFn: async ({ id, body, logo }) => {
      let logoId = body.logoId;

      if (logo instanceof File) {
        const formData = new FormData();
        formData.append('logo', logo);
        const { data: created } = await fetchClient.post<LogoModel>(API.logo.list(), formData);
        logoId = created.id;
      } else if (typeof logo === 'string') {
        logoId = logo;
      }

      const { data } = await fetchClient.patch<ExportSettingModel>(API.exportSetting.byId(id), { ...body, logoId });
      return data;
    },
    onSuccess: (setting, { logo }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
      if (logo instanceof File) {
        queryClient.invalidateQueries({ queryKey: queryKeys.logo.invalidate.all() });
        void fileToBase64(logo).then(logoData => {
          queryClient.setQueryData<LogoBytesModel>(queryKeys.logo.byExportSettingId(setting.id), {
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
      await fetchClient.delete(API.exportSetting.byId(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
    },
  });
}

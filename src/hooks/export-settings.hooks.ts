'use client';

import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import type { LogoBytesModel } from '@/hooks/logo.hooks';
import { useCreateLogo } from '@/hooks/logo.hooks';

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

export function useGetPagedExportSettings(page: number, pageSize: number, freeText?: string) {
  return useQuery<PaginatedResponse<ExportSettingModel>, ApiError>({
    queryKey: queryKeys.exportSetting.paged(page, pageSize, freeText),
    queryFn: async () => {
      const { data } = await fetchClient.get<PaginatedResponse<ExportSettingModel>>(
        API.exportSetting.paged(page, pageSize, freeText)
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

// logo?: File  → creates logo first (via useCreateLogo), links logoId to the new ExportSettingModel
// logo?: string → treats the value as logoId directly (existing logo)
export function useCreateExportSetting() {
  const queryClient = useQueryClient();
  const createLogo = useCreateLogo();
  return useMutation<{ setting: ExportSettingModel; logoId?: string; logoBytes?: LogoBytesModel }, ApiError, { body: CreateExportSettingModel; logo?: File | string }>({
    mutationFn: async ({ body, logo }) => {
      let logoId = body.logoId;
      let logoBytes: LogoBytesModel | undefined;

      if (logo instanceof File) {
        const uploaded = await createLogo.mutateAsync(logo);
        logoId = uploaded.id;
        logoBytes = uploaded;
      } else if (typeof logo === 'string') {
        logoId = logo;
      }

      const { data: setting } = await fetchClient.post<ExportSettingModel>(API.exportSetting.list(), { ...body, logoId });
      return { setting, logoId, logoBytes };
    },
    onSuccess: ({ setting, logoId, logoBytes }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
      queryClient.setQueryData<ExportSettingModel>(queryKeys.exportSetting.byId(setting.id), setting);
      if (logoBytes && logoId) {
        queryClient.setQueryData<LogoBytesModel>(queryKeys.logo.byExportSettingId(setting.id), logoBytes);
      }
    },
  });
}

// logo?: File  → creates logo first (via useCreateLogo), links logoId via PATCH
// logo?: string → treats the value as logoId directly
export function useUpdateExportSetting() {
  const queryClient = useQueryClient();
  const createLogo = useCreateLogo();
  return useMutation<{ setting: ExportSettingModel; logoId?: string; logoBytes?: LogoBytesModel }, ApiError, { id: string; body: Omit<UpdateExportSettingModel, 'id'>; logo?: File | string }>({
    mutationFn: async ({ id, body, logo }) => {
      let logoId = body.logoId;
      let logoBytes: LogoBytesModel | undefined;

      if (logo instanceof File) {
        const uploaded = await createLogo.mutateAsync(logo);
        logoId = uploaded.id;
        logoBytes = uploaded;
      } else if (typeof logo === 'string') {
        logoId = logo;
      }

      const { data: setting } = await fetchClient.patch<ExportSettingModel>(API.exportSetting.byId(id), { ...body, logoId });
      return { setting, logoId, logoBytes };
    },
    onSuccess: ({ setting, logoId, logoBytes }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.all() });
      queryClient.setQueryData<ExportSettingModel>(queryKeys.exportSetting.byId(setting.id), setting);
      if (logoBytes && logoId) {
        queryClient.setQueryData<LogoBytesModel>(queryKeys.logo.byExportSettingId(setting.id), logoBytes);
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

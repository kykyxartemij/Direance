'use client';

import { useSuspenseQuery, useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
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

export function useGetLightExportSettings(
  options?: Omit<UseQueryOptions<ExportSettingLightModel[], ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ExportSettingLightModel[], ApiError>({
    queryKey: queryKeys.exportSetting.light(),
    queryFn: async () => {
      const { data } = await fetchClient.get<ExportSettingLightModel[]>(API.exportSetting.light());
      return data;
    },
    ...options,
  });
}

export function useGetPagedExportSettings(
  page: number,
  pageSize: number,
  freeText?: string,
  options?: Omit<UseQueryOptions<PaginatedResponse<ExportSettingModel>, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<PaginatedResponse<ExportSettingModel>, ApiError>({
    queryKey: queryKeys.exportSetting.paged(page, pageSize, freeText),
    queryFn: async () => {
      const { data } = await fetchClient.get<PaginatedResponse<ExportSettingModel>>(
        API.exportSetting.paged(page, pageSize, freeText)
      );
      return data;
    },
    ...options,
  });
}

export function useGetExportSettingById(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ExportSettingModel, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ExportSettingModel, ApiError>({
    queryKey: queryKeys.exportSetting.byId(id!),
    queryFn: async () => {
      const { data } = await fetchClient.get<ExportSettingModel>(API.exportSetting.byId(id!));
      return data;
    },
    enabled: !!id,
    ...options,
  });
}

// ==== Mutations ====

type CreateExportSettingResult = { setting: ExportSettingModel; logoId?: string | null; logoBytes?: LogoBytesModel };

// logo?: File  → creates logo first (via useCreateLogo), links logoId to the new ExportSettingModel
// logo?: string → treats the value as logoId directly (existing logo)
export function useCreateExportSetting(
  options?: Omit<UseMutationOptions<CreateExportSettingResult, ApiError, { body: CreateExportSettingModel; logo?: File | string }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  const createLogo = useCreateLogo();
  return useMutation<CreateExportSettingResult, ApiError, { body: CreateExportSettingModel; logo?: File | string }>({
    ...options,
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
    onSuccess: (result, ...rest) => {
      const { setting, logoId, logoBytes } = result;
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.lists() });
      queryClient.setQueryData<ExportSettingModel>(queryKeys.exportSetting.byId(setting.id), setting);
      if (logoBytes && logoId) {
        queryClient.setQueryData<LogoBytesModel>(queryKeys.logo.byExportSettingId(setting.id), logoBytes);
      }
      options?.onSuccess?.(result, ...rest);
    },
  });
}

type UpdateExportSettingResult = { setting: ExportSettingModel; logoId?: string | null; logoBytes?: LogoBytesModel };

// logo?: File  → creates logo first (via useCreateLogo), links logoId via PATCH
// logo?: string → treats the value as logoId directly
export function useUpdateExportSetting(
  options?: Omit<UseMutationOptions<UpdateExportSettingResult, ApiError, { id: string; body: Omit<UpdateExportSettingModel, 'id'>; logo?: File | string }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  const createLogo = useCreateLogo();
  return useMutation<UpdateExportSettingResult, ApiError, { id: string; body: Omit<UpdateExportSettingModel, 'id'>; logo?: File | string }>({
    ...options,
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
    onSuccess: (result, ...rest) => {
      const { setting, logoId, logoBytes } = result;
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.lists() });
      queryClient.setQueryData<ExportSettingModel>(queryKeys.exportSetting.byId(setting.id), setting);
      if (logoBytes && logoId) {
        queryClient.setQueryData<LogoBytesModel>(queryKeys.logo.byExportSettingId(setting.id), logoBytes);
      }
      options?.onSuccess?.(result, ...rest);
    },
  });
}

export function useDeleteExportSetting(
  options?: Omit<UseMutationOptions<void, ApiError, string>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    ...options,
    mutationFn: async (id) => {
      await fetchClient.delete(API.exportSetting.byId(id));
    },
    onSuccess: (data, id, ...rest) => {
      queryClient.removeQueries({ queryKey: queryKeys.exportSetting.byId(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.lists() });
      options?.onSuccess?.(data, id, ...rest);
    },
  });
}

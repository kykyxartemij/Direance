'use client';

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { UserModel, UpdateUserModel } from '@/models/user.models';
import type { DbConsumption } from '@/lib/userLimits';
import type { ApiError } from '@/models/api-error';
import type { PaginatedResponse } from '@/models/paginated-response.model';

export type { DbConsumption }; // Should be model folder to model. FE don't call BE models directly. new file db-consumption.model.ts should be created

export function useCurrentUser(options?: Omit<UseQueryOptions<UserModel, ApiError>, 'queryKey' | 'queryFn'>) {
  return useQuery<UserModel, ApiError>({
    queryKey: queryKeys.user.me(),
    queryFn: async () => {
      const { data } = await fetchClient.get<UserModel>(API.user.me());
      return data;
    },
    ...options,
  });
}

export function useUpdateUser(
  options?: Omit<UseMutationOptions<UserModel, ApiError, UpdateUserModel>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<UserModel, ApiError, UpdateUserModel>({
    ...options,
    mutationFn: async (body) => {
      const { data } = await fetchClient.patch<UserModel>(API.user.update(), body);
      return data;
    },
    onSuccess: (data, ...rest) => {
      queryClient.setQueryData<UserModel>(queryKeys.user.me(), data);
      queryClient.setQueryData<UserModel>(queryKeys.user.byId(data.id), data);
      options?.onSuccess?.(data, ...rest);
    },
  });
}

export function useGetDbConsumption(
  options?: Omit<UseQueryOptions<DbConsumption, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<DbConsumption, ApiError>({
    queryKey: queryKeys.user.dbConsumption(),
    queryFn: async () => {
      const { data } = await fetchClient.get<DbConsumption>(API.user.dbConsumption());
      return data;
    },
    ...options,
  });
}

export function useGetPagedUsers(
  page: number,
  pageSize: number,
  freeText?: string,
  options?: Omit<UseQueryOptions<PaginatedResponse<UserModel>, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<PaginatedResponse<UserModel>, ApiError>({
    queryKey: queryKeys.users.paged(page, pageSize, freeText),
    queryFn: async () => {
      const { data } = await fetchClient.get<PaginatedResponse<UserModel>>(API.users.paged(page, pageSize, freeText));
      return data;
    },
    ...options,
  });
}

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { UserModel, UpdateUserModel } from '@/models/user.models';
import type { DbConsumption } from '@/lib/userLimits';
import type { ApiError } from '@/models/api-error';

export type { DbConsumption };

export function useCurrentUser() {
  return useQuery<UserModel, ApiError>({
    queryKey: queryKeys.user.me(),
    queryFn: async () => {
      const { data } = await fetchClient.get<UserModel>(API.user.me());
      return data;
    },
  });
}

export function useGetDbConsumption() {
  return useQuery<DbConsumption, ApiError>({
    queryKey: queryKeys.user.dbConsumption(),
    queryFn: async () => {
      const { data } = await fetchClient.get<DbConsumption>(API.user.dbConsumption());
      return data;
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation<UserModel, ApiError, UpdateUserModel>({
    mutationFn: async (body) => {
      const { data } = await fetchClient.patch<UserModel>(API.user.update(), body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.invalidate.all() });
    },
  });
}

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/lib/axiosClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { UserModel, UserUpdateModel } from '@/models/user.models';
import type { ApiError } from '@/models/api-error';

export function useCurrentUser() {
  return useQuery<UserModel, ApiError>({
    queryKey: queryKeys.user.me(),
    queryFn: async () => {
      const { data } = await axiosClient.get<UserModel>(API.user.me());
      return data;
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation<UserModel, ApiError, UserUpdateModel>({
    mutationFn: async (body) => {
      const { data } = await axiosClient.patch<UserModel>(API.user.update(), body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.invalidate.all() });
    },
  });
}

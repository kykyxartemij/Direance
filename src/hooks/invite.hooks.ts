'use client';

import { useMutation, useQuery, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { API } from '@/lib/apiUrl';
import { queryKeys } from '@/lib/queryKeys';
import type { AcceptInviteModel, SendInviteModel } from '@/models/invite.models';
import type { ApiError } from '@/models/api-error';

// ==== Queries ====

export function useLookupInvite(
  token: string,
  options?: Omit<UseQueryOptions<{ email: string }, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<{ email: string }, ApiError>({
    queryKey: queryKeys.invite.lookup(token),
    queryFn: async () => {
      const { data } = await fetchClient.get<{ email: string }>(API.invite.lookup(token));
      return data;
    },
    enabled: !!token,
    retry: false,
    ...options,
  });
}

// ==== Mutations ====

// Error/success snackbars are opt-in via `meta` at the call site (GlobalMutationSnackbar
// reads it), not baked in here — the same hook gets reused with different messaging needs.

export function useSendInvite(
  options?: Omit<UseMutationOptions<void, ApiError, SendInviteModel>, 'mutationFn'>
) {
  return useMutation<void, ApiError, SendInviteModel>({
    ...options,
    mutationFn: async (body) => {
      await fetchClient.post(API.invite.send(), body);
    },
  });
}

export function useAcceptInvite(
  options?: Omit<UseMutationOptions<void, ApiError, AcceptInviteModel>, 'mutationFn'>
) {
  return useMutation<void, ApiError, AcceptInviteModel>({
    ...options,
    mutationFn: async (body) => {
      await fetchClient.post(API.invite.accept(), body);
    },
  });
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { API } from '@/lib/apiUrl';
import { queryKeys } from '@/lib/queryKeys';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import type { AcceptInviteModel, SendInviteModel, InviteLimitsModel } from '@/models/invite.models';
import type { ApiError } from '@/models/api-error';

// ==== Queries ====

export function useGetInviteLimits() {
  return useQuery<InviteLimitsModel, ApiError>({
    queryKey: queryKeys.invite.limits(),
    queryFn: async () => {
      const { data } = await fetchClient.get<InviteLimitsModel>(API.invite.limits());
      return data;
    },
  });
}

export function useLookupInvite(token: string) {
  return useQuery<{ email: string }, ApiError>({
    queryKey: queryKeys.invite.lookup(token),
    queryFn: async () => {
      const { data } = await fetchClient.get<{ email: string }>(API.invite.lookup(token));
      return data;
    },
    enabled: !!token,
    retry: false,
  });
}

// ==== Mutations ====

// Hooks own snackbar error reporting so call sites stay free of try/catch.
// Success messages stay at the call site because they often need request-time data
// (e.g. the invited email) that the hook can't formulate generically.

export function useSendInvite() {
  const queryClient = useQueryClient();
  const { enqueueError } = useArtSnackbar();
  return useMutation<void, ApiError, SendInviteModel>({
    mutationFn: async (body) => {
      await fetchClient.post(API.invite.send(), body);
    },
    onSuccess: () => {
      // BE already invalidated cache; bust the client copy so the stats panel re-fetches.
      queryClient.invalidateQueries({ queryKey: queryKeys.invite.limits() });
    },
    onError: (err) => enqueueError(err, 'Failed to send invite'),
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  const { enqueueError } = useArtSnackbar();
  return useMutation<void, ApiError, AcceptInviteModel>({
    mutationFn: async (body) => {
      await fetchClient.post(API.invite.accept(), body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invite.limits() }),
    onError: (err) => enqueueError(err, 'Failed to accept invite'),
  });
}

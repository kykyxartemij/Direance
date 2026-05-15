'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { API } from '@/lib/apiUrl';
import { queryKeys } from '@/lib/queryKeys';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import type { AcceptInviteModel, SendInviteModel } from '@/models/invite.models';
import type { ApiError } from '@/models/api-error';

// ==== Queries ====

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
  const { enqueueError } = useArtSnackbar();
  return useMutation<void, ApiError, SendInviteModel>({
    mutationFn: async (body) => {
      await fetchClient.post(API.invite.send(), body);
    },
    onError: (err) => enqueueError(err, 'Failed to send invite'),
  });
}

export function useAcceptInvite() {
  const { enqueueError } = useArtSnackbar();
  return useMutation<void, ApiError, AcceptInviteModel>({
    mutationFn: async (body) => {
      await fetchClient.post(API.invite.accept(), body);
    },
    onError: (err) => enqueueError(err, 'Failed to accept invite'),
  });
}

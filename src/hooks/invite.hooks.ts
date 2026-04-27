'use client';

import { useMutation } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { API } from '@/lib/apiUrl';
import type { SendInviteModel } from '@/models/invite.models';
import type { ApiError } from '@/models/api-error';

export function useSendInvite() {
  return useMutation<void, ApiError, SendInviteModel>({
    mutationFn: async (body) => {
      await fetchClient.post(API.invite.send(), body);
    },
  });
}

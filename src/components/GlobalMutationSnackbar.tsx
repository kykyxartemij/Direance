'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import type { ApiError } from '@/models/api-error';

/**
 * Fires ArtSnackbar toasts for any mutation whose `meta.errorMessage` / `meta.successMessage`
 * is set — set at the call site (not inside the hook, so one hook can serve different pages
 * with different messages). errorMessage: true uses the caught ApiError's own message.
 */
export default function GlobalMutationSnackbar() {
  const queryClient = useQueryClient();
  const { enqueueError, enqueueSuccess } = useArtSnackbar();

  const handlersRef = useRef({ enqueueError, enqueueSuccess });
  useEffect(() => {
    handlersRef.current = { enqueueError, enqueueSuccess };
  });

  useEffect(() => {
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated') return;

      const meta = event.mutation.meta;

      if (event.action.type === 'error' && meta?.errorMessage) {
        const flag = meta.errorMessage;
        handlersRef.current.enqueueError(
          event.mutation.state.error as ApiError,
          typeof flag === 'string' ? flag : undefined,
        );
      }

      if (event.action.type === 'success' && meta?.successMessage) {
        handlersRef.current.enqueueSuccess(meta.successMessage as string);
      }
    });
  }, [queryClient]);

  return null;
}

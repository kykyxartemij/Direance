'use client';

import { useQuery } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import type { ApiError } from '@/models/api-error';
import type { DbStats } from '@/models/admin.models';

// ==== Queries ====

export function useGetDbStats() {
  return useQuery<DbStats, ApiError>({
    queryKey: queryKeys.admin.dbStats(),
    queryFn: async () => {
      const { data } = await fetchClient.get<DbStats>(API.admin.dbStats());
      return data;
    },
  });
}

'use client';

import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { exportToExcel, type ExportExcelOptions } from '@/page/reports/exportExcel';
import type { ApiError } from '@/models/api-error';

// ==== Types ====

export type ExportExcelInput = ExportExcelOptions;

// ==== Mutations ====

export function useExportExcel(
  options?: Omit<UseMutationOptions<void, ApiError, ExportExcelInput>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, ExportExcelInput>({
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['placeholder'] });
      options?.onSuccess?.(...args);
    },
    mutationFn: exportToExcel,
  });
}

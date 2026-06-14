'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exportToExcel } from '@/page/dashboard/exportExcel';
import type { ApiError } from '@/models/api-error';
import type { ExportSettingResolvedModel } from '@/models/export-settings.models';
import type { TotalColumnInfo } from '@/page/mapping/applyMapping';
import type { ArtColor } from '@/components/ui/art.types';
import type { Row } from '@/page/dashboard/combineReports';
import type * as XLSX from 'xlsx';

// ==== Types ====

export type ExportExcelInput = {
  headers: string[];
  rows: Row[];
  rowIndents: number[];
  rowColors?: (ArtColor | undefined)[];
  valueColorByHeader?: Record<string, ArtColor | undefined>[];
  exportSettings?: ExportSettingResolvedModel | null;
  originalWorkbooks?: { name: string; workbook: XLSX.WorkBook; skippedSheets?: string[] }[];
  placeholders?: Record<string, string>;
  fileName?: string;
  totalColumns?: TotalColumnInfo[];
};

// ==== Mutations ====

export function useExportExcel() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, ExportExcelInput>({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['excel-export'] }),
    mutationFn: ({
      headers,
      rows,
      rowIndents,
      rowColors,
      valueColorByHeader,
      exportSettings,
      originalWorkbooks,
      placeholders,
      fileName,
      totalColumns,
    }) =>
      exportToExcel(
        headers,
        rows,
        rowIndents,
        rowColors,
        valueColorByHeader,
        exportSettings,
        originalWorkbooks,
        placeholders,
        fileName,
        totalColumns,
      ),
  });
}

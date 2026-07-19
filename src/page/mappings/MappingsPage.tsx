'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useGetPagedMappings, useDeleteMapping } from '@/hooks/mapping.hooks';
import type { MappingModel, ReportType } from '@/models/mapping.models';
import { REPORT_TYPE_LABELS, REPORT_TYPE_OPTIONS } from '@/models/mapping.models';
import type { ArtColumn } from '@/components/ui/ArtDataTable';
import ArtData from '@/components/ui/ArtData';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtButton from '@/components/ui/ArtButton';
import ArtSelect from '@/components/ui/ArtSelect';
import { ArtConfirmDialog } from '@/components/ui/ArtDialog';
import { FSLink } from '@/components/FSLink';
import { HREF } from '@/lib/hrefUrl';

// ==== Constants ====

const PAGE_SIZE = 20;

// ==== Page ====

export default function MappingsPage() {
  const { page, search, filters, setFilter, clearFilters, dataProps } = useUrlFilters(['reportType'] as const);
  const { data: pagedData, isLoading } = useGetPagedMappings(page, PAGE_SIZE, search, {
    reportType: (filters.reportType as ReportType | null) ?? undefined,
  });
  const deleteMutation = useDeleteMapping();

  const selectedReportType = REPORT_TYPE_OPTIONS.find((o) => o.value === filters.reportType) ?? null;

  // Stable reference required — a fresh element every render trips react-doctor/jsx-no-jsx-as-prop.
  const reportTypeFilter = useMemo(
    () => (
      <ArtSelect
        label="Report type"
        options={REPORT_TYPE_OPTIONS}
        selected={selectedReportType}
        onChange={(opt) => setFilter('reportType', opt?.value ?? null)}
        clearable
      />
    ),
    [selectedReportType, setFilter],
  );

  const columns: ArtColumn<MappingModel>[] = [
    {
      key: 'name',
      label: 'Name',
      sizing: { width: 180, renderLoading: true },
      render: (row) => row.name,
    },
    {
      key: 'reportType',
      label: 'Report Type',
      sizing: { width: 180, renderLoading: true },
      render: (row) => REPORT_TYPE_LABELS[row.reportType] ?? row.reportType,
    },
    {
      key: 'isGlobal',
      label: 'Global',
      sizing: { width: 100, renderLoading: true },
      render: (row) => (row.isGlobal ? <ArtBadge size="sm" color="primary">Global</ArtBadge> : null),
    },
    {
      key: 'exportSetting',
      label: 'Export Config',
      sizing: { width: 300, renderLoading: true },
      render: (row) => row.exportSetting?.name ?? '',
    },
    {
      key: 'actions',
      label: '',
      sizing: { renderLoading: true },
      render: (row) =>
        row.isGlobal ? null : (
          <div className="flex gap-2">
            <FSLink href={HREF.mappingById(row.id)}>
              <ArtButton variant="ghost">Edit</ArtButton>
            </FSLink>
            <ArtConfirmDialog
              title="Delete mapping"
              description={`Are you sure you want to delete "${row.name}"?`}
              onConfirm={() => deleteMutation.mutate(row.id)}
              confirmLabel="Delete"
            >
              <ArtButton variant="ghost" color="danger">Delete</ArtButton>
            </ArtConfirmDialog>
          </div>
        ),
    },
  ];

  return (
    <ArtData<MappingModel>
        columns={columns}
        data={pagedData?.data ?? []}
        rowKey={(row) => row.id}
        emptyMessage="No mappings yet. Upload a report to create one."
        pageSize={PAGE_SIZE}
        total={pagedData?.total ?? 0}
        searchPlaceholder="Search mappings…"
        loading={isLoading}
        rowHeight={39}
        advancedFilters={reportTypeFilter}
        onClearFilters={clearFilters}
        {...dataProps}
      />
  );
}

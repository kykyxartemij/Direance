'use client';

import Link from 'next/link';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useGetPagedExportSettings, useDeleteExportSetting } from '@/hooks/export-settings.hooks';
import type { ExportSettingModel } from '@/models/export-settings.models';
import type { ArtColumn } from '@/components/ui/ArtDataTable';
import ArtData from '@/components/ui/ArtData';
import ArtButton from '@/components/ui/ArtButton';
import { ArtConfirmDialog } from '@/components/ui/ArtDialog';
import { HREF } from '@/lib/hrefUrl';
import { FSLink } from '@/components/FSLink';

// ==== Constants ====

const PAGE_SIZE = 20;

// ==== Page ====

export default function ExportSettingsListPage() {
  const { page, search, dataProps } = useUrlFilters([]);
  const { data: pagedData, isLoading } = useGetPagedExportSettings(page, PAGE_SIZE, search);
  const deleteMutation = useDeleteExportSetting();

  const columns: ArtColumn<ExportSettingModel>[] = [
    {
      key: 'name',
      label: 'Name',
      sizing: { renderLoading: true },
      render: (row) => row.name,
    },
    {
      key: 'tableStartsFrom',
      label: 'Table Starts From',
      sizing: { width: 160, renderLoading: true },
      render: (row) => row.headerLayout?.dataStartCell ?? '—',
    },
    {
      key: 'valueCategories',
      label: 'Value Categories',
      sizing: { width: 200, renderLoading: true },
      render: (row) => {
        const values = row.mappedValues ?? [];
        const names = values.map((v) => v.name);
        return names.length > 0
          ? names.slice(0, 4).join(', ') + (names.length > 4 ? `… +${names.length - 4}` : '')
          : '—';
      },
    },
    {
      key: 'actions',
      label: '',
      sizing: { width: 140 },
      render: (row) => (
        <div className="flex gap-2">
          <FSLink href={HREF.exportSettingById(row.id)}>
            <ArtButton variant="ghost">Edit</ArtButton>
          </FSLink>
          <ArtConfirmDialog
            title="Delete export setting"
            description={`Delete "${row.name}"?`}
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
    <ArtData<ExportSettingModel>
      columns={columns}
      data={pagedData?.data ?? []}
      rowKey={(row) => row.id}
      emptyMessage="No export configs yet."
      pageSize={PAGE_SIZE}
      total={pagedData?.total ?? 0}
      searchPlaceholder="Search configs…"
      loading={isLoading}
      {...dataProps}
    />
  );
}

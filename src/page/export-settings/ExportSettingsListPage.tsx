'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGetPagedExportSettings, useDeleteExportSetting } from '@/hooks/export-settings.hooks';
import type { ExportSettingModel } from '@/models/export-settings.models';
import type { ArtColumn } from '@/components/ui/ArtDataTable';
import ArtData from '@/components/ui/ArtData';
import ArtButton from '@/components/ui/ArtButton';
import { ArtConfirmDialog } from '@/components/ui/ArtDialog';

// ==== Constants ====

const PAGE_SIZE = 20;

// ==== Page ====

export default function ExportSettingsListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data: pagedData, isLoading } = useGetPagedExportSettings(page, PAGE_SIZE);
  const deleteMutation = useDeleteExportSetting();

  const columns: ArtColumn<ExportSettingModel>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => row.name,
    },
    {
      key: 'tableStartsFrom',
      label: 'Table Starts From',
      width: 160,
      render: (row) => row.headerLayout?.dataStartCell ?? '—',
    },
    {
      key: 'valueCategories',
      label: 'Value Categories',
      width: 200,
      render: (row) => row.mappedValueNames.length > 0
        ? row.mappedValueNames.slice(0, 4).join(', ') + (row.mappedValueNames.length > 4 ? `… +${row.mappedValueNames.length - 4}` : '')
        : '—',
    },
    {
      key: 'actions',
      label: '',
      width: 140,
      render: (row) => (
        <div className="flex gap-2">
          <ArtButton variant="ghost" onClick={() => router.push(`/export-settings/${row.id}`)}>
            Edit
          </ArtButton>
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
    <div className="mx-auto max-w-5xl py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Export Settings</h1>
        <ArtButton color="primary" onClick={() => router.push('/export-settings/new')}>
          New config
        </ArtButton>
      </div>

      <ArtData<ExportSettingModel>
        columns={columns}
        data={pagedData?.data ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyMessage="No export configs yet."
        pageSize={PAGE_SIZE}
        total={pagedData?.total}
        page={page}
        onPageChange={setPage}
        searchPlaceholder="Search configs…"
      />
    </div>
  );
}

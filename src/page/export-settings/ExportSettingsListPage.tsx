'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  const [page, setPage] = useState(1);
  const { data: pagedData } = useGetPagedExportSettings(page, PAGE_SIZE);
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
          <Link href={`/export-settings/${row.id}`} prefetch>
            <ArtButton variant="ghost">Edit</ArtButton>
          </Link>
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
    <>
      <div className="flex justify-end mb-6">
        <Link href="/export-settings/new" prefetch>
          <ArtButton color="primary">New config</ArtButton>
        </Link>
      </div>
      <ArtData<ExportSettingModel>
        columns={columns}
        data={pagedData.data}
        rowKey={(row) => row.id}
        emptyMessage="No export configs yet."
        pageSize={PAGE_SIZE}
        total={pagedData.total}
        page={page}
        onPageChange={setPage}
        searchPlaceholder="Search configs…"
      />
    </>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useGetPagedMappings, useDeleteMapping } from '@/hooks/mapping.hooks';
import type { MappingModel, ReportType } from '@/models/mapping.models';
import type { ArtColumn } from '@/components/ui/ArtDataTable';
import ArtData from '@/components/ui/ArtData';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtButton from '@/components/ui/ArtButton';
import { ArtConfirmDialog } from '@/components/ui/ArtDialog';
import { FSLink } from '@/components/FSLink';
import { HREF } from '@/lib/hrefUrl';

// ==== Constants ====

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  pnl: 'Profit & Loss',
  financial_position: 'Financial Position',
};

const PAGE_SIZE = 20;

// ==== Page ====

export default function MappingsPage() {
  const [page, setPage] = useState(1);
  const [freeText, setFreeText] = useState('');
  const { data: pagedData, isLoading } = useGetPagedMappings(page, PAGE_SIZE, freeText);

  function handleSearch(value: string) {
    setFreeText(value);
    setPage(1);
  }
  const deleteMutation = useDeleteMapping();

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
        page={page}
        onPageChange={setPage}
        searchPlaceholder="Search mappings…"
        onSearch={handleSearch}
        loading={isLoading}
        rowHeight={39}
      />
  );
}

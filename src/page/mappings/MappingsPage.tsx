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

// ==== Constants ====

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  pnl: 'Profit & Loss',
  financial_position: 'Financial Position',
};

const PAGE_SIZE = 20;

// ==== Page ====

export default function MappingsPage() {
  const [page, setPage] = useState(1);
  const { data: pagedData } = useGetPagedMappings(page, PAGE_SIZE);
  const deleteMutation = useDeleteMapping();

  const columns: ArtColumn<MappingModel>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span>{row.name}</span>
          {row.isGlobal && <ArtBadge size="sm" color="primary">Global</ArtBadge>}
        </div>
      ),
    },
    {
      key: 'reportType',
      label: 'Report Type',
      width: 180,
      render: (row) => REPORT_TYPE_LABELS[row.reportType] ?? row.reportType,
    },
    {
      key: 'exportSetting',
      label: 'Export Config',
      width: 180,
      render: (row) => row.exportSetting?.name ?? '—',
    },
    {
      key: 'actions',
      label: '',
      width: 140,
      render: (row) =>
        row.isGlobal ? null : (
          <div className="flex gap-2">
            <Link href={`/mappings/${row.id}`} prefetch>
              <ArtButton variant="ghost">Edit</ArtButton>
            </Link>
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
        data={pagedData.data}
        rowKey={(row) => row.id}
        emptyMessage="No mappings yet. Upload a report to create one."
        pageSize={PAGE_SIZE}
        total={pagedData.total}
        page={page}
        onPageChange={setPage}
        searchPlaceholder="Search mappings…"
      />
  );
}

'use client';

import { useState } from 'react';
import { useGetPagedConnections, useDeleteConnection } from '@/hooks/connection.hooks';
import type { ConnectionModel } from '@/models/connection.models';
import type { ArtColumn } from '@/components/ui/ArtDataTable';
import ArtData from '@/components/ui/ArtData';
import ArtButton from '@/components/ui/ArtButton';
import { ArtConfirmDialog } from '@/components/ui/ArtDialog';
import { HREF } from '@/lib/hrefUrl';
import { FSLink } from '@/components/FSLink';

// ==== Constants ====

const PAGE_SIZE = 20;

// ==== Page ====

export default function ConnectionsListPage() {
  const [page, setPage] = useState(1);
  const [freeText, setFreeText] = useState('');
  const { data: pagedData, isLoading } = useGetPagedConnections(page, PAGE_SIZE, freeText);

  function handleSearch(value: string) {
    setFreeText(value);
    setPage(1);
  }
  const deleteMutation = useDeleteConnection();

  const columns: ArtColumn<ConnectionModel>[] = [
    {
      key: 'name',
      label: 'Name',
      sizing: { renderLoading: true },
      render: (row) => row.name,
    },
    {
      key: 'type',
      label: 'Type',
      sizing: { width: 120, renderLoading: true },
      render: (row) => row.type?.toUpperCase() ?? '—',
    },
    {
      key: 'mapping',
      label: 'Mapping',
      sizing: { width: 200, renderLoading: true },
      render: (row) => row.mapping?.name ?? '—',
    },
    {
      key: 'actions',
      label: '',
      sizing: { width: 140 },
      render: (row) => (
        <div className="flex gap-2">
          <FSLink href={HREF.connectionById(row.id)}>
            <ArtButton variant="ghost">Edit</ArtButton>
          </FSLink>
          <ArtConfirmDialog
            title="Delete connection"
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
    <ArtData<ConnectionModel>
      columns={columns}
      data={pagedData?.data ?? []}
      rowKey={(row) => row.id}
      emptyMessage="No connections yet."
      pageSize={PAGE_SIZE}
      total={pagedData?.total ?? 0}
      page={page}
      onPageChange={setPage}
      searchPlaceholder="Search connections…"
      onSearch={handleSearch}
      loading={isLoading}
    />
  );
}

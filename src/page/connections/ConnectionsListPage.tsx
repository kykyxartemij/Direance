'use client';

import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useGetPagedConnections, useDeleteConnection } from '@/hooks/connection.hooks';
import type { ConnectionModel } from '@/models/connection.models';
import { CONNECTION_TYPE_LABELS } from '@/models/connection.models';
import type { ArtColumn } from '@/components/ui/ArtDataTable';
import ArtData from '@/components/ui/ArtData';
import ArtButton from '@/components/ui/ArtButton';
import { ArtConfirmDialog } from '@/components/ui/ArtDialog';
import { HREF } from '@/lib/hrefUrl';
import { FSLink } from '@/components/FSLink';

// ==== Constants ====

const PAGE_SIZE = 20;

// ==== Helpers ====

function formatTypeLabel(row: ConnectionModel): string {
  return CONNECTION_TYPE_LABELS[row.type] ?? row.type?.toUpperCase() ?? '—';
}

// ==== Page ====

export default function ConnectionsListPage() {
  const { page, search, dataProps } = useUrlFilters([]);
  const { data: pagedData, isLoading } = useGetPagedConnections(page, PAGE_SIZE, search);
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
      render: formatTypeLabel,
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
      searchPlaceholder="Search connections…"
      loading={isLoading}
      {...dataProps}
    />
  );
}

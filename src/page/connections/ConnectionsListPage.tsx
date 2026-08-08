'use client';

import { useMemo } from 'react';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useGetPagedConnections, useDeleteConnection } from '@/hooks/connection.hooks';
import type { ConnectionModel, ConnectionType } from '@/models/connection.models';
import { CONNECTION_TYPES, CONNECTION_TYPE_LABELS, ConnectionFilterValidator } from '@/models/connection.models';
import { REPORT_TYPE_OPTIONS, type ReportType } from '@/models/mapping.models';
import type { ArtColumn } from '@/components/ui/ArtDataTable/types';
import ArtData from '@/components/ui/ArtData';
import ArtButton from '@/components/ui/ArtButton';
import ArtSelect from '@/components/ui/ArtSelect';
import { ArtConfirmDialog } from '@/components/ui/ArtDialog';
import { HREF } from '@/lib/hrefUrl';
import { FSLink } from '@/components/FSLink';

// ==== Constants ====

const PAGE_SIZE = 20;

const CONNECTION_TYPE_OPTIONS = CONNECTION_TYPES.map((t) => ({ label: CONNECTION_TYPE_LABELS[t], value: t }));

// ==== Helpers ====

function formatTypeLabel(row: ConnectionModel): string {
  return CONNECTION_TYPE_LABELS[row.type] ?? row.type?.toUpperCase() ?? '';
}

// ==== Page ====

export default function ConnectionsListPage() {
  const { page, search, filters, setFilter, clearFilters, dataProps } = useUrlFilters(ConnectionFilterValidator);
  const { data: pagedData, isLoading } = useGetPagedConnections(page, PAGE_SIZE, search, {
    type: (filters.type as ConnectionType | null) ?? undefined,
    reportType: (filters.reportType as ReportType | null) ?? undefined,
  });
  const deleteMutation = useDeleteConnection();

  const selectedType = CONNECTION_TYPE_OPTIONS.find((o) => o.value === filters.type) ?? null;
  const selectedReportType = REPORT_TYPE_OPTIONS.find((o) => o.value === filters.reportType) ?? null;

  // Stable reference required — a fresh element every render trips react-doctor/jsx-no-jsx-as-prop.
  const advancedFilters = useMemo(
    () => (
      <>
        <ArtSelect
          label="Type"
          options={CONNECTION_TYPE_OPTIONS}
          selected={selectedType}
          onChange={(opt) => setFilter('type', opt?.value ?? null)}
          clearable
        />
        <ArtSelect
          label="Report type"
          options={REPORT_TYPE_OPTIONS}
          selected={selectedReportType}
          onChange={(opt) => setFilter('reportType', opt?.value ?? null)}
          clearable
        />
      </>
    ),
    [selectedType, selectedReportType, setFilter],
  );

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
      render: (row) => row.mapping?.name ?? '',
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
      advancedFilters={advancedFilters}
      onClearFilters={clearFilters}
      {...dataProps}
    />
  );
}

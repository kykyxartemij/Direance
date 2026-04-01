'use client';

import { useState } from 'react';
import { useMappings, useDeleteMapping, useUpdateMapping } from '@/hooks/mapping.hooks';
import type { MappingModel, ReportType } from '@/models/mapping.models';
import type { ArtSelectOption } from '@/components/ui/ArtSelect';
import ArtDataTable, { type ArtColumn } from '@/components/ui/ArtDataTable';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtButton from '@/components/ui/ArtButton';
import ArtInput from '@/components/ui/ArtInput';
import ArtSelect from '@/components/ui/ArtSelect';
import { ArtConfirmDialog, useArtDialog } from '@/components/ui/ArtDialog';

// ==== Constants ====

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  pnl: 'Profit & Loss',
  financial_position: 'Financial Position',
};

const REPORT_TYPE_OPTIONS: ArtSelectOption[] = [
  { label: 'Profit & Loss', value: 'pnl' },
  { label: 'Financial Position', value: 'financial_position' },
];

// ==== Component ====

export default function MappingsPage() {
  const { data: mappings = [], isLoading } = useMappings();
  const deleteMutation = useDeleteMapping();
  const updateMutation = useUpdateMapping();
  const dialog = useArtDialog();

  // ==== Edit dialog ====

  function handleEdit(mapping: MappingModel) {
    let editName = mapping.name;
    let editType = mapping.reportType;

    dialog.show({
      title: 'Edit Mapping',
      content: (
        <div className="flex flex-col gap-4">
          <ArtInput
            label="Name"
            defaultValue={mapping.name}
            onChange={(e) => { editName = e.target.value; }}
          />
          <ArtSelect
            label="Report Type"
            options={REPORT_TYPE_OPTIONS}
            selected={REPORT_TYPE_OPTIONS.find((o) => o.value === mapping.reportType) ?? null}
            onChange={(opt) => { editType = (opt?.value as ReportType) ?? mapping.reportType; }}
          />
        </div>
      ),
      buttons: [
        {
          label: 'Save',
          color: 'primary',
          onClick: async () => {
            await updateMutation.mutateAsync({
              id: mapping.id,
              body: { name: editName, reportType: editType },
            });
          },
        },
      ],
      cancelButton: true,
    });
  }

  // ==== Table columns ====

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
      key: 'createdAt',
      label: 'Created',
      width: 140,
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      width: 160,
      render: (row) =>
        row.isGlobal ? null : (
          <div className="flex gap-2">
            <ArtButton variant="ghost" onClick={() => handleEdit(row)}>
              Edit
            </ArtButton>
            <ArtConfirmDialog
              title="Delete mapping"
              description={`Are you sure you want to delete "${row.name}"?`}
              onConfirm={() => deleteMutation.mutate(row.id)}
              confirmLabel="Delete"
            >
              <ArtButton variant="ghost" color="danger">
                Delete
              </ArtButton>
            </ArtConfirmDialog>
          </div>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="mb-6 text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Mappings
      </h1>

      <ArtDataTable<MappingModel>
        columns={columns}
        data={mappings}
        rowKey={(row) => row.id}
        loading={isLoading}
        emptyMessage="No mappings yet. Upload a report to create one."
      />
    </div>
  );
}

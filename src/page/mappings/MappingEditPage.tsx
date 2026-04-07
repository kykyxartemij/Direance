'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGetMappingById, useUpdateMapping } from '@/hooks/mapping.hooks';
import { useGetPagedExportSettings } from '@/hooks/export-settings.hooks';
import type { MappingModel, ReportType } from '@/models/mapping.models';
import type { ArtSelectOption } from '@/components/ui/ArtSelect';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import ArtForm from '@/components/ui/ArtForm';
import ArtInput from '@/components/ui/ArtInput';
import ArtSelect from '@/components/ui/ArtSelect';
import ArtComboBox from '@/components/ui/ArtComboBox';

// ==== Constants ====

const REPORT_TYPE_OPTIONS: ArtSelectOption[] = [
  { label: 'Profit & Loss', value: 'pnl' },
  { label: 'Financial Position', value: 'financial_position' },
];

// ==== Inner Form ====

function MappingEditForm({ id, mapping }: { id: string; mapping: MappingModel }) {
  const router = useRouter();
  // TODO: Replace with a dedicated GetLight endpoint (flat list, no heavy fields) for ComboBox
  const { data: pagedSettings } = useGetPagedExportSettings(1, 100);
  const exportSettingsList = pagedSettings?.data ?? [];
  const updateMutation = useUpdateMapping();

  const nameRef = useRef<HTMLInputElement>(null);
  const [reportType, setReportType] = useState<ReportType>(mapping.reportType);
  const [exportSettingId, setExportSettingId] = useState<string | null>(mapping.exportSetting?.id ?? null);

  const exportOptions: ArtComboBoxOption[] = exportSettingsList.map((s) => ({
    label: s.name,
    value: s.id,
  }));

  async function handleSubmit() {
    await updateMutation.mutateAsync({
      id,
      body: {
        name: nameRef.current?.value.trim() ?? '',
        reportType,
        exportSettingId: exportSettingId ?? undefined,
      },
    });
    router.push('/mappings');
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-2xl font-semibold mb-8" style={{ color: 'var(--text)' }}>
        Edit Mapping
      </h1>

      <ArtForm
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        buttons={[
          { label: 'Cancel', variant: 'ghost', type: 'button', onClick: () => router.push('/mappings') },
          { label: 'Save', color: 'primary', type: 'submit', loading: updateMutation.isPending },
        ]}
      >
        <ArtInput
          ref={nameRef}
          label="Name"
          defaultValue={mapping.name}
          required
        />

        <ArtSelect
          label="Report Type"
          options={REPORT_TYPE_OPTIONS}
          selected={REPORT_TYPE_OPTIONS.find((o) => o.value === reportType) ?? null}
          onChange={(opt) => setReportType((opt?.value as ReportType) ?? 'pnl')}
        />

        <ArtComboBox
          label="Export Settings"
          options={exportOptions}
          selected={exportOptions.find((o) => o.value === exportSettingId) ?? null}
          onChange={(opt) => setExportSettingId(opt?.value ?? null)}
          placeholder="Link export settings…"
          clearable
        />
      </ArtForm>
    </div>
  );
}

// ==== Component ====

export default function MappingEditPage({ id }: { id: string }) {
  const { data: mapping, isLoading } = useGetMappingById(id);
  if (isLoading || !mapping) return null;
  return <MappingEditForm id={id} mapping={mapping} />;
}

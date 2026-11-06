'use client';

import { useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useGetMappingById, useCreateMapping, useUpdateMapping } from '@/hooks/mapping.hooks';
import { DEFAULT_MAPPING_CONFIG, REPORT_TYPES, type MappingModel, type RowMapping, type SourceLayout } from '@/models/mapping.models';
import { ArtForm, ArtFormInput, ArtFormSelect } from '@/components/form';
import type { ArtSelectOption } from '@/components/ui/ArtSelect';
import ArtDivider from '@/components/ui/ArtDivider';
import { useAuth } from '@/providers/AuthProvider';
import { Permission } from '@/lib/permissions';
import RowMappingsSection, {
  type RowMappingRow,
  type RowMappingsSectionRef,
} from '@/page/mapping/RowMappingsSection';
import MappingMetaSection from '@/page/mapping/MappingMetaSection';
import { REPORT_TYPE_OPTIONS } from '@/models/mapping.models';
import SourceLayoutFormSection, { type LoadedWorkbookState } from '@/page/mapping/SourceLayoutFormSection';
import { extractRowNames } from '@/page/mapping/applyMapping';
import PermissionGuard from '@/components/PermissionGuard';
import PageLoader from '@/components/PageLoader';

// ==== Schema ====
// Only scalar fields are owned by RHF. Row mappings, export setting, and source
// layout are plain useState here — driven by SourceLayoutFormSection/RowMappingsSection.

const schema = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').required('Report type is required'),
  fromCurrency: yup.string().default('EUR'),
  toCurrency: yup.string().default('EUR'),
  visibility: yup.string().oneOf(['personal', 'global']).default('personal'),
});

type FormValues = {
  name: string;
  reportType: 'pnl' | 'financial_position';
  fromCurrency: string;
  toCurrency: string;
  visibility: 'personal' | 'global';
};

const VISIBILITY_OPTIONS: ArtSelectOption[] = [
  { label: 'Personal',                  value: 'personal' },
  { label: 'Global (visible to all)',   value: 'global' },
];

const emptyDefaults: FormValues = {
  name: '',
  reportType: 'pnl',
  fromCurrency: 'EUR',
  toCurrency: 'EUR',
  visibility: 'personal',
};

function mappingToDefaults(mapping: MappingModel): FormValues {
  return {
    name: mapping.name,
    reportType: mapping.reportType,
    fromCurrency: mapping.config.fromCurrency ?? 'EUR',
    toCurrency: mapping.config.currency ?? 'EUR',
    visibility: mapping.isGlobal ? 'global' : 'personal',
  };
}

function rowsFromMapping(mapping?: MappingModel): RowMappingRow[] {
  return (mapping?.config.rowMappings ?? []).map((r, i) => ({ ...r, _index: i }));
}

function mergeRowNames(prev: RowMappingRow[], names: string[]): RowMappingRow[] {
  const bySource = new Map(prev.map((r) => [r.sourceName, r]));
  return names.map((sourceName, i) => {
    const existing = bySource.get(sourceName);
    return existing ? { ...existing, _index: i } : { sourceName, _index: i };
  });
}

// ==== Inner form ====

function MappingFormInner({ id, mapping }: { id?: string; mapping?: MappingModel }) {
  const router = useRouter();
  const isCreating = !id;
  const createMutation = useCreateMapping();
  const updateMutation = useUpdateMapping();
  const { hasPermission } = useAuth();
  const canModifyGlobal = hasPermission(Permission.CAN_MODIFY_GLOBAL);

  const methods = useForm<FormValues>({
    resolver: yupResolver(schema) as Resolver<FormValues>,
    defaultValues: mapping ? mappingToDefaults(mapping) : emptyDefaults,
  });

  const initialExportSettingId = mapping?.exportSetting?.id ?? null;
  const reportType = useWatch({ control: methods.control, name: 'reportType' });

  const [rowMappings, setRowMappings] = useState<RowMappingRow[]>(() => rowsFromMapping(mapping));
  const [loaded, setLoaded] = useState<LoadedWorkbookState | null>(null);
  const rowsSectionRef = useRef<RowMappingsSectionRef>(null);

  function handleWorkbookLoaded(state: LoadedWorkbookState | null) {
    setLoaded(state);
    if (!state) return;
    const primaryName = state.workbook.SheetNames.find((n) => state.sheetsConfig[n]?.mode !== 'skip')
      ?? state.workbook.SheetNames[0];
    const primaryLayout = primaryName ? state.sheetLayouts[primaryName] : undefined;
    if (primaryName && primaryLayout) {
      const names = extractRowNames(state.workbook, primaryName, primaryLayout);
      setRowMappings((prev) => mergeRowNames(prev, names));
    }
  }

  function handleSheetLayoutChange(sheetName: string, layout: SourceLayout) {
    setLoaded((prev) => prev && { ...prev, sheetLayouts: { ...prev.sheetLayouts, [sheetName]: layout } });
  }

  function handleSheetModeChange(sheetName: string, mode: 'combine' | 'skip') {
    setLoaded((prev) => prev && {
      ...prev,
      sheetsConfig: { ...prev.sheetsConfig, [sheetName]: { ...(prev.sheetsConfig[sheetName] ?? { mode: 'combine' }), mode } },
    });
  }

  async function onSave(data: FormValues) {
    const cleanRows: RowMapping[] = rowMappings.flatMap(({ _index, ...rest }) =>
      rest.sourceName.trim().length > 0
        ? [{ ...rest, sourceName: rest.sourceName.trim(), displayName: rest.displayName || undefined }]
        : []
    );

    const primaryName = loaded
      ? loaded.workbook.SheetNames.find((n) => loaded.sheetsConfig[n]?.mode !== 'skip') ?? loaded.workbook.SheetNames[0]
      : undefined;
    const sourceLayout = (primaryName && loaded?.sheetLayouts[primaryName])
      || mapping?.config.sourceLayout
      || DEFAULT_MAPPING_CONFIG.sourceLayout;
    const sheetLayouts = loaded ? loaded.sheetLayouts : mapping?.config.sheetLayouts;
    const sheetsConfig = loaded ? loaded.sheetsConfig : mapping?.config.sheetsConfig;
    const exportSettingId = rowsSectionRef.current?.getExportSettingId() ?? null;

    const config = {
      ...DEFAULT_MAPPING_CONFIG,
      fromCurrency: data.fromCurrency,
      currency: data.toCurrency,
      sourceLayout,
      sheetLayouts,
      sheetsConfig,
      rowMappings: cleanRows,
    };

    const isGlobal = canModifyGlobal ? data.visibility === 'global' : undefined;

    if (isCreating) {
      await createMutation.mutateAsync({
        name: data.name,
        reportType: data.reportType,
        config,
        exportSettingId: exportSettingId ?? undefined,
        isGlobal,
      });
    } else {
      await updateMutation.mutateAsync({
        id: id!,
        body: {
          name: data.name,
          reportType: data.reportType,
          config,
          exportSettingId: exportSettingId ?? undefined,
          isGlobal,
        },
      });
    }
    router.push('/mappings');
  }

  return (
    <ArtForm
      methods={methods}
      onSubmit={onSave}
      buttons={[
        { label: 'Cancel', variant: 'ghost', type: 'button', onClick: () => router.back() },
        {
          label: isCreating ? 'Create' : 'Save',
          color: 'primary',
          type: 'submit',
          loading: createMutation.isPending || updateMutation.isPending,
        },
      ]}
    >
      <ArtDivider label={isCreating ? 'New Mapping' : 'Edit Mapping'} />
      <ArtFormInput name="name" label="Name" required />
      <PermissionGuard permission={Permission.CAN_MODIFY_GLOBAL}>
        <ArtFormSelect
          name="visibility"
          label="Visibility"
          options={VISIBILITY_OPTIONS}
        />
      </PermissionGuard>
      <ArtFormSelect
        name="reportType"
        label="Report Type"
        options={REPORT_TYPE_OPTIONS}
        required
      />
      <MappingMetaSection />
      <SourceLayoutFormSection
        initialLayout={mapping?.config.sourceLayout ?? DEFAULT_MAPPING_CONFIG.sourceLayout}
        initialSheetLayouts={mapping?.config.sheetLayouts}
        initialSheetsConfig={mapping?.config.sheetsConfig}
        loaded={loaded}
        onWorkbookLoaded={handleWorkbookLoaded}
        onSheetLayoutChange={handleSheetLayoutChange}
        onSheetModeChange={handleSheetModeChange}
        reportType={reportType}
      />
      <RowMappingsSection
        ref={rowsSectionRef}
        rowMappings={rowMappings}
        onRowsChange={setRowMappings}
        initialExportSettingId={initialExportSettingId}
        editable
      />
    </ArtForm>
  );
}

// ==== Data loaders ====
// Gate on the fetch before mounting the form — MappingFormInner seeds RHF defaultValues
// from `mapping`, so it must not mount until the record is in hand.

export function MappingFormEdit() {
  const params = useParams();
  const id = params.id as string;
  const { data: mapping, isLoading } = useGetMappingById(id);
  if (isLoading || !mapping) return <PageLoader />;
  return <MappingFormInner id={id} mapping={mapping} />;
}

export function MappingFormCreate() {
  return <MappingFormInner />;
}

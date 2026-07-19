'use client';

import { useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useGetMappingById, useCreateMapping, useUpdateMapping } from '@/hooks/mapping.hooks';
import { DEFAULT_MAPPING_CONFIG, type MappingModel, type RowMapping } from '@/models/mapping.models';
import { ArtForm, ArtFormInput, ArtFormSelect } from '@/components/form';
import type { ArtSelectOption } from '@/components/ui/ArtSelect';
import { useAuth } from '@/providers/AuthProvider';
import { Permission } from '@/lib/permissions';
import RowMappingsSection, {
  type RowMappingRow,
  type RowMappingsSectionRef,
} from '@/page/mapping/RowMappingsSection';
import MappingMetaSection from '@/page/mapping/MappingMetaSection';
import { REPORT_TYPE_OPTIONS } from '@/models/mapping.models';
import FormSection from '@/components/FormSection';
import SourceLayoutFormSection, {
  type SourceLayoutFormSectionRef,
} from '@/page/mapping/SourceLayoutFormSection';
import PermissionGuard from '@/components/PermissionGuard';

// ==== Schema ====
// Only scalar fields are owned by RHF. Row mappings + export setting are
// managed by RowMappingsSection (own state + imperative ref).

const schema = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  reportType: yup
    .string()
    .oneOf(['pnl', 'financial_position'], 'Invalid report type')
    .required('Report type is required'),
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

// ==== Inner form ====

function MappingFormInner({ id, mapping }: { id?: string; mapping?: MappingModel }) {
  const router = useRouter();
  const isCreating = !id;
  const createMutation = useCreateMapping();
  const updateMutation = useUpdateMapping();
  const { hasPermission } = useAuth();
  const canModifyGlobal = hasPermission(Permission.CAN_MODIFY_GLOBAL);

  const rowsSectionRef = useRef<RowMappingsSectionRef>(null);
  const layoutSectionRef = useRef<SourceLayoutFormSectionRef>(null);

  const methods = useForm<FormValues>({
    resolver: yupResolver(schema) as Resolver<FormValues>,
    defaultValues: mapping ? mappingToDefaults(mapping) : emptyDefaults,
  });

  const initialRows = useMemo(() => rowsFromMapping(mapping), [mapping]);
  const initialExportSettingId = mapping?.exportSetting?.id ?? null;
  const reportType = useWatch({ control: methods.control, name: 'reportType' });

  async function onSave(data: FormValues) {
    const collectedRows = rowsSectionRef.current?.getRowMappings() ?? [];
    const cleanRows: RowMapping[] = collectedRows.flatMap(({ _index, ...rest }) =>
      rest.sourceName.trim().length > 0
        ? [{ ...rest, sourceName: rest.sourceName.trim(), displayName: rest.displayName || undefined }]
        : []
    );

    const exportSettingId = rowsSectionRef.current?.getExportSettingId() ?? null;

    const sourceLayout = layoutSectionRef.current?.getSourceLayout()
      ?? mapping?.config.sourceLayout
      ?? DEFAULT_MAPPING_CONFIG.sourceLayout;
    const sheetLayouts = layoutSectionRef.current?.getSheetLayouts()
      ?? mapping?.config.sheetLayouts;
    const sheetsConfig = layoutSectionRef.current?.getSheetsConfig()
      ?? mapping?.config.sheetsConfig;

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
      <FormSection title={isCreating ? 'New Mapping' : 'Edit Mapping'}>
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
      </FormSection>
      <MappingMetaSection />
      <SourceLayoutFormSection
        ref={layoutSectionRef}
        initialLayout={mapping?.config.sourceLayout ?? DEFAULT_MAPPING_CONFIG.sourceLayout}
        initialSheetLayouts={mapping?.config.sheetLayouts}
        initialSheetsConfig={mapping?.config.sheetsConfig}
        reportType={reportType}
      />
      <RowMappingsSection
        ref={rowsSectionRef}
        key={id ?? '__new__'}
        initialRowMappings={initialRows}
        initialExportSettingId={initialExportSettingId}
        editable
      />
    </ArtForm>
  );
}

// ==== Data loaders ====
// useGetMappingById is a useSuspenseQuery — throws while pending, caught by the
// <Suspense> boundary ArtPage provides in page.tsx, above this component.

export function MappingFormEdit() {
  const params = useParams();
  const id = params.id as string;
  const { data: mapping } = useGetMappingById(id);
  return <MappingFormInner id={id} mapping={mapping} />;
}

export function MappingFormCreate() {
  return <MappingFormInner />;
}

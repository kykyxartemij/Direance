'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useGetMappingById, useCreateMapping, useUpdateMapping } from '@/hooks/mapping.hooks';
import { DEFAULT_MAPPING_CONFIG, type MappingModel, type RowMapping } from '@/models/mapping.models';
import { ArtForm, ArtFormInput } from '@/components/form';
import RowMappingsSection, {
  type RowMappingRow,
  type RowMappingsSectionRef,
} from '@/page/mapping/RowMappingsSection';
import MappingMetaSection from '@/page/mapping/MappingMetaSection';
import SourceLayoutFormSection, {
  type SourceLayoutFormSectionRef,
} from '@/page/mapping/SourceLayoutFormSection';

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
});

type FormValues = {
  name: string;
  reportType: 'pnl' | 'financial_position';
  fromCurrency: string;
  toCurrency: string;
};

const emptyDefaults: FormValues = {
  name: '',
  reportType: 'pnl',
  fromCurrency: 'EUR',
  toCurrency: 'EUR',
};

function mappingToDefaults(mapping: MappingModel): FormValues {
  return {
    name: mapping.name,
    reportType: mapping.reportType,
    fromCurrency: mapping.config.fromCurrency ?? 'EUR',
    toCurrency: mapping.config.currency ?? 'EUR',
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

  const rowsSectionRef = useRef<RowMappingsSectionRef>(null);
  const layoutSectionRef = useRef<SourceLayoutFormSectionRef>(null);

  const methods = useForm<FormValues>({
    resolver: yupResolver(schema) as Resolver<FormValues>,
    defaultValues: mapping ? mappingToDefaults(mapping) : emptyDefaults,
  });

  useEffect(() => {
    if (mapping) methods.reset(mappingToDefaults(mapping));
  }, [mapping, methods]);

  const initialRows = useMemo(() => rowsFromMapping(mapping), [mapping]);
  const initialExportSettingId = mapping?.exportSetting?.id ?? null;

  async function onSave(data: FormValues) {
    const collectedRows = rowsSectionRef.current?.getRowMappings() ?? [];
    const cleanRows: RowMapping[] = collectedRows
      .filter((r) => r.sourceName.trim().length > 0)
      .map(({ _index, ...rest }) => ({
        ...rest,
        sourceName: rest.sourceName.trim(),
        displayName: rest.displayName || undefined,
      }));

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

    if (isCreating) {
      await createMutation.mutateAsync({
        name: data.name,
        reportType: data.reportType,
        config,
        exportSettingId: exportSettingId ?? undefined,
      });
    } else {
      await updateMutation.mutateAsync({
        id: id!,
        body: {
          name: data.name,
          reportType: data.reportType,
          config,
          exportSettingId: exportSettingId ?? undefined,
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
      <ArtFormInput name="name" label="Name" required />
      <MappingMetaSection />
      <SourceLayoutFormSection
        ref={layoutSectionRef}
        initialLayout={mapping?.config.sourceLayout ?? DEFAULT_MAPPING_CONFIG.sourceLayout}
        initialSheetLayouts={mapping?.config.sheetLayouts}
        initialSheetsConfig={mapping?.config.sheetsConfig}
      />
      <RowMappingsSection
        ref={rowsSectionRef}
        rowMappings={initialRows}
        initialExportSettingId={initialExportSettingId}
        editable
      />
    </ArtForm>
  );
}

// ==== Data loaders ====

export function MappingFormEdit() {
  const params = useParams();
  const id = params.id as string;
  const { data: mapping } = useGetMappingById(id);
  return <MappingFormInner id={id} mapping={mapping} />;
}

export function MappingFormCreate() {
  return <MappingFormInner />;
}

'use client';

import React, { useReducer, useRef, useEffect, useCallback } from 'react';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { FSLink } from '@/components/FSLink';
import { HREF } from '@/lib/hrefUrl';
import { useReports, type UploadedReport } from '@/providers/ReportProvider';
import { useGetLightMappings, useCreateMapping, useUpdateMapping, fetchMappingById } from '@/hooks/mapping.hooks';
import type {
  MappingConfig, RowMapping, SourceLayout, ReportType, MappingModel, SheetConfig, TotalColumnMode,
} from '@/models/mapping.models';
import type { ArtFormButtonProps } from '@/components/ui/ArtForm';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import { autoDetectLayout, extractRowNames } from './applyMapping';
import RowMappingsSection, { type RowMappingRow, type RowMappingsSectionRef } from './RowMappingsSection';
import SourceLayoutSection from './SourceLayoutSection';
import MappingMetaSection from './MappingMetaSection';
import { REPORT_TYPE_OPTIONS } from '@/models/mapping.models';
import ArtForm from '@/components/ui/ArtForm';
import ArtComboBox from '@/components/ui/ArtComboBox';
import { ArtFormSelect } from '@/components/form';
import FormSection from '@/components/FormSection';
import { useSaveMappingDialog } from './SaveMappingDialog';

// ==== Schema ====

const schema = yup.object({
  reportType: yup
    .string()
    .oneOf(['pnl', 'financial_position'], 'Report Type is required')
    .required('Report Type is required'),
  fromCurrency: yup.string().default('EUR'),
  toCurrency: yup.string().default('EUR'),
});

type FormValues = {
  reportType: string;
  fromCurrency: string;
  toCurrency: string;
};

// ==== Helpers ====

function sanitizeLayout(layout: SourceLayout): SourceLayout {
  return { ...layout, regions: Array.isArray(layout.regions) ? layout.regions : [] };
}

function primarySheetOf(sheetNames: string[], sheetsConfig: Record<string, SheetConfig>): string {
  return sheetNames.find((s) => sheetsConfig[s]?.mode !== 'skip') ?? sheetNames[0];
}

function mergeRowMappings(prev: RowMappingRow[], newNames: string[]): RowMappingRow[] {
  const bySource = new Map(prev.map((r) => [r.sourceName, r]));
  return newNames.map((sourceName, i) => {
    const existing = bySource.get(sourceName);
    return existing ? { ...existing, _index: i } : { sourceName, _index: i };
  });
}

function buildInitialState(report: UploadedReport): MappingStepState {
  const layouts: Record<string, SourceLayout> = {};
  const sheetConfigs: Record<string, SheetConfig> = {};
  for (const s of report.workbook.SheetNames) {
    layouts[s] = autoDetectLayout(report.workbook, s);
    sheetConfigs[s] = { mode: 'combine' };
  }
  const primary = report.workbook.SheetNames[0];
  const names = extractRowNames(report.workbook, primary, layouts[primary]);
  const rowMappings = names.map((sourceName, i) => ({ sourceName, _index: i }));
  const initialMappingId = report.mapping?.id && report.mapping.id !== '__local__'
    ? report.mapping.id
    : null;
  return {
    selectedMappingId: initialMappingId,
    selectedMapping: null,
    rowMappings,
    sheetLayouts: layouts,
    autoDetectedLayouts: layouts,
    sheetsConfig: sheetConfigs,
    layoutOpen: false,
    rowMappingsOpen: false,
  };
}

// ==== Reducer ====

type MappingStepState = {
  selectedMappingId: string | null;
  selectedMapping: MappingModel | null;
  rowMappings: RowMappingRow[];
  sheetLayouts: Record<string, SourceLayout>;
  autoDetectedLayouts: Record<string, SourceLayout>;
  sheetsConfig: Record<string, SheetConfig>;
  layoutOpen: boolean;
  rowMappingsOpen: boolean;
};

type MappingStepAction =
  | { type: 'SET_MAPPING_ID'; id: string | null }
  | { type: 'SET_MAPPING'; mapping: MappingModel | null }
  | { type: 'APPLY_MAPPING'; mapping: MappingModel; workbook: import('xlsx').WorkBook }
  | { type: 'SET_SHEET_LAYOUT'; sheetName: string; layout: SourceLayout; flushedRows: RowMappingRow[] }
  | { type: 'SET_SHEET_MODE'; sheetName: string; mode: 'combine' | 'skip'; flushedRows: RowMappingRow[] }
  | { type: 'SET_SHEET_TOTAL_COLUMN_MODE'; sheetName: string; mode: TotalColumnMode }
  | { type: 'SET_ROW_MAPPINGS'; rows: RowMappingRow[] }
  | { type: 'OPEN_LAYOUT'; flushedRows: RowMappingRow[] }
  | { type: 'OPEN_ROW_MAPPINGS'; mergedRows: RowMappingRow[] }
  | { type: 'CLOSE_ROW_MAPPINGS' };

function reducer(state: MappingStepState, action: MappingStepAction): MappingStepState {
  switch (action.type) {
    case 'SET_MAPPING_ID':
      return { ...state, selectedMappingId: action.id, selectedMapping: action.id ? state.selectedMapping : null };
    case 'SET_MAPPING':
      return { ...state, selectedMapping: action.mapping };
    case 'APPLY_MAPPING': {
      const { mapping, workbook } = action;
      const sheetNames = workbook.SheetNames;
      const newSheetConfigs = mapping.config.sheetsConfig
        ? { ...state.sheetsConfig, ...mapping.config.sheetsConfig }
        : state.sheetsConfig;
      const newLayouts: Record<string, SourceLayout> = { ...state.sheetLayouts };
      if (mapping.config.sheetLayouts) {
        Object.assign(newLayouts, mapping.config.sheetLayouts);
      } else if (mapping.config.sourceLayout) {
        const layout = sanitizeLayout(mapping.config.sourceLayout);
        for (const s of sheetNames) newLayouts[s] = layout;
      }
      const primary = primarySheetOf(sheetNames, newSheetConfigs);
      const primaryLayout = newLayouts[primary];
      let rowMappings = state.rowMappings;
      if (primaryLayout) {
        const names = extractRowNames(workbook, primary, sanitizeLayout(primaryLayout));
        const namesSet = new Set(names);
        const existingBySource = new Map(mapping.config.rowMappings.map((r) => [r.sourceName, r]));
        const used: RowMappingRow[] = names.map((sourceName, i) => ({
          sourceName, _index: i, ...(existingBySource.get(sourceName) ?? {}),
        }));
        const unused: RowMappingRow[] = mapping.config.rowMappings.reduce<RowMappingRow[]>((acc, r) => {
          if (!namesSet.has(r.sourceName)) acc.push({ ...r, _index: names.length + acc.length, _unused: true });
          return acc;
        }, []);
        rowMappings = [...used, ...unused];
      }
      return { ...state, sheetsConfig: newSheetConfigs, sheetLayouts: newLayouts, rowMappings, rowMappingsOpen: false };
    }
    case 'SET_SHEET_LAYOUT':
      return {
        ...state,
        sheetLayouts: { ...state.sheetLayouts, [action.sheetName]: action.layout },
        rowMappings: action.flushedRows,
        rowMappingsOpen: false,
      };
    case 'SET_SHEET_MODE':
      return {
        ...state,
        sheetsConfig: { ...state.sheetsConfig, [action.sheetName]: { ...(state.sheetsConfig[action.sheetName] ?? { mode: 'combine' }), mode: action.mode } },
        rowMappings: action.flushedRows,
        rowMappingsOpen: false,
      };
    case 'SET_SHEET_TOTAL_COLUMN_MODE':
      return {
        ...state,
        sheetsConfig: { ...state.sheetsConfig, [action.sheetName]: { ...(state.sheetsConfig[action.sheetName] ?? { mode: 'combine' }), totalColumnMode: action.mode } },
      };
    case 'SET_ROW_MAPPINGS':
      return { ...state, rowMappings: action.rows };
    case 'OPEN_LAYOUT':
      return { ...state, layoutOpen: true, rowMappings: action.flushedRows, rowMappingsOpen: false };
    case 'OPEN_ROW_MAPPINGS':
      return { ...state, rowMappingsOpen: true, rowMappings: action.mergedRows };
    case 'CLOSE_ROW_MAPPINGS':
      return { ...state, rowMappingsOpen: false };
    default:
      return state;
  }
}

// ==== Inner component (stable report prop — key= on caller resets) ====

function MappingStepInner({ report }: { report: UploadedReport }) {
  const router = useRouter();
  const { setMapping, removeReport } = useReports();
  const { data: mappings = [] } = useGetLightMappings();

  const createMapping = useCreateMapping();
  const updateMappingMut = useUpdateMapping();
  const saveMappingDialog = useSaveMappingDialog();
  const queryClient = useQueryClient();
  const rowMappingsSectionRef = useRef<RowMappingsSectionRef>(null);

  const [state, dispatch] = useReducer(reducer, report, buildInitialState);
  const { selectedMappingId, selectedMapping, rowMappings, sheetLayouts, autoDetectedLayouts, sheetsConfig, layoutOpen, rowMappingsOpen } = state;

  const methods = useForm<FormValues>({
    resolver: yupResolver(schema) as Resolver<FormValues>,
    defaultValues: { reportType: '', fromCurrency: 'EUR', toCurrency: 'EUR' },
  });

  // ==== Apply mapping from fetched data ====

  const applyMappingToForm = useCallback((mapping: MappingModel) => {
    methods.setValue('reportType', mapping.reportType);
    if (mapping.config.fromCurrency) methods.setValue('fromCurrency', mapping.config.fromCurrency);
    methods.setValue('toCurrency', mapping.config.currency);
    rowMappingsSectionRef.current?.setExportSettingId(mapping.exportSetting?.id ?? null);
    dispatch({ type: 'APPLY_MAPPING', mapping, workbook: report.workbook });
  }, [methods, report.workbook]);

  // ==== Fetch + apply selected mapping ====

  useEffect(() => {
    if (!selectedMappingId || selectedMapping?.id === selectedMappingId) return;
    let cancelled = false;
    fetchMappingById(queryClient, selectedMappingId).then((mapping) => {
      if (cancelled) return;
      dispatch({ type: 'SET_MAPPING', mapping });
      applyMappingToForm(mapping);
    });
    return () => { cancelled = true; };
  }, [selectedMappingId, selectedMapping?.id, queryClient, applyMappingToForm]);

  // ==== Derived ====

  const isUserOwned = !!selectedMapping && !selectedMapping.isGlobal;

  // ==== Flush helper (reads uncontrolled row inputs before state changes) ====

  function flushRowMappings(): RowMappingRow[] {
    if (!rowMappingsOpen) return rowMappings;
    return rowMappingsSectionRef.current?.getRowMappings() ?? rowMappings;
  }

  // ==== Handlers ====

  async function handleMappingChange(opt: ArtComboBoxOption | null) {
    const flushed = flushRowMappings();
    dispatch({ type: 'SET_ROW_MAPPINGS', rows: flushed });
    const id = opt?.value ?? null;
    dispatch({ type: 'SET_MAPPING_ID', id });
    if (!id) return;
    const mapping = await fetchMappingById(queryClient, id);
    dispatch({ type: 'SET_MAPPING', mapping });
    applyMappingToForm(mapping);
  }

  function handleSheetLayoutChange(sheetName: string, layout: SourceLayout) {
    dispatch({ type: 'SET_SHEET_LAYOUT', sheetName, layout, flushedRows: flushRowMappings() });
  }

  function handleSheetModeChange(sheetName: string, mode: 'combine' | 'skip') {
    dispatch({ type: 'SET_SHEET_MODE', sheetName, mode, flushedRows: flushRowMappings() });
  }

  function handleSheetTotalColumnModeChange(sheetName: string, mode: TotalColumnMode) {
    dispatch({ type: 'SET_SHEET_TOTAL_COLUMN_MODE', sheetName, mode });
  }

  function handleLayoutOpen(open: boolean) {
    if (open) {
      dispatch({ type: 'OPEN_LAYOUT', flushedRows: flushRowMappings() });
    } else {
      dispatch({ type: 'SET_ROW_MAPPINGS', rows: rowMappings });
    }
  }

  function handleRowMappingsOpen(open: boolean) {
    if (open) {
      const primary = primarySheetOf(report.workbook.SheetNames, sheetsConfig);
      const layout = sheetLayouts[primary];
      const names = layout ? extractRowNames(report.workbook, primary, layout) : [];
      dispatch({ type: 'OPEN_ROW_MAPPINGS', mergedRows: mergeRowMappings(rowMappings, names) });
    } else {
      dispatch({ type: 'CLOSE_ROW_MAPPINGS' });
    }
  }

  // ==== Build config ====

  function buildConfig(): MappingConfig {
    const { fromCurrency: from, toCurrency: to } = methods.getValues();
    const primary = primarySheetOf(report.workbook.SheetNames, sheetsConfig);
    const primaryLayout = sheetLayouts[primary] ?? autoDetectLayout(report.workbook, primary);
    const currentRowMappings = rowMappingsSectionRef.current?.getRowMappings() ?? rowMappings;
    return {
      fromCurrency: from,
      currency: to,
      sourceLayout: primaryLayout,
      sheetLayouts,
      sheetsConfig,
      rowMappings: currentRowMappings.map(({ _index, ...rest }: RowMappingRow): RowMapping => rest),
      columnHeaders: [],
    };
  }

  // ==== Apply and navigate ====

  function applyAndNavigate() {
    const { reportType } = methods.getValues();
    const config = buildConfig();
    const linkedExportSetting = rowMappingsSectionRef.current?.getLinkedExportSetting() ?? null;

    const effectiveMapping: MappingModel = {
      id: selectedMapping?.id ?? '__local__',
      name: selectedMapping?.name ?? '(unsaved)',
      isGlobal: selectedMapping?.isGlobal ?? false,
      reportType: (reportType as MappingModel['reportType']) ?? 'pnl',
      config,
      exportSetting: linkedExportSetting
        ? {
            id: linkedExportSetting.id,
            name: linkedExportSetting.name,
            mappedValues: linkedExportSetting.mappedValues,
            hasTotalColumn: linkedExportSetting.hasTotalColumn,
          }
        : null,
      createdAt: selectedMapping?.createdAt ?? new Date().toISOString(),
      updatedAt: selectedMapping?.updatedAt ?? new Date().toISOString(),
    };

    setMapping(report.id, effectiveMapping);
    router.push('/');
  }

  // ==== Save mapping dialog ====

  function openSaveDialog(mode: 'create' | 'update') {
    const { reportType } = methods.getValues();
    const esId = rowMappingsSectionRef.current?.getExportSettingId() ?? undefined;
    const isUpdate = mode === 'update' && isUserOwned && !!selectedMappingId;
    saveMappingDialog.open({
      defaultName: isUpdate ? (selectedMapping?.name ?? '') : '',
      isUserOwned: isUpdate,
      isGlobalSelected: false,
      onSave: async (name) => {
        const config = buildConfig();
        if (isUpdate) {
          await updateMappingMut.mutateAsync({
            id: selectedMappingId!,
            body: { name, reportType: reportType as ReportType, config, exportSettingId: esId },
          });
        } else {
          const created = await createMapping.mutateAsync({
            name,
            reportType: reportType as ReportType ?? 'pnl',
            config,
            exportSettingId: esId,
          });
          dispatch({ type: 'SET_MAPPING_ID', id: created.id });
        }
      },
    });
  }

  // ==== Options ====

  const mappingOptions: ArtComboBoxOption[] = mappings.map((m) => ({
    label: m.name,
    value: m.id,
  }));

  const selectedMappingOption = mappingOptions.find((o) => o.value === selectedMappingId) ?? null;

  // ==== Form buttons ====

  const mappingFetchPending = !!selectedMappingId && selectedMapping?.id !== selectedMappingId;

  const handleFormSubmit = (e: React.BaseSyntheticEvent) => methods.handleSubmit(applyAndNavigate)(e);

  const formButtons: ArtFormButtonProps[] = [
    { label: 'Save as new mapping', variant: 'outlined', type: 'button', onClick: () => openSaveDialog('create'), side: 'left' },
    ...(isUserOwned ? [{
      label: 'Update current mapping',
      variant: 'outlined' as const,
      type: 'button' as const,
      onClick: () => openSaveDialog('update'),
      side: 'left' as const,
    }] : []),
    {
      label: 'Cancel upload',
      color: 'danger',
      variant: 'ghost',
      type: 'button',
      onClick: () => { removeReport(report.id); router.push('/upload'); },
    },
    { label: 'Apply Mapping', color: 'primary', type: 'submit', loading: mappingFetchPending, disabled: mappingFetchPending },
  ];

  // ==== Render ====

  return (
    <>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        Set how <strong>{report.fileName}</strong> should be read and displayed.
      </p>

      <FormProvider {...methods}>
        <ArtForm onSubmit={handleFormSubmit} buttons={formButtons}>
          <FormSection title="Upload">
            <ArtComboBox
              label="Mapping"
              options={mappingOptions}
              selected={selectedMappingOption}
              onChange={handleMappingChange}
              placeholder="Select or create mapping…"
              clearable
            />
            <ArtFormSelect
              name="reportType"
              label="Report Type"
              options={REPORT_TYPE_OPTIONS}
              required
            />
            {selectedMapping && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {selectedMapping.isGlobal
                  ? 'Global mapping — changes are not saved unless you save a copy.'
                  : `Editing: ${selectedMapping.name}`}
              </p>
            )}
          </FormSection>

          <MappingMetaSection />

          {Object.keys(sheetLayouts).length > 0 && (
            <SourceLayoutSection
              workbook={report.workbook}
              sheetLayouts={sheetLayouts}
              autoDetectedLayouts={autoDetectedLayouts}
              sheetsConfig={sheetsConfig}
              onSheetLayoutChange={handleSheetLayoutChange}
              onSheetModeChange={handleSheetModeChange}
              onSheetTotalColumnModeChange={handleSheetTotalColumnModeChange}
              collapseOpen={layoutOpen}
              onCollapseChange={handleLayoutOpen}
            />
          )}

          <RowMappingsSection
            ref={rowMappingsSectionRef}
            rowMappings={rowMappings}
            collapseOpen={rowMappingsOpen}
            onCollapseChange={handleRowMappingsOpen}
          />
        </ArtForm>
      </FormProvider>
    </>
  );
}

// ==== Outer shell (reads searchParams, redirect guard) ====
// NOTE: nextjs-no-use-search-params-without-suspense is a false positive — loading.tsx provides the Suspense boundary

export default function MappingStep() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id') ?? undefined;
  const { reports } = useReports();

  const report = reportId
    ? reports.find((r) => r.id === reportId)
    : reports[reports.length - 1];

  if (!report) return (
    <div className="flex items-center gap-4 p-6 text-sm" style={{ color: 'var(--text-muted)' }}>
      No report loaded.
      <FSLink href={HREF.upload} className="underline">← Back to upload</FSLink>
    </div>
  );
  return <MappingStepInner key={report.id} report={report} />;
}

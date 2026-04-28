'use client';

import React, { useState, useRef } from 'react';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useReports, type UploadedReport } from '@/providers/ReportProvider';
import { useGetLightMappings, useCreateMapping, useUpdateMapping, fetchMappingById } from '@/hooks/mapping.hooks';
import { useCurrencyOptions } from '@/hooks/currencies.hooks';
import type {
  MappingConfig, RowMapping, SourceLayout, ReportType, MappingModel, SheetConfig,
} from '@/models/mapping.models';
import type { ArtSelectOption } from '@/components/ui/ArtSelect';
import type { ArtFormButtonProps } from '@/components/ui/ArtForm';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import { autoDetectLayout, extractRowNames, applyMappingMultiSheet } from './applyMapping';
import RowMappingsSection, { type RowMappingRow, type RowMappingsSectionRef } from './RowMappingsSection';
import SourceLayoutSection from './SourceLayoutSection';
import ArtComboBox from '@/components/ui/ArtComboBox';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtForm from '@/components/ui/ArtForm';
import { ArtFormSelect, ArtFormComboBox } from '@/components/form';
import { useSaveMappingDialog } from './SaveMappingDialog';

// ==== Constants ====

const REPORT_TYPE_OPTIONS: ArtSelectOption[] = [
  { label: 'Profit & Loss', value: 'pnl' },
  { label: 'Financial Position', value: 'financial_position' },
];

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

// ==== Component ====

export default function MappingStep({ reportId }: { reportId?: string }) {
  const router = useRouter();
  const { reports, updateReport, removeReport } = useReports();
  const { data: mappings = [] } = useGetLightMappings();

  const createMapping = useCreateMapping();
  const updateMappingMut = useUpdateMapping();
  const { options: currencyOptions, isLoading: currenciesLoading } = useCurrencyOptions();
  const saveMappingDialog = useSaveMappingDialog();

  const report = (reportId
    ? reports.find((r) => r.id === reportId)
    : reports[reports.length - 1]) as UploadedReport | undefined;

  // ==== RHF — scalar form fields ====

  const methods = useForm<FormValues>({
    resolver: yupResolver(schema) as Resolver<FormValues>,
    defaultValues: { reportType: '', fromCurrency: 'EUR', toCurrency: 'EUR' },
  });

  // ==== Uncontrolled state (per UncontrolledInputsGuide) ====

  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [rowMappings, setRowMappings] = useState<RowMappingRow[]>([]);
  const [sheetLayouts, setSheetLayouts] = useState<Record<string, SourceLayout>>({});
  const [autoDetectedLayouts, setAutoDetectedLayouts] = useState<Record<string, SourceLayout>>({});
  const [sheetsConfig, setSheetsConfig] = useState<Record<string, SheetConfig>>({});
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [rowMappingsOpen, setRowMappingsOpen] = useState(false);
  const rowMappingsSectionRef = useRef<RowMappingsSectionRef>(null);

  // ==== Auto-detect when report changes (adjust-state-during-render pattern) ====

  const [prevReport, setPrevReport] = useState(report);
  if (prevReport !== report && report) {
    setPrevReport(report);
    const layouts: Record<string, SourceLayout> = {};
    const sheetConfigs: Record<string, SheetConfig> = {};
    for (const s of report.workbook.SheetNames) {
      layouts[s] = autoDetectLayout(report.workbook, s);
      sheetConfigs[s] = { mode: 'combine' };
    }
    setSheetLayouts(layouts);
    setAutoDetectedLayouts(layouts);
    setSheetsConfig(sheetConfigs);
    const primary = report.workbook.SheetNames[0];
    const names = extractRowNames(report.workbook, primary, layouts[primary]);
    setRowMappings(names.map((sourceName, i) => ({ sourceName, _index: i })));
  }

  // ==== Hooks unconditional ====

  const queryClient = useQueryClient();
  const [selectedMapping, setSelectedMapping] = useState<MappingModel | null>(null);
  // ==== Redirect if no report ====

  if (!report) {
    router.push('/upload');
    return null;
  }

  // ==== Derived ====

  const isGlobalSelected = selectedMapping?.isGlobal === true;
  const isUserOwned = !!selectedMapping && !selectedMapping.isGlobal;

  // ==== Mapping apply ====

  function applyMappingToForm(mapping: MappingModel) {
    methods.setValue('reportType', mapping.reportType);
    if (mapping.config.fromCurrency) methods.setValue('fromCurrency', mapping.config.fromCurrency);
    methods.setValue('toCurrency', mapping.config.currency);
    rowMappingsSectionRef.current?.setExportSettingId(mapping.exportSetting?.id ?? null);

    const newSheetConfigs = mapping.config.sheetsConfig
      ? { ...sheetsConfig, ...mapping.config.sheetsConfig }
      : sheetsConfig;
    setSheetsConfig(newSheetConfigs);

    const newLayouts: Record<string, SourceLayout> = { ...sheetLayouts };
    if (mapping.config.sheetLayouts) {
      Object.assign(newLayouts, mapping.config.sheetLayouts);
    } else if (mapping.config.sourceLayout) {
      const layout = sanitizeLayout(mapping.config.sourceLayout);
      for (const s of report!.workbook.SheetNames) newLayouts[s] = layout;
    }
    setSheetLayouts(newLayouts);

    const primary = primarySheetOf(report!.workbook.SheetNames, newSheetConfigs);
    const primaryLayout = newLayouts[primary];
    if (primaryLayout) {
      const names = extractRowNames(report!.workbook, primary, sanitizeLayout(primaryLayout));
      const existingBySource = new Map(mapping.config.rowMappings.map((r) => [r.sourceName, r]));
      setRowMappings(
        names.map((sourceName, i) => ({
          sourceName,
          _index: i,
          ...(existingBySource.get(sourceName) ?? {}),
        })),
      );
    }
  }

  async function handleMappingChange(opt: ArtComboBoxOption | null) {
    const id = opt?.value ?? null;
    setSelectedMappingId(id);
    if (!id) { setSelectedMapping(null); return; }
    const mapping = await fetchMappingById(queryClient, id);
    setSelectedMapping(mapping);
    applyMappingToForm(mapping);
  }

  // ==== Row mapping flush ====

  function flushRowMappings() {
    if (!rowMappingsOpen) return;
    const current = rowMappingsSectionRef.current?.getRowMappings();
    if (current) setRowMappings(current);
  }

  // ==== Sheet handlers ====

  function handleSheetLayoutChange(sheetName: string, layout: SourceLayout) {
    flushRowMappings();
    setSheetLayouts((prev) => ({ ...prev, [sheetName]: layout }));
    setRowMappingsOpen(false);
  }

  function handleSheetModeChange(sheetName: string, mode: 'combine' | 'skip') {
    flushRowMappings();
    setSheetsConfig((prev) => ({
      ...prev,
      [sheetName]: { ...(prev[sheetName] ?? { mode: 'combine' }), mode },
    }));
    setRowMappingsOpen(false);
  }

  function handleSheetTotalColumnModeChange(sheetName: string, mode: import('@/models/mapping.models').TotalColumnMode) {
    setSheetsConfig((prev) => ({
      ...prev,
      [sheetName]: { ...(prev[sheetName] ?? { mode: 'combine' }), totalColumnMode: mode },
    }));
  }

  function handleLayoutOpen(open: boolean) {
    setLayoutOpen(open);
    if (open) {
      flushRowMappings();
      setRowMappingsOpen(false);
    }
  }

  function handleRowMappingsOpen(open: boolean) {
    setRowMappingsOpen(open);
    if (open) {
      const primary = primarySheetOf(report!.workbook.SheetNames, sheetsConfig);
      const layout = sheetLayouts[primary];
      if (layout) {
        const names = extractRowNames(report!.workbook, primary, layout);
        setRowMappings((prev) => mergeRowMappings(prev, names));
      }
    }
  }

  // ==== Build config ====

  function buildConfig(): MappingConfig {
    const { fromCurrency: from, toCurrency: to } = methods.getValues();
    const primary = primarySheetOf(report!.workbook.SheetNames, sheetsConfig);
    const primaryLayout = sheetLayouts[primary] ?? autoDetectLayout(report!.workbook, primary);
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
    const config = buildConfig();
    const skippedSheets = report!.workbook.SheetNames.filter((s) => sheetsConfig[s]?.mode === 'skip');
    const usedSheets = report!.workbook.SheetNames.filter((s) => sheetsConfig[s]?.mode !== 'skip');
    const { headers, rows, rowColors, valueColors, totalColumns } = applyMappingMultiSheet(
      report!.workbook,
      usedSheets.length > 0 ? usedSheets : [report!.workbook.SheetNames[0]],
      config,
    );
    updateReport(report!.id, {
      mappingId: selectedMappingId ?? undefined,
      processedHeaders: headers,
      processedRows: rows,
      rowColors,
      valueColors,
      totalColumns,
      skippedSheets,
      exportSetting: rowMappingsSectionRef.current?.getLinkedExportSetting() ?? null,
    });
    router.push('/');
  }

  // ==== Save mapping dialog ====

  function openSaveDialog() {
    const { reportType } = methods.getValues();
    const esId = rowMappingsSectionRef.current?.getExportSettingId() ?? undefined;
    saveMappingDialog.open({
      defaultName: selectedMapping?.name ?? '',
      isUserOwned,
      isGlobalSelected,
      onSave: async (name) => {
        const config = buildConfig();
        if (isUserOwned && selectedMappingId) {
          await updateMappingMut.mutateAsync({
            id: selectedMappingId,
            body: { name, reportType: reportType as ReportType, config, exportSettingId: esId },
          });
        } else {
          const created = await createMapping.mutateAsync({
            name,
            reportType: reportType as ReportType ?? 'pnl',
            config,
            exportSettingId: esId,
          });
          setSelectedMappingId(created.id);
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

  const saveButtonLabel = isGlobalSelected ? 'Save as copy' : isUserOwned ? 'Update mapping' : 'Save mapping config';

  const handleFormSubmit = (e: React.BaseSyntheticEvent) => methods.handleSubmit(applyAndNavigate)(e);

  const formButtons: ArtFormButtonProps[] = [
    { label: saveButtonLabel, variant: 'outlined', type: 'button', onClick: openSaveDialog, side: 'left' },
    {
      label: 'Cancel upload',
      color: 'danger',
      variant: 'ghost',
      type: 'button',
      onClick: () => { removeReport(report.id); router.push('/upload'); },
    },
    { label: 'Apply Mapping', color: 'primary', type: 'submit' },
  ];

  // ==== Render ====

  return (
    <div className="mx-auto max-w-5xl py-8">
      <h1 className="mb-1 text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Configure Mapping
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        Set how <strong>{report.fileName}</strong> should be read and displayed.
      </p>

      <FormProvider {...methods}>
        <ArtForm onSubmit={handleFormSubmit} buttons={formButtons}>
          {/* ==== Mapping ==== */}
          <ArtCollapse title="Mapping" defaultOpen>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <ArtFormSelect
                  name="reportType"
                  label="Report Type"
                  options={REPORT_TYPE_OPTIONS}
                  required
                />

                <ArtComboBox
                  label="Mapping"
                  options={mappingOptions}
                  selected={selectedMappingOption}
                  onChange={handleMappingChange}
                  placeholder="Select or create mapping…"
                  clearable
                />

                <ArtFormComboBox
                  name="fromCurrency"
                  label="From Currency"
                  options={currencyOptions}
                  placeholder="EUR"
                  isLoading={currenciesLoading}
                  searchable
                  onSubmit={(text) => { if (text) methods.setValue('fromCurrency', text.toUpperCase()); }}
                />

                <div className="flex flex-col gap-1">
                  <ArtFormComboBox
                    name="toCurrency"
                    label="To Currency"
                    options={currencyOptions}
                    placeholder="EUR"
                    isLoading={currenciesLoading}
                    searchable
                    onSubmit={(text) => { if (text) methods.setValue('toCurrency', text.toUpperCase()); }}
                  />
                </div>
              </div>

              {selectedMapping && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {selectedMapping.isGlobal
                    ? 'Global mapping — changes are not saved unless you save a copy.'
                    : `Editing: ${selectedMapping.name}`}
                </p>
              )}
            </div>
          </ArtCollapse>

          {/* ==== Source Layout ==== */}
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

          {/* ==== Row Mappings ==== */}
          <RowMappingsSection
            ref={rowMappingsSectionRef}
            rowMappings={rowMappings}
            collapseOpen={rowMappingsOpen}
            onCollapseChange={handleRowMappingsOpen}
          />
        </ArtForm>
      </FormProvider>
    </div>
  );
}

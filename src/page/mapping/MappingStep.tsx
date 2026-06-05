'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useReports, type UploadedReport } from '@/providers/ReportProvider';
import { useGetLightMappings, useCreateMapping, useUpdateMapping, fetchMappingById } from '@/hooks/mapping.hooks';
import type {
  MappingConfig, RowMapping, SourceLayout, ReportType, MappingModel, SheetConfig,
} from '@/models/mapping.models';
import type { ArtFormButtonProps } from '@/components/ui/ArtForm';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import { autoDetectLayout, extractRowNames } from './applyMapping';
import RowMappingsSection, { type RowMappingRow, type RowMappingsSectionRef } from './RowMappingsSection';
import SourceLayoutSection from './SourceLayoutSection';
import MappingMetaSection, { REPORT_TYPE_OPTIONS } from './MappingMetaSection';
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

// ==== Component ====

export default function MappingStep({ reportId }: { reportId?: string }) {
  const router = useRouter();
  const { reports, setMapping, removeReport } = useReports();
  const { data: mappings = [] } = useGetLightMappings();

  const createMapping = useCreateMapping();
  const updateMappingMut = useUpdateMapping();
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
  const queryClient = useQueryClient();
  const [selectedMapping, setSelectedMapping] = useState<MappingModel | null>(null);

  // ==== Auto-detect when report changes (adjust-state-during-render pattern) ====

  const [prevReport, setPrevReport] = useState<UploadedReport | undefined>(undefined);
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

    // Restore previously-applied mapping when re-editing an uploaded report.
    // Actual fetch happens in the effect below — refs must not be read during render.
    if (report.mapping?.id && report.mapping.id !== '__local__') setSelectedMappingId(report.mapping.id);
  }

  // ==== Mapping apply (declared before conditional return so hooks remain stable) ====
  // Memoised so the fetch effect below has a stable identity per relevant inputs.

  const applyMappingToForm = useCallback((mapping: MappingModel) => {
    if (!report) return;
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
      for (const s of report.workbook.SheetNames) newLayouts[s] = layout;
    }
    setSheetLayouts(newLayouts);

    const primary = primarySheetOf(report.workbook.SheetNames, newSheetConfigs);
    const primaryLayout = newLayouts[primary];
    if (primaryLayout) {
      const names = extractRowNames(report.workbook, primary, sanitizeLayout(primaryLayout));
      const namesSet = new Set(names);
      const existingBySource = new Map(mapping.config.rowMappings.map((r) => [r.sourceName, r]));
      const used: RowMappingRow[] = names.map((sourceName, i) => ({
        sourceName,
        _index: i,
        ...(existingBySource.get(sourceName) ?? {}),
      }));
      const unused: RowMappingRow[] = mapping.config.rowMappings
        .filter((r) => !namesSet.has(r.sourceName))
        .map((r, j) => ({ ...r, _index: names.length + j, _unused: true }));
      setRowMappings([...used, ...unused]);
    }
  }, [report, methods, sheetsConfig, sheetLayouts]);

  // ==== Fetch + apply selected mapping (side effect — runs outside render) ====

  useEffect(() => {
    if (!selectedMappingId || selectedMapping?.id === selectedMappingId) return;
    let cancelled = false;
    fetchMappingById(queryClient, selectedMappingId).then((mapping) => {
      if (cancelled) return;
      setSelectedMapping(mapping);
      applyMappingToForm(mapping);
    });
    return () => { cancelled = true; };
  }, [selectedMappingId, selectedMapping?.id, queryClient, applyMappingToForm]);

  // ==== Redirect if no report ====

  if (!report) {
    router.push('/upload');
    return null;
  }

  // ==== Derived ====

  const isUserOwned = !!selectedMapping && !selectedMapping.isGlobal;

  async function handleMappingChange(opt: ArtComboBoxOption | null) {
    flushRowMappings();
    setRowMappingsOpen(false);
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
    const { reportType } = methods.getValues();
    const config = buildConfig();
    const linkedExportSetting = rowMappingsSectionRef.current?.getLinkedExportSetting() ?? null;

    // Synthesise the MappingModel that's actually in effect — saved base + local edits.
    // ReportProvider.setMapping recomputes report.mapped from this.
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

    setMapping(report!.id, effectiveMapping);
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
  // Save logic:
  //   - Always: "Save as new mapping" (creates a fresh personal mapping).
  //   - When a personal mapping is selected: also "Update current mapping" (overwrites it).
  //   - Global mappings can't be updated in place — saving always creates a copy.
  // Apply (submit) waits for fetchMappingById to settle when a mapping was just picked.

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
          {/* ==== Unique top section: Mapping picker + Report Type ==== */}
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

          {/* ==== Currencies ==== */}
          <MappingMetaSection />

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
    </>
  );
}

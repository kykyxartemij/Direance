'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/lib/axiosClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import * as yup from 'yup';
import { useRouter } from 'next/navigation';
import { useReports, type UploadedReport } from '@/providers/ReportProvider';
import { useGetLightMappings, useCreateMapping, useUpdateMapping } from '@/hooks/mapping.hooks';
import { useGetExportSettingById, useGetLightExportSettings } from '@/hooks/export-settings.hooks';
import { useCurrencyOptions, useCurrencyRate } from '@/hooks/currencies.hooks';
import type {
  MappingConfig, RowMapping, SourceLayout, ReportType, MappingModel, SheetConfig,
} from '@/models/mapping.models';
import type { ArtSelectOption } from '@/components/ui/ArtSelect';
import type { ArtFormButtonProps } from '@/components/ui/ArtForm';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import { autoDetectLayout, extractRowNames, applyMappingMultiSheet } from './applyMapping';
import RowMappingsSection, { type RowMappingRow, type RowMappingsSectionRef } from './RowMappingsSection';
import SourceLayoutSection from './SourceLayoutSection';
import ArtInput from '@/components/ui/ArtInput';
import ArtSelect from '@/components/ui/ArtSelect';
import ArtComboBox from '@/components/ui/ArtComboBox';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtForm from '@/components/ui/ArtForm';
import { useArtDialog } from '@/components/ui/ArtDialog';

// ==== Constants ====

const REPORT_TYPE_OPTIONS: ArtSelectOption[] = [
  { label: 'Profit & Loss', value: 'pnl' },
  { label: 'Financial Position', value: 'financial_position' },
];

const SaveNameSchema = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
});

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
  const dialog = useArtDialog();
  const { reports, updateReport, removeReport } = useReports();
  const { data: mappings = [] } = useGetLightMappings();
  const { data: exportSettingsList = [] } = useGetLightExportSettings();
  const createMapping = useCreateMapping();
  const updateMappingMut = useUpdateMapping();
  const { options: currencyOptions, isLoading: currenciesLoading } = useCurrencyOptions();

  const report = (reportId
    ? reports.find((r) => r.id === reportId)
    : reports[reports.length - 1]) as UploadedReport | undefined;

  // ==== Form state ====

  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [reportTypeError, setReportTypeError] = useState('');
  const [fromCurrency, setFromCurrency] = useState('EUR');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [exportSettingId, setExportSettingId] = useState<string | null>(null);
  const [rowMappings, setRowMappings] = useState<RowMappingRow[]>([]);
  const [sheetLayouts, setSheetLayouts] = useState<Record<string, SourceLayout>>({});
  const [autoDetectedLayouts, setAutoDetectedLayouts] = useState<Record<string, SourceLayout>>({});
  const [sheetsConfig, setSheetsConfig] = useState<Record<string, SheetConfig>>({});
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [rowMappingsOpen, setRowMappingsOpen] = useState(false);
  const rowMappingsSectionRef = useRef<RowMappingsSectionRef>(null);

  // ==== Auto-detect on mount ====

  useEffect(() => {
    if (!report) return;
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
  }, [report]);

  // ==== Hooks unconditional ====

  const queryClient = useQueryClient();
  const selectedMapping = mappings.find((m) => m.id === selectedMappingId);
  const { data: linkedExportSetting } = useGetExportSettingById(exportSettingId ?? undefined);
  const { rate: currencyRate, isLoading: rateLoading } = useCurrencyRate(fromCurrency, toCurrency);

  // ==== Redirect if no report ====

  if (!report) {
    router.push('/upload');
    return null;
  }

  // ==== Derived ====

  const isGlobalSelected = selectedMapping?.isGlobal ?? false;
  const isUserOwned = !!selectedMapping && !selectedMapping.isGlobal;

  const exportSettingOptions: ArtComboBoxOption[] = exportSettingsList.map((es) => ({
    label: es.name,
    value: es.id,
  }));

  const mappedValueOptions: ArtComboBoxOption[] =
    (linkedExportSetting?.mappedValueNames ?? []).map((n) => ({ label: n, value: n }));

  // ==== Mapping apply ====

  function applyMappingToForm(mapping: MappingModel) {
    setReportType(mapping.reportType);
    setReportTypeError('');
    if (mapping.config.fromCurrency) setFromCurrency(mapping.config.fromCurrency);
    setToCurrency(mapping.config.currency);
    setExportSettingId(mapping.exportSetting?.id ?? null);

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
    if (!id) return;
    // TODO: Move query to separate file
    const mapping = await queryClient.ensureQueryData<MappingModel>({
      queryKey: queryKeys.mapping.byId(id),
      queryFn: async () => {
        const { data } = await axiosClient.get<MappingModel>(API.mapping.byId(id));
        return data;
      },
    });
    applyMappingToForm(mapping);
  }

  function handleReportTypeChange(opt: ArtSelectOption | null) {
    const newType = (opt?.value as ReportType) ?? null;
    setReportType(newType);
    setReportTypeError('');
    if (selectedMappingId) {
      const mapping = mappings.find((m) => m.id === selectedMappingId);
      if (mapping && mapping.reportType !== newType) setSelectedMappingId(null);
    }
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

  // Mode affects which sheets are read → must flush row mappings
  function handleSheetModeChange(sheetName: string, mode: 'combine' | 'skip') {
    flushRowMappings();
    setSheetsConfig((prev) => ({
      ...prev,
      [sheetName]: { ...(prev[sheetName] ?? { mode: 'combine' }), mode },
    }));
    setRowMappingsOpen(false);
  }

  // createTotalColumn is output-only → no flush, no section close
  function handleSheetCreateTotalColumnChange(sheetName: string, value: boolean) {
    setSheetsConfig((prev) => ({
      ...prev,
      [sheetName]: { ...(prev[sheetName] ?? { mode: 'combine' }), createTotalColumn: value },
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
    const primary = primarySheetOf(report!.workbook.SheetNames, sheetsConfig);
    const primaryLayout = sheetLayouts[primary] ?? autoDetectLayout(report!.workbook, primary);
    const currentRowMappings = rowMappingsSectionRef.current?.getRowMappings() ?? rowMappings;
    return {
      fromCurrency,
      currency: toCurrency,
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
    const usedSheets = report!.workbook.SheetNames.filter((s) => sheetsConfig[s]?.mode !== 'skip');
    const { headers, rows, rowColors, valueColors } = applyMappingMultiSheet(
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
      exportSetting: linkedExportSetting ?? null,
    });
    router.push('/');
  }

  // ==== Save mapping dialog ====

  // TODO: Too complicated. Redefine logic, can be empty for now, put to separate file for readability.
  function openSaveDialog() {
    const defaultName = selectedMapping?.name ?? '';
    const nameRef = { current: defaultName };
    let errorSetter: ((msg: string) => void) | null = null;

    function DialogContent() {
      const [err, setErr] = useState('');
      errorSetter = setErr;
      return (
        <div className="flex flex-col gap-3">
          <ArtInput
            label="Mapping name"
            defaultValue={defaultName}
            placeholder="My mapping"
            onChange={(e) => { nameRef.current = e.target.value; }}
            autoFocus
          />
          {err && <p className="text-sm" style={{ color: 'var(--art-danger)' }}>{err}</p>}
        </div>
      );
    }

    dialog.show({
      title: isGlobalSelected ? 'Save as new mapping' : isUserOwned ? 'Update mapping' : 'Save mapping config',
      content: <DialogContent />,
      buttons: [
        {
          label: isUserOwned ? 'Update' : 'Save',
          color: 'primary',
          closesDialog: false,
          onClick: async () => {
            try {
              await SaveNameSchema.validate({ name: nameRef.current }, { abortEarly: false });
            } catch (err) {
              if (err instanceof yup.ValidationError) { errorSetter?.(err.errors[0]); return; }
            }
            const config = buildConfig();
            if (isUserOwned && selectedMappingId) {
              await updateMappingMut.mutateAsync({
                id: selectedMappingId,
                body: { name: nameRef.current, reportType: reportType!, config, exportSettingId: exportSettingId ?? undefined },
              });
            } else {
              const created = await createMapping.mutateAsync({
                name: nameRef.current,
                reportType: reportType ?? 'pnl',
                config,
                exportSettingId: exportSettingId ?? undefined,
              });
              setSelectedMappingId(created.id);
            }
            dialog.close();
          },
        },
      ],
      cancelButton: true,
    });
  }

  // ==== Form submit ====

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportType) {
      setReportTypeError('Report Type is required');
      return;
    }
    applyAndNavigate();
  }

  // ==== Options ====

  const mappingOptions: ArtComboBoxOption[] = mappings
    .filter((m) => reportType == null || m.reportType === reportType)
    .map((m) => ({
      label: m.isGlobal ? `${m.name} (Global)` : m.name,
      value: m.id,
    }));

  const selectedMappingOption = mappingOptions.find((o) => o.value === selectedMappingId) ?? null;
  const fromCurrencyOption = currencyOptions.find((o) => o.value === fromCurrency) ?? null;
  const toCurrencyOption = currencyOptions.find((o) => o.value === toCurrency) ?? null;

  // ==== Form buttons ====

  const saveButtonLabel = isGlobalSelected ? 'Save as copy' : isUserOwned ? 'Update mapping' : 'Save mapping config';

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

      <ArtForm onSubmit={handleSubmit} buttons={formButtons}>
        {/* ==== Mapping ==== */}
        <ArtCollapse title="Mapping" defaultOpen>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Report Type */}
              <div className="flex flex-col gap-1">
                <ArtSelect
                  label="Report Type"
                  options={REPORT_TYPE_OPTIONS}
                  selected={REPORT_TYPE_OPTIONS.find((o) => o.value === reportType) ?? null}
                  onChange={handleReportTypeChange}
                  required
                />
                {reportTypeError && (
                  <span className="text-xs" style={{ color: 'var(--art-danger)' }}>{reportTypeError}</span>
                )}
              </div>

              {/* Mapping */}
              <ArtComboBox
                label="Mapping"
                options={mappingOptions}
                selected={selectedMappingOption}
                onChange={handleMappingChange}
                placeholder="Select or create mapping…"
                clearable
              />

              {/* From Currency */}
              <ArtComboBox
                label="From Currency"
                options={currencyOptions}
                selected={fromCurrencyOption}
                onChange={(opt) => setFromCurrency(opt?.value ?? 'EUR')}
                onSubmit={(text) => { if (text) setFromCurrency(text.toUpperCase()); }}
                placeholder="EUR"
                isLoading={currenciesLoading}
                searchable
              />

              {/* To Currency */}
              <div className="flex flex-col gap-1">
                <ArtComboBox
                  label="To Currency"
                  options={currencyOptions}
                  selected={toCurrencyOption}
                  onChange={(opt) => setToCurrency(opt?.value ?? 'EUR')}
                  onSubmit={(text) => { if (text) setToCurrency(text.toUpperCase()); }}
                  placeholder="EUR"
                  isLoading={currenciesLoading}
                  searchable
                />
                {fromCurrency !== toCurrency && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {rateLoading
                      ? 'Loading rate…'
                      : currencyRate != null
                        ? `1 ${fromCurrency} = ${currencyRate.toFixed(4)} ${toCurrency}`
                        : 'Rate unavailable'}
                  </span>
                )}
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
            onSheetCreateTotalColumnChange={handleSheetCreateTotalColumnChange}
            collapseOpen={layoutOpen}
            onCollapseChange={handleLayoutOpen}
          />
        )}

        {/* ==== Row Mappings ==== */}
        <RowMappingsSection
          ref={rowMappingsSectionRef}
          rowMappings={rowMappings}
          exportSettingOptions={exportSettingOptions}
          exportSettingId={exportSettingId}
          onExportSettingChange={setExportSettingId}
          mappedValueOptions={mappedValueOptions}
          collapseOpen={rowMappingsOpen}
          onCollapseChange={handleRowMappingsOpen}
        />
      </ArtForm>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import * as yup from 'yup';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { useReports, type UploadedReport } from '@/providers/ReportProvider';
import { useMappings, useCreateMapping, useUpdateMapping } from '@/hooks/mapping.hooks';
import type {
  MappingConfig, RowMapping, SourceLayout, ReportType, TableRegion, MappingModel, SheetConfig,
} from '@/models/mapping.models';
import type { ArtColor } from '@/components/ui/art.types';
import type { ArtSelectOption } from '@/components/ui/ArtSelect';
import type { ArtFormButtonProps } from '@/components/ui/ArtForm';
import { autoDetectLayout, extractRowNames, applyMappingMultiSheet } from './applyMapping';
import ColorSelect from './ColorSelect';
import ArtButton from '@/components/ui/ArtButton';
import ArtInput from '@/components/ui/ArtInput';
import ArtSelect from '@/components/ui/ArtSelect';
import ArtComboBox, { type ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtDataTable, { type ArtColumn } from '@/components/ui/ArtDataTable';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtForm from '@/components/ui/ArtForm';
import { useArtDialog } from '@/components/ui/ArtDialog';
import ExcelViewer from '@/page/dashboard/ExcelViewer';

// ==== Types ====

type RowMappingRow = RowMapping & { _index: number };

// ==== Constants ====

const REPORT_TYPE_OPTIONS: ArtSelectOption[] = [
  { label: 'Profit & Loss', value: 'pnl' },
  { label: 'Financial Position', value: 'financial_position' },
];

const SaveNameSchema = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
});

// ==== Helpers ====

function colLetter(n: number): string {
  let result = '';
  let col = n;
  while (col >= 0) {
    result = String.fromCharCode(65 + (col % 26)) + result;
    col = Math.floor(col / 26) - 1;
  }
  return result;
}

function columnLetterOptions(totalCols: number): ArtSelectOption[] {
  return Array.from({ length: totalCols }, (_, i) => ({
    label: colLetter(i),
    value: String(i),
  }));
}

/** Ensure layout.regions is always a proper array (guards against JSON deserialization edge cases) */
function sanitizeLayout(layout: SourceLayout): SourceLayout {
  return {
    ...layout,
    regions: Array.isArray(layout.regions) ? layout.regions : [],
  };
}

// ==== Row Mappings section (memo'd — expensive table, isolated from sibling renders) ====

// TODO: Refactor. Instead of storing all JSON config at one place, should we change input, and validate and combine all settings via Yup when submitting form
// Cause of overhead: No rerendering of whole section when changing one value -> Instead we rerender only user interactions with unique inputs.
// Btw ArtDataTable is already memoized, memo probably bad here, cause Memo does it's own rerendering which probably be heavier
// Plus we should hide collapsible (via close()), when opening "Source Layout" and lazy rerendering (if make sense) of "Row Mappings" when opening it. 
// No need to render it at all, when user is working with "Source Layout". Creating unnecessary overhead
interface RowMappingsSectionProps {
  rowMappings: RowMappingRow[];
  onUpdate: (index: number, patch: Partial<RowMappingRow>) => void;
}

const RowMappingsSection = memo(function RowMappingsSection({ rowMappings, onUpdate }: RowMappingsSectionProps) {
  const columns: ArtColumn<RowMappingRow>[] = [
    {
      key: 'sourceName',
      label: 'Source Name',
      width: 200,
      render: (row) => (
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.sourceName}</span>
      ),
    },
    {
      key: 'displayName',
      label: 'Display Name',
      width: 200,
      render: (row) => (
        <ArtInput
          value={row.displayName ?? ''}
          placeholder={row.sourceName}
          onChange={(e) => onUpdate(row._index, { displayName: e.target.value || undefined })}
        />
      ),
    },
    {
      key: 'nameColor',
      label: 'Name Color',
      width: 130,
      render: (row) => (
        <ColorSelect value={row.nameColor} onChange={(c) => onUpdate(row._index, { nameColor: c })} />
      ),
    },
    {
      key: 'valueColor',
      label: 'Value Color',
      width: 130,
      render: (row) => (
        <ColorSelect value={row.valueColor} onChange={(c) => onUpdate(row._index, { valueColor: c })} />
      ),
    },
    {
      key: 'hidden',
      label: 'Hide',
      width: 60,
      render: (row) => (
        <ArtCheckbox
          size="sm"
          checked={row.hidden ?? false}
          onChange={(e) => onUpdate(row._index, { hidden: e.target.checked })}
        />
      ),
    },
  ];

  return (
    <ArtCollapse title="Row Mappings" defaultOpen>
      <ArtDataTable<RowMappingRow>
        columns={columns}
        data={rowMappings}
        rowKey={(row) => String(row._index)}
        pageSize={rowMappings.length}
        emptyMessage="No rows found in the uploaded file"
      />
    </ArtCollapse>
  );
});

// ==== Source Layout section (memo'd) ====

// TODO: Refactor: Each Sheet have their own config, remove Sheets. No need. ArtTabs gonna use each sheet as separate tab.
interface SourceLayoutSectionProps {
  detectedLayout: SourceLayout;
  autoDetectedLayout: SourceLayout | null;
  totalCols: number;
  colOptions: ArtSelectOption[];
  workbook: XLSX.WorkBook;
  onLayoutChange: (layout: SourceLayout) => void;
}

const SourceLayoutSection = memo(function SourceLayoutSection({
  detectedLayout,
  autoDetectedLayout,
  totalCols,
  colOptions,
  workbook,
  onLayoutChange,
}: SourceLayoutSectionProps) {
  const regions = detectedLayout.regions;

  // ==== Auto-detected stats (static) ====
  const autoRegionCount = autoDetectedLayout?.regions.length ?? 0;
  const autoValueColCount = autoDetectedLayout?.regions.reduce((s, r) => s + r.valueColumns.length, 0) ?? 0;

  // ==== Current assignment stats ====
  const currentUnassigned = (() => {
    if (totalCols === 0) return 0;
    const used = new Set<number>();
    for (const r of regions) {
      used.add(r.descriptionColumn);
      for (const v of r.valueColumns) used.add(v);
    }
    return totalCols - used.size;
  })();

  // ==== Region mutators ====
  function updateRegion(i: number, patch: Partial<TableRegion>) {
    const newRegions = regions.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onLayoutChange({ ...detectedLayout, regions: newRegions });
  }

  function addRegion() {
    onLayoutChange({
      ...detectedLayout,
      regions: [...regions, { descriptionColumn: 0, valueColumns: [] }],
    });
  }

  function removeRegion(i: number) {
    if (regions.length <= 1) return;
    onLayoutChange({ ...detectedLayout, regions: regions.filter((_, idx) => idx !== i) });
  }

  return (
    <ArtCollapse title="Source Layout">
      <div className="flex flex-col gap-4">
        {/* Auto-detected info */}
        <div
          className="rounded px-3 py-2 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p style={{ color: 'var(--text-muted)' }}>
            Auto-detected:{' '}
            <strong style={{ color: 'var(--text)' }}>{autoRegionCount}</strong> region{autoRegionCount !== 1 ? 's' : ''}
            {autoDetectedLayout && autoDetectedLayout.regions.length > 0 && (
              <span style={{ color: 'var(--text-muted)' }}>
                {' '}(
                {autoDetectedLayout.regions.map((r, i) => (
                  <span key={i}>
                    {i > 0 && ', '}
                    <strong style={{ color: 'var(--text)' }}>{colLetter(r.descriptionColumn)}</strong>
                    {r.valueColumns.length > 0 && (
                      <> → {r.valueColumns.map((vc, vi) => (
                        <React.Fragment key={vc}>
                          {vi > 0 && ', '}
                          <strong style={{ color: 'var(--text)' }}>{colLetter(vc)}</strong>
                        </React.Fragment>
                      ))}</>
                    )}
                  </span>
                ))}
                )
              </span>
            )}
            {' — '}
            <strong style={{ color: 'var(--text)' }}>{autoValueColCount}</strong> value column{autoValueColCount !== 1 ? 's' : ''} out of{' '}
            <strong style={{ color: 'var(--text)' }}>{totalCols}</strong> total
          </p>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
            {currentUnassigned === 0 ? (
              <span style={{ color: 'var(--art-success)' }}>All columns assigned</span>
            ) : (
              <>
                <strong style={{ color: 'var(--art-warning)' }}>{currentUnassigned}</strong>
                {' '}column{currentUnassigned !== 1 ? 's' : ''} not in any region — ignored when reading
              </>
            )}
          </p>
        </div>

        {/* Regions */}
        {regions.map((region, i) => {
          const dataStart = region.startRow ?? (detectedLayout.headerRow + 1);
          return (
            <div
              key={i}
              className="flex flex-col gap-3 rounded p-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              {/* Art Component? Or just applying region color to this as well */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                  Region {i + 1}
                </span>
                {regions.length > 1 && (
                  <ArtButton variant="ghost" color="danger" onClick={() => removeRegion(i)}>
                    Remove
                  </ArtButton>
                )}
              </div>

              <div className="flex items-end gap-3 flex-wrap">
                {/* Description column */}
                <div style={{ width: 120 }}>
                  <ArtSelect
                    label="Description column"
                    options={colOptions}
                    selected={colOptions.find((o) => o.value === String(region.descriptionColumn)) ?? null}
                    onChange={(opt) => updateRegion(i, { descriptionColumn: Number(opt?.value ?? 0) })}
                  />
                </div>

                {/* Value columns — clickable letter buttons */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Value columns</span>
                  <div className="flex flex-wrap gap-1">
                    {colOptions
                      .filter((o) => Number(o.value) !== region.descriptionColumn)
                      .map((o) => {
                        const col = Number(o.value);
                        const isSelected = region.valueColumns.includes(col);
                        return (
                          <button
                            key={col}
                            type="button"
                            onClick={() => {
                              const newCols = isSelected
                                ? region.valueColumns.filter((c) => c !== col)
                                : [...region.valueColumns, col].sort((a, b) => a - b);
                              updateRegion(i, { valueColumns: newCols });
                            }}
                            style={{
                              padding: '2px 10px',
                              borderRadius: 4,
                              fontSize: 12,
                              fontFamily: 'monospace',
                              cursor: 'pointer',
                              border: `1px solid ${isSelected ? 'var(--art-primary)' : 'var(--border)'}`,
                              background: isSelected
                                ? 'color-mix(in srgb, var(--art-primary) 20%, transparent)'
                                : 'var(--surface)',
                              color: isSelected ? 'var(--art-primary)' : 'var(--text)',
                            }}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                  </div>
                  {region.valueColumns.length === 0 && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      None selected — click columns above to include them
                    </span>
                  )}
                </div>

                {/* Data start row — 1-indexed to match Excel */}
                <div className="flex flex-col gap-1" style={{ maxWidth: 110 }}>
                  <ArtInput
                    label="Data from row"
                    type="number"
                    value={String(dataStart + 1)}
                    onChange={(e) => {
                      const display = Math.max(1, Number(e.target.value) || 1);
                      updateRegion(i, { startRow: display - 1 });
                    }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Excel row (column labels are on the row above)
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        <div>
          <ArtButton variant="outlined" onClick={addRegion}>+ Add region</ArtButton>
        </div>

        {/* Raw Excel preview with region color highlighting */}
        <ExcelViewer workbook={workbook} layout={detectedLayout} />
      </div>
    </ArtCollapse>
  );
});

// ==== Main component ====

export default function MappingStep() {
  const router = useRouter();
  const dialog = useArtDialog();
  const { reports, updateReport, removeReport } = useReports();
  const { data: mappings = [] } = useMappings();
  const createMapping = useCreateMapping();
  const updateMappingMut = useUpdateMapping();

  const report = reports[reports.length - 1] as UploadedReport | undefined;

  // ==== Form state ====

  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('pnl');
  const [currency, setCurrency] = useState('EUR');
  const [rowMappings, setRowMappings] = useState<RowMappingRow[]>([]);
  // TODO: Bad const naming
  const [detectedLayout, setDetectedLayout] = useState<SourceLayout | null>(null);
  const [autoDetectedLayout, setAutoDetectedLayout] = useState<SourceLayout | null>(null);
  const [sheetsConfig, setSheetsConfig] = useState<Record<string, SheetConfig>>({});

  // ==== Sheet info for column options ====

  const totalCols = (() => {
    if (!report) return 0;
    const ws = report.workbook.Sheets[report.activeSheet];
    if (!ws?.['!ref']) return 0;
    return XLSX.utils.decode_range(ws['!ref']!).e.c + 1;
  })();

  const colOptions = columnLetterOptions(totalCols);

  // ==== Auto-detect on mount (runs once) ====

  // TODO: Check what Ai done. Seems overkill at first look.
  useEffect(() => {
    if (!report) return;
    const layout = autoDetectLayout(report.workbook, report.activeSheet);
    setDetectedLayout(layout);
    setAutoDetectedLayout(layout);
    const cfg: Record<string, SheetConfig> = {};
    for (const s of report.workbook.SheetNames) cfg[s] = { use: true };
    setSheetsConfig(cfg);
    const names = extractRowNames(report.workbook, report.activeSheet, layout);
    setRowMappings(names.map((sourceName, i) => ({ sourceName, _index: i })));
  }, [report]);

  // ==== Stable callbacks — must be declared before any early returns ====

  const handleRowUpdate = useCallback((index: number, patch: Partial<RowMappingRow>) => {
    setRowMappings((prev) => prev.map((r) => (r._index === index ? { ...r, ...patch } : r)));
  }, []);

  const handleLayoutChange = useCallback((layout: SourceLayout) => {
    setDetectedLayout(layout);
    if (report) {
      const names = extractRowNames(report.workbook, report.activeSheet, layout);
      setRowMappings((prev) => {
        const bySource = new Map(prev.map((r) => [r.sourceName, r]));
        return names.map((sourceName, i) => {
          const existing = bySource.get(sourceName);
          return existing ? { ...existing, _index: i } : { sourceName, _index: i };
        });
      });
    }
  }, [report]);

  // ==== Redirect if no report ====

  if (!report) {
    router.push('/upload');
    return null;
  }

  // ==== Derived ====

  const selectedMapping = mappings.find((m) => m.id === selectedMappingId);
  const isGlobalSelected = selectedMapping?.isGlobal ?? false;
  const isUserOwned = !!selectedMapping && !selectedMapping.isGlobal;

  // ==== Sync handlers ====

  // TODO: Too heavy. Refactor: Instead of storing all JSON config at one place, should we change input, and validate and combine all settings when submitting form. 
  function applyMappingToForm(mapping: MappingModel) {
    setReportType(mapping.reportType);
    setCurrency(mapping.config.currency);
    if (mapping.config.sheetsConfig) setSheetsConfig(mapping.config.sheetsConfig);
    if (mapping.config.sourceLayout) {
      const layout = sanitizeLayout(mapping.config.sourceLayout);
      setDetectedLayout(layout);
      // Re-extract row names with the mapping's layout, then merge existing transforms
      if (report) {
        const names = extractRowNames(report.workbook, report.activeSheet, layout);
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
  }

  function handleMappingChange(opt: ArtComboBoxOption | null) {
    const id = opt?.value ?? null;
    setSelectedMappingId(id);
    if (id) {
      const mapping = mappings.find((m) => m.id === id);
      if (mapping) applyMappingToForm(mapping);
    }
  }

  function handleReportTypeChange(opt: ArtSelectOption | null) {
    const newType = (opt?.value as ReportType) ?? 'pnl';
    setReportType(newType);
    if (selectedMappingId) {
      const mapping = mappings.find((m) => m.id === selectedMappingId);
      if (mapping && mapping.reportType !== newType) {
        setSelectedMappingId(null);
      }
    }
  }

  // ==== Build config ====

  function buildConfig(): MappingConfig {
    const layout = detectedLayout ?? autoDetectLayout(report!.workbook, report!.activeSheet);
    return {
      currency,
      sourceLayout: layout,
      sheetsConfig,
      rowMappings: rowMappings.map(({ _index, ...rest }) => rest),
      columnHeaders: [],
    };
  }

  // ==== Apply and navigate ====

  function applyAndNavigate() {
    const config = buildConfig();
    const allSheets = report!.workbook.SheetNames;
    const usedSheets = allSheets.filter((s) => sheetsConfig[s]?.use !== false);
    const { headers, rows, rowColors, valueColors } = applyMappingMultiSheet(
      report!.workbook,
      usedSheets.length > 0 ? usedSheets : [report!.activeSheet],
      config,
    );
    updateReport(report!.id, {
      mappingId: selectedMappingId ?? undefined,
      processedHeaders: headers,
      processedRows: rows,
      rowColors,
      valueColors,
    });
    router.push('/');
  }

  // ==== Save mapping config dialog ====

  // TODO: Too complicated. Redifine logic, can be empty for now, put to separate file for readability.
  function openSaveDialog() {
    const defaultName = selectedMapping?.name ?? '';
    const nameRef = { current: defaultName };
    const errorRef = { current: '' };
    let errorSetter: ((msg: string) => void) | null = null;

    // We use a small stateful node for the error message inside the dialog
    function DialogContent() {
      const [err, setErr] = useState('');
      errorSetter = setErr;
      return (
        <div className="flex flex-col gap-3">
          <ArtInput
            label="Mapping name"
            defaultValue={defaultName}
            placeholder="My mapping"
            onChange={(e) => { nameRef.current = e.target.value; errorRef.current = ''; }}
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
              if (err instanceof yup.ValidationError) {
                errorSetter?.(err.errors[0]);
                return;
              }
            }
            const config = buildConfig();
            if (isUserOwned && selectedMappingId) {
              await updateMappingMut.mutateAsync({
                id: selectedMappingId,
                body: { name: nameRef.current, reportType, config },
              });
            } else {
              const created = await createMapping.mutateAsync({
                name: nameRef.current,
                reportType,
                config,
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

  // ==== Form submit = upload ====

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyAndNavigate();
  }

  // ==== Mapping options filtered by report type ====

  // TODO: Should be managed by BE, not FE. We rely on BE data.
  const mappingOptions: ArtComboBoxOption[] = mappings
    .filter((m) => m.reportType === reportType)
    .map((m) => ({
      label: m.isGlobal ? `${m.name} (Global)` : m.name,
      value: m.id,
    }));

  const selectedMappingOption = mappingOptions.find((o) => o.value === selectedMappingId) ?? null;

  // ==== Form buttons ====

  const formButtons: ArtFormButtonProps[] = [
    { label: 'Upload', color: 'primary', type: 'submit' },
    { label: 'Upload without changes', variant: 'outlined', onClick: applyAndNavigate },
  ];

  return (
    <div className="mx-auto max-w-5xl py-8">
      <h1 className="mb-1 text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Configure Mapping
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        Set how <strong>{report.fileName}</strong> should be read and displayed.
      </p>

      <ArtForm onSubmit={handleSubmit} buttons={formButtons}>
        {/* ==== Mapping section ==== */}
        <ArtCollapse title="Mapping" defaultOpen>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <ArtSelect
                label="Report Type"
                options={REPORT_TYPE_OPTIONS}
                selected={REPORT_TYPE_OPTIONS.find((o) => o.value === reportType) ?? null}
                onChange={handleReportTypeChange}
              />
              <ArtComboBox
                label="Mapping"
                options={mappingOptions}
                selected={selectedMappingOption}
                onChange={handleMappingChange}
                placeholder="Select or create mapping…"
                clearable
              />
              <ArtInput
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="EUR"
              />
              <div className="flex items-end">
                <ArtButton variant="outlined" onClick={openSaveDialog} type="button">
                  {isGlobalSelected ? 'Save as copy' : isUserOwned ? 'Update mapping' : 'Save mapping config'}
                </ArtButton>
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

        {/* ==== Sheets section ==== */}
        {report.workbook.SheetNames.length > 1 && (
          <ArtCollapse title="Sheets">
            <div className="flex flex-col gap-2">
              {report.workbook.SheetNames.map((sheetName) => (
                <div key={sheetName} className="flex items-center gap-3">
                  <ArtCheckbox
                    size="sm"
                    checked={sheetsConfig[sheetName]?.use !== false}
                    onChange={(e) =>
                      setSheetsConfig((prev) => ({ ...prev, [sheetName]: { use: e.target.checked } }))
                    }
                  />
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{sheetName}</span>
                </div>
              ))}
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Only checked sheets are included. The same layout applies to all selected sheets.
              </p>
            </div>
          </ArtCollapse>
        )}

        {/* ==== Source Layout section (memo'd) ==== */}
        {detectedLayout && (
          <SourceLayoutSection
            detectedLayout={detectedLayout}
            autoDetectedLayout={autoDetectedLayout}
            totalCols={totalCols}
            colOptions={colOptions}
            workbook={report.workbook}

            onLayoutChange={handleLayoutChange}
          />
        )}

        {/* ==== Row Mappings section (memo'd) ==== */}
        <RowMappingsSection rowMappings={rowMappings} onUpdate={handleRowUpdate} />
      </ArtForm>

      <div className="mt-4">
        <ArtButton variant="ghost" color="danger" onClick={() => { removeReport(report.id); router.push('/upload'); }}>
          Cancel upload
        </ArtButton>
      </div>
    </div>
  );
}

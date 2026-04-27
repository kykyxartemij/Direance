'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { SourceLayout, TableRegion, SheetConfig, TotalColumnDef, TotalColumnMode } from '@/models/mapping.models';
import type { ArtSelectOption } from '@/components/ui/ArtSelect';
import type { ArtColor } from '@/components/ui/art.types';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtTabs, { type ArtTab } from '@/components/ui/ArtTabs';
import ArtButton from '@/components/ui/ArtButton';
import ArtSelect from '@/components/ui/ArtSelect';
import ArtInput from '@/components/ui/ArtInput';
import ExcelViewer from '@/page/dashboard/ExcelViewer';

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

// ==== Region accent palette (matches ExcelViewer) ====

const REGION_ART_COLORS: ArtColor[] = ['primary', 'success', 'warning', 'danger'];

// ==== Sheet tab content ====

// ==== Total column mode options ====

const TOTAL_COL_MODE_OPTIONS: { value: TotalColumnMode; label: string }[] = [
  { value: 'none', label: 'Regular' },
  { value: 'append', label: 'With Total' },
  { value: 'only', label: 'Only Total' },
];

interface SheetTabProps {
  sheetName: string;
  workbook: XLSX.WorkBook;
  layout: SourceLayout;
  autoDetectedLayout: SourceLayout | null;
  config: SheetConfig;
  onLayoutChange: (layout: SourceLayout) => void;
  /** Called only when mode changes — triggers row-mapping flush in parent */
  onModeChange: (mode: 'combine' | 'skip') => void;
  /** Called when totalColumnMode changes — does NOT flush row mappings */
  onTotalColumnModeChange: (mode: TotalColumnMode) => void;
}

function SheetTab({
  sheetName,
  workbook,
  layout,
  autoDetectedLayout,
  config,
  onLayoutChange,
  onModeChange,
  onTotalColumnModeChange,
}: SheetTabProps) {
  const mode = config.mode;
  const totalColumnMode: TotalColumnMode = config.totalColumnMode ?? 'none';
  const ws = workbook.Sheets[sheetName];
  const totalCols = ws?.['!ref'] ? XLSX.utils.decode_range(ws['!ref']!).e.c + 1 : 0;
  const colOptions = columnLetterOptions(totalCols);
  const regions = layout.regions;
  const totalColumns = layout.totalColumns ?? [];
  const isSkipped = mode === 'skip';

  // ==== Stats ====

  const autoRegionCount = autoDetectedLayout?.regions.length ?? 0;
  const autoValueColCount =
    autoDetectedLayout?.regions.reduce((s, r) => s + r.valueColumns.length, 0) ?? 0;

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
    onLayoutChange({ ...layout, regions: regions.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  }

  function addRegion() {
    onLayoutChange({ ...layout, regions: [...regions, { descriptionColumn: 0, valueColumns: [] }] });
  }

  function removeRegion(i: number) {
    if (regions.length <= 1) return;
    onLayoutChange({ ...layout, regions: regions.filter((_, idx) => idx !== i) });
  }

  // ==== Total column mutators ====

  /** Resolve output value header labels from regions (same logic as applyMapping) */
  function getValueHeaders(): string[] {
    const primaryRegion = regions[0];
    if (!primaryRegion) return [];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];
    const dataStart = primaryRegion.startRow ?? (layout.headerRow + 1);
    const headerRowIdx = Math.max(0, dataStart - 1);
    const valCols = primaryRegion.valueColumns.length > 0
      ? primaryRegion.valueColumns
      : [];
    return valCols.map((vc) => {
      const raw = grid[headerRowIdx]?.[vc];
      return raw != null && raw !== '' ? String(raw) : `Column ${colLetter(vc)}`;
    });
  }

  function addTotalColumn() {
    const newTc: TotalColumnDef = { label: 'Total', sourceValueIndices: [] };
    onLayoutChange({ ...layout, totalColumns: [...totalColumns, newTc] });
  }

  function updateTotalColumn(i: number, patch: Partial<TotalColumnDef>) {
    onLayoutChange({
      ...layout,
      totalColumns: totalColumns.map((tc, idx) => (idx === i ? { ...tc, ...patch } : tc)),
    });
  }

  function removeTotalColumn(i: number) {
    onLayoutChange({ ...layout, totalColumns: totalColumns.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="flex flex-col gap-4 pt-3" style={{ opacity: isSkipped ? 0.6 : 1 }}>
      {/* Mode + Total column mode */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <ArtButton
            type="button"
            size="sm"
            variant={mode === 'combine' ? 'default' : 'ghost'}
            color={mode === 'combine' ? 'primary' : undefined}
            onClick={() => onModeChange('combine')}
          >
            Combine
          </ArtButton>
          <ArtButton
            type="button"
            size="sm"
            variant={mode === 'skip' ? 'default' : 'ghost'}
            color={mode === 'skip' ? 'danger' : undefined}
            onClick={() => onModeChange('skip')}
          >
            Skip
          </ArtButton>
        </div>
        {!isSkipped && (
          <div className="flex items-center gap-1">
            {TOTAL_COL_MODE_OPTIONS.map((opt) => (
              <ArtButton
                key={opt.value}
                type="button"
                size="sm"
                variant={totalColumnMode === opt.value ? 'default' : 'ghost'}
                color={totalColumnMode === opt.value ? 'primary' : undefined}
                onClick={() => onTotalColumnModeChange(opt.value)}
              >
                {opt.label}
              </ArtButton>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {!isSkipped && (
        <div
          className="rounded px-3 py-2 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p style={{ color: 'var(--text-muted)' }}>
            Auto-detected:{' '}
            <strong style={{ color: 'var(--text)' }}>{autoRegionCount}</strong>{' '}
            region{autoRegionCount !== 1 ? 's' : ''}
            {autoDetectedLayout && autoDetectedLayout.regions.length > 0 && (
              <span>
                {' '}(
                {autoDetectedLayout.regions.map((r, i) => (
                  <span key={i}>
                    {i > 0 && ', '}
                    <strong style={{ color: 'var(--text)' }}>{colLetter(r.descriptionColumn)}</strong>
                    {r.valueColumns.length > 0 && (
                      <>
                        {' '}→{' '}
                        {r.valueColumns.map((vc, vi) => (
                          <span key={vc}>
                            {vi > 0 && ', '}
                            <strong style={{ color: 'var(--text)' }}>{colLetter(vc)}</strong>
                          </span>
                        ))}
                      </>
                    )}
                  </span>
                ))}
                )
              </span>
            )}
            {' — '}
            <strong style={{ color: 'var(--text)' }}>{autoValueColCount}</strong> value col{autoValueColCount !== 1 ? 's' : ''} of{' '}
            <strong style={{ color: 'var(--text)' }}>{totalCols}</strong> total
          </p>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
            {currentUnassigned === 0 ? (
              <span style={{ color: 'var(--art-success)' }}>All columns assigned</span>
            ) : (
              <>
                <strong style={{ color: 'var(--art-warning)' }}>{currentUnassigned}</strong>
                {' '}col{currentUnassigned !== 1 ? 's' : ''} unassigned — ignored when reading
              </>
            )}
          </p>
        </div>
      )}

      {/* Regions */}
      {!isSkipped &&
        regions.map((region, i) => {
          const artColor = REGION_ART_COLORS[i % REGION_ART_COLORS.length];
          const accentVar = `--art-${artColor}`;
          const dataStart = region.startRow ?? (layout.headerRow + 1);

          return (
            <div
              key={i}
              className="flex-col gap-2 rounded p-3"
              style={{
                background: `color-mix(in srgb, var(${accentVar}) 5%, var(--surface))`,
                border: `1px solid color-mix(in srgb, var(${accentVar}) 35%, var(--border))`,
              }}
            >
              {/* Row 1: Region label + Remove */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase" style={{ color: `var(${accentVar})` }}>
                  Region {i + 1}
                </span>
                <ArtButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  color="danger"
                  onClick={() => removeRegion(i)}
                  style={{ visibility: regions.length > 1 ? 'visible' : 'hidden' }}
                >
                  Remove
                </ArtButton>
              </div>

              {/* Row 2: 3-column grid, each input full-width */}
              <div className="grid grid-cols-3 gap-4 items-start">
                {/* Description column */}
                <ArtSelect
                  label="Description column"
                  options={colOptions}
                  selected={colOptions.find((o) => o.value === String(region.descriptionColumn)) ?? null}
                  onChange={(opt) => updateRegion(i, { descriptionColumn: Number(opt?.value ?? 0) })}
                />

                {/* Data from row */}
                <div className="flex flex-col gap-1">
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
                    Labels on row above
                  </span>
                </div>

                {/* Value columns */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Value columns</span>
                  <div className="flex flex-wrap gap-1">
                    {colOptions
                      .filter((o) => Number(o.value) !== region.descriptionColumn)
                      .map((o) => {
                        const col = Number(o.value);
                        const isSelected = region.valueColumns.includes(col);
                        return (
                          <ArtButton
                            key={col}
                            type="button"
                            size="sm"
                            variant={isSelected ? 'outlined' : 'ghost'}
                            color={isSelected ? artColor : undefined}
                            className="font-mono"
                            onClick={() => {
                              const newCols = isSelected
                                ? region.valueColumns.filter((c) => c !== col)
                                : [...region.valueColumns, col].sort((a, b) => a - b);
                              updateRegion(i, { valueColumns: newCols });
                            }}
                          >
                            {o.label}
                          </ArtButton>
                        );
                      })}
                  </div>
                  {region.valueColumns.length === 0 && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      None — click columns above to include them
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

      {!isSkipped && (
        <div className="flex gap-2">
          <ArtButton type="button" variant="outlined" onClick={addRegion}>+ Add region</ArtButton>
          {totalColumnMode !== 'none' && (
            <ArtButton type="button" variant="outlined" onClick={addTotalColumn}>+ Add total column</ArtButton>
          )}
        </div>
      )}

      {/* Total column cards */}
      {!isSkipped && totalColumnMode !== 'none' && totalColumns.map((tc, i) => {
        const valueHeaders = getValueHeaders();
        return (
          <div
            key={i}
            className="flex-col gap-2 rounded p-3"
            style={{
              background: 'color-mix(in srgb, var(--text-muted) 5%, var(--surface))',
              border: '1px solid color-mix(in srgb, var(--text-muted) 35%, var(--border))',
            }}
          >
            {/* Row 1: Label + Remove */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                Total Column {totalColumns.length > 1 ? i + 1 : ''}
              </span>
              <ArtButton
                type="button"
                size="sm"
                variant="ghost"
                color="danger"
                onClick={() => removeTotalColumn(i)}
              >
                Remove
              </ArtButton>
            </div>

            {/* Row 2: Name + source value columns */}
            <div className="grid grid-cols-2 gap-4 items-start">
              <ArtInput
                label="Label"
                defaultValue={tc.label}
                onChange={(e) => updateTotalColumn(i, { label: e.target.value })}
              />

              <div className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Sum columns {tc.sourceValueIndices.length === 0 && '(all)'}
                </span>
                <div className="flex flex-wrap gap-1">
                  {valueHeaders.map((header, vi) => {
                    const isSelected = tc.sourceValueIndices.length === 0 || tc.sourceValueIndices.includes(vi);
                    const isAllMode = tc.sourceValueIndices.length === 0;
                    return (
                      <ArtButton
                        key={vi}
                        type="button"
                        size="sm"
                        variant={isSelected ? 'outlined' : 'ghost'}
                        color={isSelected ? 'primary' : undefined}
                        onClick={() => {
                          if (isAllMode) {
                            // Switch from "all" to explicit: select all except this one
                            const all = valueHeaders.map((_, idx) => idx);
                            updateTotalColumn(i, { sourceValueIndices: all.filter((idx) => idx !== vi) });
                          } else {
                            const newIndices = isSelected
                              ? tc.sourceValueIndices.filter((idx) => idx !== vi)
                              : [...tc.sourceValueIndices, vi].sort((a, b) => a - b);
                            // If all selected, switch back to empty (= all)
                            updateTotalColumn(i, {
                              sourceValueIndices: newIndices.length === valueHeaders.length ? [] : newIndices,
                            });
                          }
                        }}
                      >
                        {header}
                      </ArtButton>
                    );
                  })}
                </div>
                {valueHeaders.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Add value columns to regions first
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Excel preview — pinned to this sheet */}
      <ExcelViewer workbook={workbook} fixedSheet={sheetName} layout={isSkipped ? undefined : layout} />
    </div>
  );
}

// ==== Main section ====

interface SourceLayoutSectionProps {
  workbook: XLSX.WorkBook;
  sheetLayouts: Record<string, SourceLayout>;
  autoDetectedLayouts: Record<string, SourceLayout>;
  sheetsConfig: Record<string, SheetConfig>;
  onSheetLayoutChange: (sheetName: string, layout: SourceLayout) => void;
  /** Called on mode change — parent should flush row mappings */
  onSheetModeChange: (sheetName: string, mode: 'combine' | 'skip') => void;
  /** Called on totalColumnMode change — does NOT flush row mappings */
  onSheetTotalColumnModeChange: (sheetName: string, mode: TotalColumnMode) => void;
  collapseOpen?: boolean;
  onCollapseChange?: (open: boolean) => void;
}

export default function SourceLayoutSection({
  workbook,
  sheetLayouts,
  autoDetectedLayouts,
  sheetsConfig,
  onSheetLayoutChange,
  onSheetModeChange,
  onSheetTotalColumnModeChange,
  collapseOpen,
  onCollapseChange,
}: SourceLayoutSectionProps) {
  const sheetNames = workbook.SheetNames;
  const [activeSheet, setActiveSheet] = useState(sheetNames[0] ?? '');

  const tabs: ArtTab[] = sheetNames.map((name) => ({
    value: name,
    label: name,
    color: sheetsConfig[name]?.mode === 'skip' ? ('danger' as const) : undefined,
  }));

  const layout = sheetLayouts[activeSheet];
  if (!layout) return null;

  return (
    <ArtCollapse title="Source Layout" open={collapseOpen} onChange={onCollapseChange}>
      <div className="flex flex-col gap-0">
        <ArtTabs tabs={tabs} value={activeSheet} onChange={setActiveSheet} />
        <SheetTab
          key={activeSheet}
          sheetName={activeSheet}
          workbook={workbook}
          layout={layout}
          autoDetectedLayout={autoDetectedLayouts[activeSheet] ?? null}
          config={sheetsConfig[activeSheet] ?? { mode: 'combine' }}
          onLayoutChange={(newLayout) => onSheetLayoutChange(activeSheet, newLayout)}
          onModeChange={(newMode) => onSheetModeChange(activeSheet, newMode)}
          onTotalColumnModeChange={(mode) => onSheetTotalColumnModeChange(activeSheet, mode)}
        />
      </div>
    </ArtCollapse>
  );
}

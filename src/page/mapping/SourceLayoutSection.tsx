'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { SourceLayout, TableRegion, SheetConfig } from '@/models/mapping.models';
import type { ArtSelectOption } from '@/components/ui/ArtSelect';
import type { ArtColor } from '@/components/ui/art.types';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtTabs, { type ArtTab } from '@/components/ui/ArtTabs';
import ArtButton from '@/components/ui/ArtButton';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
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

interface SheetTabProps {
  sheetName: string;
  workbook: XLSX.WorkBook;
  layout: SourceLayout;
  autoDetectedLayout: SourceLayout | null;
  config: SheetConfig;
  onLayoutChange: (layout: SourceLayout) => void;
  /** Called only when mode changes — triggers row-mapping flush in parent */
  onModeChange: (mode: 'combine' | 'skip') => void;
  /** Called when createTotalColumn toggles — does NOT flush row mappings */
  onCreateTotalColumnChange: (value: boolean) => void;
}

function SheetTab({
  sheetName,
  workbook,
  layout,
  autoDetectedLayout,
  config,
  onLayoutChange,
  onModeChange,
  onCreateTotalColumnChange,
}: SheetTabProps) {
  const mode = config.mode;
  const ws = workbook.Sheets[sheetName];
  const totalCols = ws?.['!ref'] ? XLSX.utils.decode_range(ws['!ref']!).e.c + 1 : 0;
  const colOptions = columnLetterOptions(totalCols);
  const regions = layout.regions;
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

  return (
    <div className="flex flex-col gap-4 pt-3" style={{ opacity: isSkipped ? 0.6 : 1 }}>
      {/* Mode + Create Total Column */}
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
        {/* Uncontrolled — reads defaultChecked from config on mount.
            SheetTab remounts on tab switch (key=activeSheet) so the value is always fresh. */}
        {!isSkipped && (
          <ArtCheckbox
            label="Create Total Column"
            size="sm"
            defaultChecked={config.createTotalColumn ?? false}
            onChange={(e) => onCreateTotalColumnChange(e.target.checked)}
          />
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
        <div>
          <ArtButton type="button" variant="outlined" onClick={addRegion}>+ Add region</ArtButton>
        </div>
      )}

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
  /** Called on createTotalColumn toggle — parent should NOT flush row mappings */
  onSheetCreateTotalColumnChange: (sheetName: string, value: boolean) => void;
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
  onSheetCreateTotalColumnChange,
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
          onCreateTotalColumnChange={(val) => onSheetCreateTotalColumnChange(activeSheet, val)}
        />
      </div>
    </ArtCollapse>
  );
}

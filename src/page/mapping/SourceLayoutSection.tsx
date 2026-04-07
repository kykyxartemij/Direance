'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { SourceLayout, TableRegion, SheetConfig } from '@/models/mapping.models';
import type { ArtSelectOption } from '@/components/ui/ArtSelect';
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

const REGION_ACCENTS = ['--art-primary', '--art-success', '--art-warning', '--art-danger'] as const;

// ==== Sheet tab content ====

interface SheetTabProps {
  sheetName: string;
  workbook: XLSX.WorkBook;
  layout: SourceLayout;
  autoDetectedLayout: SourceLayout | null;
  mode: 'combine' | 'skip';
  onLayoutChange: (layout: SourceLayout) => void;
  onModeChange: (mode: 'combine' | 'skip') => void;
}

function SheetTab({
  sheetName,
  workbook,
  layout,
  autoDetectedLayout,
  mode,
  onLayoutChange,
  onModeChange,
}: SheetTabProps) {
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

  // ==== Mode toggle buttons ====

  function modeBtn(label: string, value: 'combine' | 'skip') {
    const isActive = mode === value;
    const accent = value === 'skip' ? '--art-danger' : '--art-primary';
    return (
      <button
        key={value}
        type="button"
        onClick={() => onModeChange(value)}
        style={{
          padding: '3px 14px',
          borderRadius: 4,
          fontSize: 12,
          cursor: 'pointer',
          border: `1px solid ${isActive ? `var(${accent})` : 'var(--border)'}`,
          background: isActive ? `color-mix(in srgb, var(${accent}) 16%, transparent)` : 'transparent',
          color: isActive ? `var(${accent})` : 'var(--text-muted)',
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-3" style={{ opacity: isSkipped ? 0.6 : 1 }}>
      {/* Mode */}
      <div className="flex items-center gap-2">
        {modeBtn('Combine', 'combine')}
        {modeBtn('Skip', 'skip')}
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
                      <> → {r.valueColumns.map((vc, vi) => (
                        <span key={vc}>{vi > 0 && ', '}<strong style={{ color: 'var(--text)' }}>{colLetter(vc)}</strong></span>
                      ))}</>
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
          const accentVar = REGION_ACCENTS[i % REGION_ACCENTS.length];
          const dataStart = region.startRow ?? (layout.headerRow + 1);

          return (
            <div
              key={i}
              className="flex flex-col gap-3 rounded p-3"
              style={{
                background: `color-mix(in srgb, var(${accentVar}) 5%, var(--surface))`,
                border: `1px solid color-mix(in srgb, var(${accentVar}) 35%, var(--border))`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase" style={{ color: `var(${accentVar})` }}>
                  Region {i + 1}
                </span>
                {regions.length > 1 && (
                  <ArtButton type="button" variant="ghost" color="danger" onClick={() => removeRegion(i)}>
                    Remove
                  </ArtButton>
                )}
              </div>

              <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '140px 1fr 130px' }}>
                {/* Description column */}
                <ArtSelect
                  label="Description column"
                  options={colOptions}
                  selected={colOptions.find((o) => o.value === String(region.descriptionColumn)) ?? null}
                  onChange={(opt) => updateRegion(i, { descriptionColumn: Number(opt?.value ?? 0) })}
                />

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
                              border: `1px solid ${isSelected ? `var(${accentVar})` : 'var(--border)'}`,
                              background: isSelected
                                ? `color-mix(in srgb, var(${accentVar}) 20%, transparent)`
                                : 'var(--surface)',
                              color: isSelected ? `var(${accentVar})` : 'var(--text)',
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
                    Column labels are on the row above
                  </span>
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
  onSheetConfigChange: (sheetName: string, config: SheetConfig) => void;
  collapseOpen?: boolean;
  onCollapseChange?: (open: boolean) => void;
}

export default function SourceLayoutSection({
  workbook,
  sheetLayouts,
  autoDetectedLayouts,
  sheetsConfig,
  onSheetLayoutChange,
  onSheetConfigChange,
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
          mode={sheetsConfig[activeSheet]?.mode ?? 'combine'}
          onLayoutChange={(newLayout) => onSheetLayoutChange(activeSheet, newLayout)}
          onModeChange={(newMode) => onSheetConfigChange(activeSheet, { mode: newMode })}
        />
      </div>
    </ArtCollapse>
  );
}

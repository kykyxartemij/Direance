'use client';

import * as XLSX from 'xlsx';
import type { SourceLayout, TableRegion, SheetConfig } from '@/models/mapping.models';
import ArtButton from '@/components/ui/ArtButton';
import ArtSelect from '@/components/ui/ArtSelect';
import ArtInput from '@/components/ui/ArtInput';
import ExcelViewer from '@/page/reports/ExcelViewer';
import { colLetter, columnLetterOptions, REGION_ART_COLORS } from './helpers';

export interface SheetTabProps {
  sheetName: string;
  workbook: XLSX.WorkBook;
  layout: SourceLayout;
  autoDetectedLayout: SourceLayout | null;
  config: SheetConfig;
  onLayoutChange: (layout: SourceLayout) => void;
  /** Called only when mode changes — triggers row-mapping flush in parent */
  onModeChange: (mode: 'combine' | 'skip') => void;
}

export function SheetTab({
  sheetName,
  workbook,
  layout,
  autoDetectedLayout,
  config,
  onLayoutChange,
  onModeChange,
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

      {/* Stats */}
      {!isSkipped && (
        <div
          className="rounded px-3 py-2 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="art-text-muted">
            Auto-detected:{' '}
            <strong className="art-text-default">{autoRegionCount}</strong>{' '}
            region{autoRegionCount !== 1 ? 's' : ''}
            {autoDetectedLayout && autoDetectedLayout.regions.length > 0 && (
              <span>
                {' '}(
                {autoDetectedLayout.regions.map((r, i) => (
                  <span key={r.descriptionColumn}>
                    {i > 0 && ', '}
                    <strong className="art-text-default">{colLetter(r.descriptionColumn)}</strong>
                    {r.valueColumns.length > 0 && (
                      <>
                        {' '}→{' '}
                        {r.valueColumns.map((vc, vi) => (
                          <span key={vc}>
                            {vi > 0 && ', '}
                            <strong className="art-text-default">{colLetter(vc)}</strong>
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
            <strong className="art-text-default">{autoValueColCount}</strong> value col{autoValueColCount !== 1 ? 's' : ''} of{' '}
            <strong className="art-text-default">{totalCols}</strong> total
          </p>
          <p className="mt-1 art-text-muted">
            {currentUnassigned === 0 ? (
              <span className="art-text-success">All columns assigned</span>
            ) : (
              <>
                <strong className="art-text-warning">{currentUnassigned}</strong>
                {' '}col{currentUnassigned !== 1 ? 's' : ''} unassigned (ignored when reading)
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
              key={region.descriptionColumn}
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
                  <span className="text-xs art-text-muted">
                    Labels on row above
                  </span>
                </div>

                {/* Value columns */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs art-text-muted">Value columns</span>
                  <div className="flex flex-wrap gap-1">
                    {colOptions.flatMap((o) => {
                        const col = Number(o.value);
                        if (col === region.descriptionColumn) return [];
                        const isSelected = region.valueColumns.includes(col);
                        return [(
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
                        )];
                      })}
                  </div>
                  {region.valueColumns.length === 0 && (
                    <span className="text-xs art-text-muted">
                      None, click columns above to include them
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
        </div>
      )}

      {/* Excel preview — pinned to this sheet */}
      <ExcelViewer workbook={workbook} fixedSheet={sheetName} layout={isSkipped ? undefined : layout} />
    </div>
  );
}

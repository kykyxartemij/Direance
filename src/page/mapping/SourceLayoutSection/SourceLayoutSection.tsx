'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { SourceLayout, SheetConfig, TotalColumnMode } from '@/models/mapping.models';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtTabs, { type ArtTab } from '@/components/ui/ArtTabs';
import { SheetTab } from './SheetTab';

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
  /** Skip the outer ArtCollapse wrapper — caller already provides one. */
  bare?: boolean;
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
  bare = false,
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

  const body = (
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
  );

  if (bare) return body;

  return (
    <ArtCollapse title="Source Layout" open={collapseOpen} onChange={onCollapseChange}>
      {body}
    </ArtCollapse>
  );
}

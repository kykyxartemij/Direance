'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { RowMapping } from '@/models/mapping.models';
import type { ArtColor } from '@/components/ui/art.types';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import ArtComboBox from '@/components/ui/ArtComboBox';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtDataTable, { ArtDataTr, ArtDataTd, type ArtColumn } from '@/components/ui/ArtDataTable';
import ColorSelect from './ColorSelect';

// ==== Types ====

export type RowMappingRow = RowMapping & { _index: number };

export interface RowMappingsSectionRef {
  getRowMappings(): RowMappingRow[];
}

interface RowMappingsSectionProps {
  rowMappings: RowMappingRow[];
  exportSettingOptions: ArtComboBoxOption[];
  exportSettingId: string | null;
  onExportSettingChange: (id: string | null) => void;
  mappedValueOptions: ArtComboBoxOption[];
  collapseOpen?: boolean;
  onCollapseChange?: (open: boolean) => void;
}

// ==== Row item ====

interface RowMappingRowItemRef {
  getData(): Partial<RowMapping>;
}

interface RowMappingRowItemProps {
  row: RowMappingRow;
  mappedValueOptions: ArtComboBoxOption[];
}

const RowMappingRowItem = forwardRef<RowMappingRowItemRef, RowMappingRowItemProps>(
  ({ row, mappedValueOptions }, ref) => {
    const [nameColor, setNameColor] = useState<ArtColor | undefined>(row.nameColor);
    const [valueColor, setValueColor] = useState<ArtColor | undefined>(row.valueColor);
    const [displayName, setDisplayName] = useState<string | undefined>(row.displayName);
    const hiddenRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        getData: () => ({
          displayName: displayName || undefined,
          hidden: hiddenRef.current?.checked ?? false,
          nameColor,
          valueColor,
        }),
      }),
      [displayName, nameColor, valueColor],
    );

    // When displayName is a free-text value that doesn't match any option, synthesise a
    // temporary option so the controlled ArtComboBox keeps showing the typed text instead
    // of resetting the input to empty (controlled selected={null} clears the input).
    const selectedOption =
      mappedValueOptions.find((o) => o.value === displayName) ??
      (displayName ? { label: displayName, value: displayName } : null);

    return (
      <ArtDataTr>
        <ArtDataTd>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.sourceName}</span>
        </ArtDataTd>
        <ArtDataTd>
          <ArtComboBox
            options={mappedValueOptions}
            selected={selectedOption}
            placeholder={row.sourceName}
            clearable
            noOptionsMessage={false}
            onChange={(opt) => setDisplayName(opt?.value || undefined)}
            onSubmit={(text) => setDisplayName(text || undefined)}
            selectFirstOnEnter={mappedValueOptions.length > 0}
          />
        </ArtDataTd>
        <ArtDataTd>
          <ColorSelect value={nameColor} onChange={setNameColor} />
        </ArtDataTd>
        <ArtDataTd>
          <ColorSelect value={valueColor} onChange={setValueColor} />
        </ArtDataTd>
        <ArtDataTd>
          <ArtCheckbox ref={hiddenRef} defaultChecked={row.hidden ?? false} size="sm" />
        </ArtDataTd>
      </ArtDataTr>
    );
  },
);

RowMappingRowItem.displayName = 'RowMappingRowItem';

// ==== Column definitions (static — no row data needed for headers) ====

const ROW_MAPPING_COLUMNS: ArtColumn<RowMappingRow>[] = [
  { key: 'sourceName',   label: 'Source Name',   width: 200 },
  { key: 'displayName',  label: 'Display Name',  width: 220 },
  { key: 'nameColor',    label: 'Name Color',    width: 130 },
  { key: 'valueColor',   label: 'Value Color',   width: 130 },
  { key: 'hidden',       label: 'Hide',          width: 60  },
];

// ==== Section ====

const RowMappingsSection = forwardRef<RowMappingsSectionRef, RowMappingsSectionProps>(
  (
    {
      rowMappings,
      exportSettingOptions,
      exportSettingId,
      onExportSettingChange,
      mappedValueOptions,
      collapseOpen,
      onCollapseChange,
    },
    ref,
  ) => {
    const rowItemRefs = useRef<Map<number, RowMappingRowItemRef>>(new Map());

    useImperativeHandle(
      ref,
      () => ({
        getRowMappings: () =>
          rowMappings.map((row) => {
            const item = rowItemRefs.current.get(row._index);
            return item ? { ...row, ...item.getData() } : row;
          }),
      }),
      [rowMappings],
    );

    const selectedExportSetting =
      exportSettingOptions.find((o) => o.value === exportSettingId) ?? null;

    return (
      <ArtCollapse title="Row Mappings" open={collapseOpen} onChange={onCollapseChange}>
        {/* Export Setting */}
        <div className="mb-4" style={{ maxWidth: 320 }}>
          <ArtComboBox
            label="Export Setting"
            options={exportSettingOptions}
            selected={selectedExportSetting}
            placeholder="Select export setting…"
            clearable
            onChange={(opt) => onExportSettingChange(opt?.value ?? null)}
          />
          {mappedValueOptions.length > 0 && (
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Display name options come from this export setting&apos;s mapped value names.
            </p>
          )}
        </div>

        {/* Table */}
        <ArtDataTable<RowMappingRow>
          columns={ROW_MAPPING_COLUMNS}
          data={rowMappings}
          rowKey={(row) => row._index}
          emptyMessage="No rows found in the uploaded file"
          renderRow={(row) => (
            <RowMappingRowItem
              ref={(el) => {
                if (el) rowItemRefs.current.set(row._index, el);
                else rowItemRefs.current.delete(row._index);
              }}
              row={row}
              mappedValueOptions={mappedValueOptions}
            />
          )}
        />
      </ArtCollapse>
    );
  },
);

RowMappingsSection.displayName = 'RowMappingsSection';
export default RowMappingsSection;

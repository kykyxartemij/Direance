'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { RowMapping } from '@/models/mapping.models';
import type { ArtColor } from '@/components/ui/art.types';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import ArtComboBox from '@/components/ui/ArtComboBox';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtCollapse from '@/components/ui/ArtCollapse';
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
      <tr className="art-data-tr">
        <td className="art-data-td">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.sourceName}</span>
        </td>
        <td className="art-data-td">
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
        </td>
        <td className="art-data-td">
          <ColorSelect value={nameColor} onChange={setNameColor} />
        </td>
        <td className="art-data-td">
          <ColorSelect value={valueColor} onChange={setValueColor} />
        </td>
        <td className="art-data-td">
          <ArtCheckbox ref={hiddenRef} defaultChecked={row.hidden ?? false} size="sm" />
        </td>
      </tr>
    );
  },
);

RowMappingRowItem.displayName = 'RowMappingRowItem';

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
        <div className="art-data-table-wrapper">
          <div className="art-data-table-scroll">
            <table className="art-data-table">
              <colgroup>
                <col style={{ minWidth: 200 }} />
                <col style={{ minWidth: 220 }} />
                <col style={{ minWidth: 130 }} />
                <col style={{ minWidth: 130 }} />
                <col style={{ minWidth: 60 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="art-data-th">Source Name</th>
                  <th className="art-data-th">Display Name</th>
                  <th className="art-data-th">Name Color</th>
                  <th className="art-data-th">Value Color</th>
                  <th className="art-data-th">Hide</th>
                </tr>
              </thead>
              <tbody>
                {rowMappings.length === 0 ? (
                  <tr className="art-data-tr">
                    <td
                      className="art-data-td"
                      colSpan={5}
                      style={{ textAlign: 'center', color: 'var(--text-muted)' }}
                    >
                      No rows found in the uploaded file
                    </td>
                  </tr>
                ) : (
                  rowMappings.map((row) => (
                    <RowMappingRowItem
                      key={row._index}
                      ref={(el) => {
                        if (el) rowItemRefs.current.set(row._index, el);
                        else rowItemRefs.current.delete(row._index);
                      }}
                      row={row}
                      mappedValueOptions={mappedValueOptions}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ArtCollapse>
    );
  },
);

RowMappingsSection.displayName = 'RowMappingsSection';
export default RowMappingsSection;

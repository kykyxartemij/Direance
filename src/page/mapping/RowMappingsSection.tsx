'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useGetLightExportSettings } from '@/hooks/export-settings.hooks';
import { useGetExportSettingById } from '@/hooks/export-settings.hooks';
import type { RowMapping } from '@/models/mapping.models';
import type { ArtColor } from '@/components/ui/art.types';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import ArtComboBox from '@/components/ui/ArtComboBox';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtDataTable, { ArtDataTr, ArtDataTd, type ArtColumn } from '@/components/ui/ArtDataTable';
import ArtInput from '@/components/ui/ArtInput';
import ArtIconButton from '@/components/ui/ArtIconButton';
import ArtButton from '@/components/ui/ArtButton';
import ColorSelect from './ColorSelect';

// ==== Types ====

export type RowMappingRow = RowMapping & {
  _index: number;
  _unused?: boolean;
};

export interface RowMappingsSectionRef {
  getRowMappings(): RowMappingRow[];
  getExportSettingId(): string | null;
  setExportSettingId(id: string | null): void;
  getLinkedExportSetting(): import('@/models/export-settings.models').ExportSettingModel | undefined;
}

interface RowMappingsSectionProps {
  rowMappings: RowMappingRow[];
  initialExportSettingId?: string | null;
  collapseOpen?: boolean;
  onCollapseChange?: (open: boolean) => void;
  /**
   * Form mode: sourceName is an input, section owns add/remove, "+ Add row" button shown.
   * Excel mode (default false): sourceName is read-only text, rows mirror the prop.
   */
  editable?: boolean;
}

// ==== Row item ====

interface RowMappingRowItemRef {
  getData(): Partial<RowMapping>;
}

interface RowMappingRowItemProps {
  row: RowMappingRow;
  mappedValueOptions: ArtComboBoxOption[];
  editable: boolean;
  onRemove?: () => void;
}

const RowMappingRowItem = forwardRef<RowMappingRowItemRef, RowMappingRowItemProps>(
  ({ row, mappedValueOptions, editable, onRemove }, ref) => {
    const [nameColor, setNameColor] = useState<ArtColor | undefined>(row.nameColor);
    const [valueColor, setValueColor] = useState<ArtColor | undefined>(row.valueColor);
    const [displayName, setDisplayName] = useState<string | undefined>(row.displayName);
    const hiddenRef = useRef<HTMLInputElement>(null);
    const sourceNameRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        getData: () => ({
          sourceName: editable ? (sourceNameRef.current?.value ?? row.sourceName) : row.sourceName,
          displayName: displayName || undefined,
          hidden: hiddenRef.current?.checked ?? false,
          nameColor,
          valueColor,
        }),
      }),
      [editable, row.sourceName, displayName, nameColor, valueColor],
    );

    // When displayName is a free-text value that doesn't match any option, synthesise a
    // temporary option so the controlled ArtComboBox keeps showing the typed text instead
    // of resetting the input to empty (controlled selected={null} clears the input).
    const selectedOption =
      mappedValueOptions.find((o) => o.value === displayName) ??
      (displayName ? { label: displayName, value: displayName } : null);

    return (
      <ArtDataTr
        title={row._unused ? 'Mapping has this row but current Excel does not' : undefined}
        style={row._unused ? { background: 'color-mix(in srgb, var(--art-danger) 14%, var(--surface))' } : undefined}
      >
        <ArtDataTd>
          {editable ? (
            <ArtInput
              ref={sourceNameRef}
              defaultValue={row.sourceName}
              placeholder="Source name"
            />
          ) : (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.sourceName}</span>
          )}
        </ArtDataTd>
        <ArtDataTd>
          <ArtComboBox
            options={mappedValueOptions}
            selected={selectedOption}
            placeholder={row.sourceName || 'Display name'}
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
        {editable && (
          <ArtDataTd>
            <ArtIconButton
              icon="Close"
              tooltip="Remove row"
              size="sm"
              variant="ghost"
              type="button"
              onClick={onRemove}
            />
          </ArtDataTd>
        )}
      </ArtDataTr>
    );
  },
);

RowMappingRowItem.displayName = 'RowMappingRowItem';

// ==== Column definitions ====

const BASE_COLUMNS: ArtColumn<RowMappingRow>[] = [
  { key: 'sourceName',   label: 'Source Name',   sizing: { width: 220 } },
  { key: 'displayName',  label: 'Display Name',  sizing: { width: 240 } },
  { key: 'nameColor',    label: 'Name Color',    sizing: { width: 190 } },
  { key: 'valueColor',   label: 'Value Color',   sizing: { width: 190 } },
  { key: 'hidden',       label: 'Hide',          sizing: { width: 80  } },
];

const EDITABLE_COLUMNS: ArtColumn<RowMappingRow>[] = [
  { key: 'sourceName',   label: 'Source Name',   sizing: { width: 200 } },
  { key: 'displayName',  label: 'Display Name',  sizing: { width: 220 } },
  { key: 'nameColor',    label: 'Name Color',    sizing: { width: 180 } },
  { key: 'valueColor',   label: 'Value Color',   sizing: { width: 180 } },
  { key: 'hidden',       label: 'Hide',          sizing: { width: 70  } },
  { key: 'actions',      label: 'Delete',        sizing: { width: 90  } },
];

// ==== Section ====

const RowMappingsSection = forwardRef<RowMappingsSectionRef, RowMappingsSectionProps>(
  (
    { rowMappings, initialExportSettingId = null, collapseOpen, onCollapseChange, editable = false },
    ref,
  ) => {
    const rowItemRefs = useRef<Map<number, RowMappingRowItemRef>>(new Map());
    const [exportSettingId, setExportSettingId] = useState<string | null>(initialExportSettingId);

    const [editableRows, setEditableRows] = useState<RowMappingRow[]>(rowMappings);

    const [prevRows, setPrevRows] = useState(rowMappings);
    if (editable && prevRows !== rowMappings) {
      setPrevRows(rowMappings);
      setEditableRows(rowMappings);
    }

    const rows = editable ? editableRows : rowMappings;
    // Derive next free _index from current rows — keeps add/remove monotonic.
    const nextIndex = rows.reduce((max, r) => Math.max(max, r._index), -1) + 1;

    const { data: exportSettingsList = [] } = useGetLightExportSettings();
    const { data: linkedExportSetting } = useGetExportSettingById(exportSettingId ?? undefined);

    const exportSettingOptions: ArtComboBoxOption[] = exportSettingsList.map((es) => ({
      label: es.name,
      value: es.id,
    }));
    const mappedValueOptions: ArtComboBoxOption[] =
      (linkedExportSetting?.mappedValueNames ?? []).map((n) => ({ label: n, value: n }));

    useImperativeHandle(
      ref,
      () => ({
        getRowMappings: () =>
          rows.map((row) => {
            const item = rowItemRefs.current.get(row._index);
            return item ? { ...row, ...item.getData() } : row;
          }),
        getExportSettingId: () => exportSettingId,
        setExportSettingId,
        getLinkedExportSetting: () => linkedExportSetting,
      }),
      [rows, exportSettingId, linkedExportSetting],
    );

    const selectedExportSetting =
      exportSettingOptions.find((o) => o.value === exportSettingId) ?? null;

    function handleAddRow() {
      const flushed = rows.map((row) => {
        const item = rowItemRefs.current.get(row._index);
        return item ? { ...row, ...item.getData() } : row;
      });
      setEditableRows([...flushed, { sourceName: '', _index: nextIndex }]);
    }

    function handleRemoveRow(index: number) {
      const flushed = rows
        .filter((r) => r._index !== index)
        .map((row) => {
          const item = rowItemRefs.current.get(row._index);
          return item ? { ...row, ...item.getData() } : row;
        });
      rowItemRefs.current.delete(index);
      setEditableRows(flushed);
    }

    return (
      <ArtCollapse title="Row Mappings" open={collapseOpen} onChange={onCollapseChange}>
        {/* Export Setting */}
        <div className="mb-4 grid grid-cols-3 gap-4 items-start">
          <div>
            <ArtComboBox
              label="Export Setting"
              options={exportSettingOptions}
              selected={selectedExportSetting}
              placeholder="Select export setting…"
              clearable
              onChange={(opt) => setExportSettingId(opt?.value ?? null)}
            />
            {mappedValueOptions.length > 0 && (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Display name options come from this export setting&apos;s mapped value names.
              </p>
            )}
          </div>
          {editable && (
            <div className="col-start-3 flex justify-end">
              <ArtButton type="button" variant="outlined" size="sm" onClick={handleAddRow}>
                + Add row
              </ArtButton>
            </div>
          )}
        </div>

        {/* Table */}
        <ArtDataTable<RowMappingRow>
          columns={editable ? EDITABLE_COLUMNS : BASE_COLUMNS}
          data={rows}
          rowKey={(row) => row._index}
          emptyMessage={editable ? 'No rows yet — click "Add row" below.' : 'No rows found in the uploaded file'}
          renderRow={(row) => (
            <RowMappingRowItem
              ref={(el) => {
                if (el) rowItemRefs.current.set(row._index, el);
                else rowItemRefs.current.delete(row._index);
              }}
              row={row}
              mappedValueOptions={mappedValueOptions}
              editable={editable}
              onRemove={() => handleRemoveRow(row._index)}
            />
          )}
        />
      </ArtCollapse>
    );
  },
);

RowMappingsSection.displayName = 'RowMappingsSection';
export default RowMappingsSection;

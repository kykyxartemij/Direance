'use client';

import { useImperativeHandle, useState } from 'react';
import { useGetLightExportSettings } from '@/hooks/export-settings.hooks';
import { useGetExportSettingById } from '@/hooks/export-settings.hooks';
import type { RowMapping } from '@/models/mapping.models';
import type { MappedValueModel } from '@/models/export-settings.models';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import ArtComboBox from '@/components/ui/ArtComboBox';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtDataTable, { ArtDataTr, ArtDataTd, type ArtColumn } from '@/components/ui/ArtDataTable';
import ArtInput from '@/components/ui/ArtInput';
import ArtIconButton from '@/components/ui/ArtIconButton';
import ArtTooltip from '@/components/ui/ArtTooltip';
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
  /** Live data — always reflected in read-only mode (editable=false). */
  rowMappings?: RowMappingRow[];
  /** Editable-mode seed — only read at mount. Use key= on the caller to reset. */
  initialRowMappings?: RowMappingRow[];
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

interface RowMappingRowItemProps {
  row: RowMappingRow;
  mappedValueOptions: ArtComboBoxOption[];
  mappedValues: MappedValueModel[];
  editable: boolean;
  onChange: (patch: Partial<RowMapping>) => void;
  onRemove?: () => void;
}

function findCategory(name: string | undefined, categories: MappedValueModel[]): MappedValueModel | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  return categories.find((c) => c.name.trim().toLowerCase() === key);
}

function RowMappingRowItem({ row, mappedValueOptions, mappedValues, editable, onChange, onRemove }: RowMappingRowItemProps) {
    const matchedCategory = findCategory(row.displayName, mappedValues);
    const lockedNameColor = matchedCategory?.color;

    // When displayName is a free-text value that doesn't match any option, synthesise a
    // temporary option so the controlled ArtComboBox keeps showing the typed text instead
    // of resetting the input to empty (controlled selected={null} clears the input).
    const selectedOption =
      mappedValueOptions.find((o) => o.value === row.displayName) ??
      (row.displayName ? { label: row.displayName, value: row.displayName } : null);

    return (
      <ArtDataTr
        title={row._unused ? 'Mapping has this row but current Excel does not' : undefined}
        style={row._unused ? { background: 'color-mix(in srgb, var(--art-danger) 14%, var(--surface))' } : undefined}
      >
        <ArtDataTd>
          {editable ? (
            <ArtInput
              value={row.sourceName}
              placeholder="Source name"
              onChange={(e) => onChange({ sourceName: e.target.value })}
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
            onChange={(opt) => onChange({ displayName: opt?.value || undefined })}
            onSubmit={(text) => onChange({ displayName: text || undefined })}
            selectFirstOnEnter={mappedValueOptions.length > 0}
          />
        </ArtDataTd>
        <ArtDataTd>
          {lockedNameColor !== undefined ? (
            <ArtTooltip label={`Color set by category "${matchedCategory!.name}" in the linked Export Setting`}>
              <ColorSelect value={lockedNameColor} onChange={() => {}} disabled />
            </ArtTooltip>
          ) : (
            <ColorSelect value={row.nameColor} onChange={(c) => onChange({ nameColor: c })} />
          )}
        </ArtDataTd>
        <ArtDataTd>
          <ColorSelect value={row.valueColor} onChange={(c) => onChange({ valueColor: c })} />
        </ArtDataTd>
        <ArtDataTd>
          <ArtCheckbox
            checked={row.hidden ?? false}
            size="sm"
            onChange={(e) => onChange({ hidden: e.target.checked })}
          />
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
}

// ==== Empty defaults ====

const EMPTY_ROWS: RowMappingRow[] = [];

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

function RowMappingsSection({ rowMappings = EMPTY_ROWS, initialRowMappings = EMPTY_ROWS, initialExportSettingId = null, collapseOpen, onCollapseChange, editable = false, ref }: RowMappingsSectionProps & { ref?: React.Ref<RowMappingsSectionRef> }) {
    const [exportSettingId, setExportSettingId] = useState<string | null>(initialExportSettingId);

    // initialRowMappings is the seed — only read at mount. key= on the caller resets on ID change.
    const [editableRows, setEditableRows] = useState<RowMappingRow[]>(initialRowMappings);

    const rows = editable ? editableRows : rowMappings;
    const nextIndex = rows.reduce((max, r) => Math.max(max, r._index), -1) + 1;

    const { data: exportSettingsList = [] } = useGetLightExportSettings();
    const { data: linkedExportSetting } = useGetExportSettingById(exportSettingId ?? undefined, {
      meta: { withPageLoaderBlur: true },
    });

    const exportSettingOptions: ArtComboBoxOption[] = exportSettingsList.map((es) => ({
      label: es.name,
      value: es.id,
    }));
    const mappedValues: MappedValueModel[] = linkedExportSetting?.mappedValues ?? [];
    const mappedValueOptions: ArtComboBoxOption[] =
      mappedValues.map((v) => ({ label: v.name, value: v.name, color: v.color }));

    useImperativeHandle(
      ref,
      () => ({
        getRowMappings: () => editableRows,
        getExportSettingId: () => exportSettingId,
        setExportSettingId,
        getLinkedExportSetting: () => linkedExportSetting,
      }),
      [editableRows, exportSettingId, linkedExportSetting],
    );

    const selectedExportSetting =
      exportSettingOptions.find((o) => o.value === exportSettingId) ?? null;

    function handleRowChange(index: number, patch: Partial<RowMapping>) {
      setEditableRows((prev) => prev.map((r) => r._index === index ? { ...r, ...patch } : r));
    }

    function handleAddRow() {
      setEditableRows((prev) => [...prev, { sourceName: '', _index: nextIndex }]);
    }

    function handleRemoveRow(index: number) {
      setEditableRows((prev) => prev.filter((r) => r._index !== index));
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
              row={row}
              mappedValueOptions={mappedValueOptions}
              mappedValues={mappedValues}
              editable={editable}
              onChange={(patch) => handleRowChange(row._index, patch)}
              onRemove={() => handleRemoveRow(row._index)}
            />
          )}
        />
      </ArtCollapse>
    );
}

export default RowMappingsSection;

'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { RowMapping } from '@/models/mapping.models';
import type { ArtColor } from '@/components/ui/art.types';
import ArtInput from '@/components/ui/ArtInput';
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
  collapseOpen?: boolean;
  onCollapseChange?: (open: boolean) => void;
}

// ==== Row item ====

interface RowMappingRowItemRef {
  getData(): Partial<RowMapping>;
}

const RowMappingRowItem = forwardRef<RowMappingRowItemRef, { row: RowMappingRow }>(({ row }, ref) => {
  const [nameColor, setNameColor] = useState<ArtColor | undefined>(row.nameColor);
  const [valueColor, setValueColor] = useState<ArtColor | undefined>(row.valueColor);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    getData: () => ({
      displayName: displayNameRef.current?.value || undefined,
      hidden: hiddenRef.current?.checked ?? false,
      nameColor,
      valueColor,
    }),
  }), [nameColor, valueColor]);

  return (
    <tr className="art-data-tr">
      <td className="art-data-td">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.sourceName}</span>
      </td>
      <td className="art-data-td">
        <ArtInput
          ref={displayNameRef}
          defaultValue={row.displayName ?? ''}
          placeholder={row.sourceName}
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
});

RowMappingRowItem.displayName = 'RowMappingRowItem';

// ==== Section ====

const RowMappingsSection = forwardRef<RowMappingsSectionRef, RowMappingsSectionProps>(
  ({ rowMappings, collapseOpen, onCollapseChange }, ref) => {
    const rowItemRefs = useRef<Map<number, RowMappingRowItemRef>>(new Map());

    useImperativeHandle(ref, () => ({
      getRowMappings: () => rowMappings.map((row) => {
        const item = rowItemRefs.current.get(row._index);
        return item ? { ...row, ...item.getData() } : row;
      }),
    }), [rowMappings]);

    return (
      <ArtCollapse title="Row Mappings" open={collapseOpen} onChange={onCollapseChange}>
        <div className="art-data-table-wrapper">
          <div className="art-data-table-scroll">
            <table className="art-data-table">
              <colgroup>
                <col style={{ minWidth: 200 }} />
                <col style={{ minWidth: 200 }} />
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
                    <td className="art-data-td" colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
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

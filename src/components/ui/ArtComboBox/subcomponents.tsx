'use client';

import React, { useMemo, type Ref } from 'react';
import ArtBadge from '../ArtBadge';
import ArtIcon, { type ArtIconName } from '../ArtIcon';
import { type ArtColor, ART_COLOR_CLASS } from '../art.types';
import { cn, mergeRefs } from '../art.utils';
import { FIELD_SIZE, CHIPS_MAX_COLLAPSED, type ArtComboBoxBaseProps, type ArtComboBoxOption } from './types';

function renderOptionContent(opt: ArtComboBoxOption) {
  return (
    <span className="art-combobox-option-inner">
      {opt.icon && <ArtIcon name={opt.icon as ArtIconName} size="sm" />}
      {opt.label}
    </span>
  );
}

// ==== Chips input (multi-select trigger) ====

export interface ChipsInputFieldProps {
  chipsExpanded: boolean;
  selectedMulti: ArtComboBoxOption[];
  size: NonNullable<ArtComboBoxBaseProps['size']>;
  disabled: boolean;
  readOnly: boolean;
  chipsInputRef: React.RefObject<HTMLInputElement | null>;
  inputRef: Ref<HTMLInputElement> | undefined;
  labelId: string;
  label: string | undefined;
  userSearch: string | null;
  placeholder: string | undefined;
  show: () => void;
  handleChange: React.ChangeEventHandler<HTMLInputElement>;
  handleKeyDown: React.KeyboardEventHandler;
  removeMultiItem: (opt: ArtComboBoxOption) => void;
  setChipsUserExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

export function ChipsInputField({
  chipsExpanded, selectedMulti, size, disabled, readOnly, chipsInputRef, inputRef,
  labelId, label, userSearch, placeholder, show, handleChange, handleKeyDown,
  removeMultiItem, setChipsUserExpanded,
}: ChipsInputFieldProps) {
  // Native <label htmlFor> focuses the input when blank field area is clicked —
  // the input's onFocus opens the dropdown, so no manual click handler is needed.
  const setInputRef = useMemo(() => mergeRefs(chipsInputRef, inputRef), [chipsInputRef, inputRef]);
  return (
    <label
      htmlFor={labelId}
      className={cn(
        'art-field art-combobox-chips-field',
        chipsExpanded ? 'art-combobox-chips-field--expanded' : 'art-combobox-chips-field--collapsed',
        FIELD_SIZE[size],
        disabled && 'art-field--disabled',
      )}
    >
      {(chipsExpanded ? selectedMulti : selectedMulti.slice(0, CHIPS_MAX_COLLAPSED)).map((opt) => (
        <ArtBadge
          key={opt.value}
          size="sm"
          variant="outlined"
          color={opt.color as ArtColor | undefined}
          icon={opt.icon as ArtIconName | undefined}
          onRemove={readOnly ? undefined : () => removeMultiItem(opt)}
        >
          {opt.label}
        </ArtBadge>
      ))}
      {!chipsExpanded && selectedMulti.length > CHIPS_MAX_COLLAPSED && (
        <button
          type="button"
          className="art-combobox-chips-more"
          onClick={() => setChipsUserExpanded(true)}
        >
          +{selectedMulti.length - CHIPS_MAX_COLLAPSED} more
        </button>
      )}
      <input
        ref={setInputRef}
        id={labelId}
        className="art-combobox-chips-input"
        aria-label={label ?? placeholder ?? 'Search'}
        value={userSearch ?? ''}
        readOnly={readOnly}
        onChange={handleChange}
        onFocus={() => !disabled && !readOnly && show()}
        onKeyDown={handleKeyDown}
        placeholder={selectedMulti.length === 0 ? placeholder : undefined}
        disabled={disabled}
      />
    </label>
  );
}

// ==== Button trigger (single-select, non-searchable) ====

export interface ButtonTriggerProps {
  labelId: string;
  disabled: boolean;
  readOnly: boolean;
  size: NonNullable<ArtComboBoxBaseProps['size']>;
  selectedSingle: ArtComboBoxOption | null;
  placeholder: string | undefined;
  toggle: () => void;
  handleTriggerKeyDown: React.KeyboardEventHandler;
}

export function ButtonTrigger({ labelId, disabled, readOnly, size, selectedSingle, placeholder, toggle, handleTriggerKeyDown }: ButtonTriggerProps) {
  return (
    <button
      type="button"
      id={labelId}
      disabled={disabled}
      className={cn(
        'art-field art-select-trigger',
        FIELD_SIZE[size],
        selectedSingle?.color && ART_COLOR_CLASS[selectedSingle.color],
      )}
      onClick={() => !disabled && !readOnly && toggle()}
      onKeyDown={readOnly ? undefined : handleTriggerKeyDown}
    >
      {selectedSingle
        ? renderOptionContent(selectedSingle)
        : <span className="text-muted">{placeholder ?? 'Select…'}</span>}
      <ArtIcon name="ChevronDown" size="sm" className="ml-auto shrink-0 opacity-50" />
    </button>
  );
}

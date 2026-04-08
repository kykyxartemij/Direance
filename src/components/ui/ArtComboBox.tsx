'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, forwardRef, useCallback, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredPanel } from './art.hooks';
import ArtInput from './ArtInput';
import ArtBadge from './ArtBadge';
import ArtLabel from './ArtLabel';
import ArtListbox from './ArtListbox';
import ArtIcon, { type ArtIconProps, type ArtIconName } from './ArtIcon';
import { type ArtOption, type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

// ArtComboBoxOption = ArtOption (shared shape). Re-exported for consumers.
type ArtComboBoxOption = ArtOption;
export type { ArtComboBoxOption };

// ==== Shared base props ====

interface ArtComboBoxBaseProps {
  options: ArtComboBoxOption[];
  label?: string;
  required?: boolean;
  placeholder?: string;
  icon?: ArtIconProps;
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  debounceMs?: boolean | number;
  /** Fires after debounceMs of inactivity — use for async/server-side option fetching */
  onDebouncedChange?: (inputText: string) => void;
  /** See ArtListbox.noOptionsMessage — false suppresses the empty-state row and keeps the dropdown closed when options are empty */
  noOptionsMessage?: ReactNode | boolean;
  /** Called when the user scrolls near the bottom of the list — wire to fetchNextPage for infinite queries */
  onEndReached?: () => void;
  /** When true, renders a loading skeleton at the bottom (use with hasNextPage) */
  hasMore?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  /** true = text input + filter (default). false = styled button trigger, pick only. */
  searchable?: boolean;
  /** When true, pressing Enter auto-selects the first visible option */
  selectFirstOnEnter?: boolean;
  /** Called with the current input text on Enter — useful for free-text navigation */
  onSubmit?: (inputText: string) => void;
}

// ==== Single-select props ====

export interface ArtComboBoxSingleProps extends ArtComboBoxBaseProps {
  multiple?: false;
  /**
   * Controlled: provide to manage selection yourself.
   * Uncontrolled: omit and the component manages its own state.
   */
  selected?: ArtComboBoxOption | null;
  defaultSelected?: ArtComboBoxOption | null;
  onChange?: (option: ArtComboBoxOption | null) => void;
}

// ==== Multi-select props ====

export interface ArtComboBoxMultiProps extends ArtComboBoxBaseProps {
  multiple: true;
  selected?: ArtComboBoxOption[];
  defaultSelected?: ArtComboBoxOption[];
  onChange?: (options: ArtComboBoxOption[]) => void;
}

export type ArtComboBoxProps = ArtComboBoxSingleProps | ArtComboBoxMultiProps;

// ==== Internal helpers ====

const FIELD_SIZE: Record<NonNullable<ArtComboBoxBaseProps['size']>, string> = {
  sm: 'art-field--sm',
  md: '',
  lg: 'art-field--lg',
};

// ==== Component ====

const ArtComboBox = forwardRef<HTMLInputElement, ArtComboBoxProps>((props, ref) => {
  const labelId = useId();

  const {
    options,
    label,
    required,
    placeholder,
    icon,
    clearable,
    size = 'md',
    debounceMs = false,
    onDebouncedChange,
    noOptionsMessage,
    onEndReached,
    hasMore,
    isLoading,
    disabled = false,
    readOnly = false,
    className,
    searchable = true,
    selectFirstOnEnter = false,
    onSubmit,
    onChange,
  } = props;

  const multiple = props.multiple ?? false;

  // ==== Single-select state ====

  const singleProps = !multiple ? (props as ArtComboBoxSingleProps) : null;
  const isControlledSingle = singleProps?.selected !== undefined;
  const [internalSingle, setInternalSingle] = useState<ArtComboBoxOption | null>(
    singleProps?.defaultSelected ?? null,
  );
  const selectedSingle = isControlledSingle
    ? (singleProps!.selected ?? null)
    : internalSingle;

  // ==== Multi-select state ====

  const multiProps = multiple ? (props as ArtComboBoxMultiProps) : null;
  const isControlledMulti = multiProps?.selected !== undefined;
  const [internalMulti, setInternalMulti] = useState<ArtComboBoxOption[]>(
    multiProps?.defaultSelected ?? [],
  );
  const selectedMulti = isControlledMulti
    ? (multiProps!.selected ?? [])
    : internalMulti;

  // ==== Chips collapsed/expanded state ====

  const CHIPS_MAX_COLLAPSED = 3;
  const [chipsUserExpanded, setChipsUserExpanded] = useState(false);
  // Derived: only expanded when user explicitly opened it AND there's still overflow
  const chipsExpanded = chipsUserExpanded && selectedMulti.length > CHIPS_MAX_COLLAPSED;

  // ==== Shared state ====

  const {
    triggerRef: wrapperRef,
    panelRef: portalRef,
    pos: dropdownPos,
    open,
    show,
    hide,
    toggle,
  } = useAnchoredPanel<HTMLDivElement, HTMLDivElement>({ trackWidth: true });
  const listRef = useRef<HTMLUListElement>(null);
  const chipsInputRef = useRef<HTMLInputElement>(null);
  const activeIdxRef = useRef(-1);

  const [inputText, setInputText] = useState(selectedSingle?.label ?? '');

  // Sync inputText when controlled single-select changes externally
  const [prevSingle, setPrevSingle] = useState(selectedSingle);
  if (!multiple && prevSingle !== selectedSingle) {
    setPrevSingle(selectedSingle);
    setInputText(selectedSingle?.label ?? '');
  }

  const visibleOptions = searchable && inputText && (!multiple ? inputText !== selectedSingle?.label : true)
    ? options.filter((o) => o.label.toLowerCase().includes(inputText.toLowerCase()))
    : options;

  // Stable refs — updated every render so callbacks never go stale
  const visibleOptionsRef = useRef(visibleOptions);
  const openRef = useRef(open);
  const inputTextRef = useRef(inputText);
  const selectedMultiRef = useRef(selectedMulti);
  useLayoutEffect(() => {
    visibleOptionsRef.current = visibleOptions;
    openRef.current = open;
    inputTextRef.current = inputText;
    selectedMultiRef.current = selectedMulti;
  });

  useEffect(() => { activeIdxRef.current = -1; }, [visibleOptions]);
  useEffect(() => { if (!open) activeIdxRef.current = -1; }, [open]);

  // DOM-only active highlight — no React state, no re-render on arrow keys
  const moveActive = useCallback((newIdx: number) => {
    const items = listRef.current?.children;
    if (items) {
      const prev = items[activeIdxRef.current] as HTMLElement | undefined;
      if (prev) { prev.classList.remove('art-combobox-option--active'); prev.setAttribute('aria-selected', 'false'); }
      const next = items[newIdx] as HTMLElement | undefined;
      if (next) { next.classList.add('art-combobox-option--active'); next.setAttribute('aria-selected', 'true'); }
    }
    activeIdxRef.current = newIdx;
  }, []);


  // ==== Selection handlers ====

  const applySelection = useCallback((opt: ArtComboBoxOption | null) => {
    if (!isControlledSingle) setInternalSingle(opt);
    (onChange as ArtComboBoxSingleProps['onChange'])?.(opt);
  }, [isControlledSingle, onChange]);

  const applyMultiSelection = useCallback((opts: ArtComboBoxOption[]) => {
    if (!isControlledMulti) setInternalMulti(opts);
    (onChange as ArtComboBoxMultiProps['onChange'])?.(opts);
  }, [isControlledMulti, onChange]);

  const select = useCallback((opt: ArtComboBoxOption) => {
    if (multiple) {
      const current = selectedMultiRef.current;
      const isSelected = current.some((o) => o.value === opt.value);
      applyMultiSelection(isSelected ? current.filter((o) => o.value !== opt.value) : [...current, opt]);
      setInputText('');
      // Keep dropdown open in multi mode
    } else {
      setInputText(opt.label);
      applySelection(opt);
      hide();
      onSubmit?.(opt.label);
    }
  }, [multiple, applyMultiSelection, applySelection, onSubmit, hide]);

  const removeMultiItem = useCallback((opt: ArtComboBoxOption) => {
    applyMultiSelection(selectedMultiRef.current.filter((o) => o.value !== opt.value));
  }, [applyMultiSelection]);

  // ==== Keyboard handling ====

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const opts = visibleOptionsRef.current;

    // Backspace in multi mode — remove last chip when input is empty
    if (multiple && e.key === 'Backspace' && inputTextRef.current === '') {
      const current = selectedMultiRef.current;
      if (current.length > 0) applyMultiSelection(current.slice(0, -1));
      return;
    }

    if (!openRef.current || opts.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!searchable) { show(); return; }
        if (selectFirstOnEnter && opts.length > 0) { select(opts[0]); return; }
        if (!multiple) { hide(); onSubmit?.(inputTextRef.current); }
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = activeIdxRef.current < opts.length - 1 ? activeIdxRef.current + 1 : 0;
        moveActive(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = activeIdxRef.current > 0 ? activeIdxRef.current - 1 : opts.length - 1;
        moveActive(prev);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        const idx = activeIdxRef.current;
        if (idx >= 0) select(opts[idx]);
        else if (selectFirstOnEnter && opts.length > 0) select(opts[0]);
        else if (!multiple) { hide(); onSubmit?.(inputTextRef.current); }
        break;
      }
      case 'Escape':
        hide();
        break;
    }
  }, [multiple, searchable, selectFirstOnEnter, select, onSubmit, moveActive, applyMultiSelection, show, hide]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && !openRef.current) { e.preventDefault(); show(); return; }
    handleKeyDown(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setInputText(e.target.value);
    show();
  };

  const handleClear = () => applySelection(null);

  const renderOptionContent = (opt: ArtComboBoxOption) => (
    <span className="art-combobox-option-inner">
      {opt.icon && <ArtIcon name={opt.icon as ArtIconName} size="sm" />}
      {opt.label}
    </span>
  );

  // ==== Render ====

  return (
    <div className={cn(label ? 'flex flex-col w-full' : 'art-combobox', className)}>
      {label && <ArtLabel htmlFor={labelId} required={required}>{label}</ArtLabel>}
      <div className="art-combobox" ref={wrapperRef}>

      {/* ── Multi-select chips input ─────────────────────────────────────── */}
      {multiple ? (
        <div
          className={cn(
            'art-field art-combobox-chips-field',
            chipsExpanded ? 'art-combobox-chips-field--expanded' : 'art-combobox-chips-field--collapsed',
            FIELD_SIZE[size],
            disabled && 'art-field--disabled',
          )}
          onClick={() => { if (!disabled && !readOnly) { chipsInputRef.current?.focus(); show(); } }}
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
              onMouseDown={(e) => { e.stopPropagation(); setChipsUserExpanded(true); }}
            >
              +{selectedMulti.length - CHIPS_MAX_COLLAPSED} more
            </button>
          )}
          <input
            ref={(node) => {
              chipsInputRef.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = node;
            }}
            id={labelId}
            className="art-combobox-chips-input"
            value={inputText}
            readOnly={readOnly}
            onChange={handleChange}
            onFocus={() => !disabled && !readOnly && show()}
            onKeyDown={handleKeyDown}
            placeholder={selectedMulti.length === 0 ? placeholder : undefined}
            disabled={disabled}
          />
        </div>

      ) : searchable ? (
        /* ── Single searchable input ──────────────────────────────────────── */
        <ArtInput
          ref={ref}
          id={labelId}
          icon={selectedSingle?.icon ? { name: selectedSingle.icon as ArtIconName } : icon}
          clearable={clearable}
          placeholder={placeholder}
          value={inputText}
          color={selectedSingle?.color}
          debounce={debounceMs}
          onDebouncedChange={onDebouncedChange}
          onChange={handleChange}
          onClear={handleClear}
          onKeyDown={handleKeyDown}
          onFocus={() => !disabled && !readOnly && show()}
          onClick={() => !disabled && !readOnly && show()}
          readOnly={readOnly}
          disabled={disabled}
        />
      ) : (
        /* ── Single button trigger (non-searchable) ───────────────────────── */
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
      )}

      {/* ── Dropdown list — rendered into document.body so it escapes any
           overflow:hidden / overflow:auto ancestor (table wrappers, collapse panels, etc.) */}
      {open && (visibleOptions.length > 0 || isLoading || hasMore || (noOptionsMessage !== false && searchable && inputText.trim().length > 0)) && createPortal(
        <div
          ref={portalRef}
          style={{ position: 'fixed', zIndex: 9999, ...dropdownPos }}
        >
          <ArtListbox
            ref={listRef}
            className="art-combobox-list"
            options={visibleOptions}
            selectedValues={multiple ? selectedMulti.map((o) => o.value) : undefined}
            onSelect={select}
            noOptionsMessage={isLoading ? 'Loading…' : (noOptionsMessage ?? true)}
            isLoading={isLoading}
            onEndReached={onEndReached}
            hasMore={hasMore}
          />
        </div>,
        document.body,
      )}
      </div>
    </div>
  );
});

ArtComboBox.displayName = 'ArtComboBox';

export default ArtComboBox;
export { ArtComboBox };

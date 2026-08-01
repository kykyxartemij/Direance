'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredPanel } from '../art.hooks';
import ArtInput from '../ArtInput';
import ArtLabel from '../ArtLabel';
import ArtHelperText from '../ArtHelperText';
import ArtListbox from '../ArtListbox';
import { type ArtIconName } from '../ArtIcon';
import { cn } from '../art.utils';
import { ChipsInputField, ButtonTrigger } from './subcomponents';
import { CHIPS_MAX_COLLAPSED, type ArtComboBoxProps, type ArtComboBoxOption, type ArtComboBoxSingleProps, type ArtComboBoxMultiProps } from './types';

// ==== Component ====

function ArtComboBox(props: ArtComboBoxProps) {
  const labelId = useId();

  const {
    ref,
    options,
    label,
    helperText,
    errorText,
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

  const [chipsUserExpanded, setChipsUserExpanded] = useState(false);
  // Derived: only expanded when user explicitly opened it AND there's still overflow
  const chipsExpanded = chipsUserExpanded && selectedMulti.length > CHIPS_MAX_COLLAPSED;

  // ==== Shared state ====

  const {
    triggerRef: wrapperRef,
    panelRef: portalRef,
    open,
    show,
    hide,
    toggle,
  } = useAnchoredPanel<HTMLDivElement, HTMLDivElement>({ trackWidth: true });

  // null = not searching (shows selected label); non-null string = active search query
  const [userSearch, setUserSearch] = useState<string | null>(null);

  const FADE_MS = 150;
  const handleHide = useCallback(() => {
    setUserSearch(null);
    if (portalRef.current) {
      portalRef.current.style.opacity = '0';
      setTimeout(hide, FADE_MS);
    } else {
      hide();
    }
  }, [hide, portalRef]);

  const listRef = useRef<HTMLDivElement>(null);
  const chipsInputRef = useRef<HTMLInputElement>(null);
  const activeIdxRef = useRef(-1);

  // Derive display value: show search text while searching, else show the selected label
  const inputDisplayValue = userSearch ?? (multiple ? '' : (selectedSingle?.label ?? ''));

  const visibleOptions = searchable && userSearch
    ? options.filter((o) => o.label.toLowerCase().includes(userSearch.toLowerCase()))
    : options;

  // Stable refs — updated every render so callbacks never go stale
  const visibleOptionsRef = useRef(visibleOptions);
  const openRef = useRef(open);
  const searchRef = useRef(userSearch);
  const selectedMultiRef = useRef(selectedMulti);
  useLayoutEffect(() => {
    visibleOptionsRef.current = visibleOptions;
    openRef.current = open;
    searchRef.current = userSearch;
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
      setUserSearch(null);
      // Keep dropdown open in multi mode
    } else {
      applySelection(opt);
      handleHide();
      onSubmit?.(opt.label);
    }
  }, [multiple, applyMultiSelection, applySelection, onSubmit, handleHide]);

  const removeMultiItem = useCallback((opt: ArtComboBoxOption) => {
    applyMultiSelection(selectedMultiRef.current.filter((o) => o.value !== opt.value));
  }, [applyMultiSelection]);

  // ==== Keyboard handling ====

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const opts = visibleOptionsRef.current;

    // Backspace in multi mode — remove last chip when search is empty
    if (multiple && e.key === 'Backspace' && !searchRef.current) {
      const current = selectedMultiRef.current;
      if (current.length > 0) applyMultiSelection(current.slice(0, -1));
      return;
    }

    if (!openRef.current || opts.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!searchable) { show(); return; }
        if (selectFirstOnEnter && opts.length > 0) { select(opts[0]); return; }
        if (!multiple) { handleHide(); onSubmit?.(searchRef.current ?? ''); }
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
        else if (!multiple) { handleHide(); onSubmit?.(searchRef.current ?? ''); }
        break;
      }
      case 'Escape':
        handleHide();
        break;
    }
  }, [multiple, searchable, selectFirstOnEnter, select, onSubmit, moveActive, applyMultiSelection, show, handleHide]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && !openRef.current) { e.preventDefault(); show(); return; }
    handleKeyDown(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setUserSearch(e.target.value);
    show();
  };

  const handleClear = () => {
    setUserSearch(null);
    applySelection(null);
  };

  // ==== Render ====

  return (
    <div className={cn(label ? 'flex flex-col w-full' : 'art-combobox', className)}>
      {label && <ArtLabel htmlFor={labelId} required={required}>{label}</ArtLabel>}
      <div className="art-combobox" ref={wrapperRef}>

      {/* ── Input trigger (multi chips / single search / single button) ─── */}
      {multiple ? (
        <ChipsInputField
          chipsExpanded={chipsExpanded}
          selectedMulti={selectedMulti}
          size={size}
          disabled={disabled}
          readOnly={readOnly}
          chipsInputRef={chipsInputRef}
          inputRef={ref}
          labelId={labelId}
          label={label}
          userSearch={userSearch}
          placeholder={placeholder}
          show={show}
          handleChange={handleChange}
          handleKeyDown={handleKeyDown}
          removeMultiItem={removeMultiItem}
          setChipsUserExpanded={setChipsUserExpanded}
        />
      ) : searchable ? (
        /* ── Single searchable input ──────────────────────────────────────── */
        <ArtInput
          ref={ref}
          id={labelId}
          icon={selectedSingle?.icon ? { name: selectedSingle.icon as ArtIconName } : icon}
          clearable={clearable}
          placeholder={placeholder}
          value={inputDisplayValue}
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
        <ButtonTrigger
          labelId={labelId}
          disabled={disabled}
          readOnly={readOnly}
          size={size}
          selectedSingle={selectedSingle}
          placeholder={placeholder}
          toggle={toggle}
          handleTriggerKeyDown={handleTriggerKeyDown}
        />
      )}

      {/* ── Dropdown list — rendered into document.body so it escapes any
           overflow:hidden / overflow:auto ancestor (table wrappers, collapse panels, etc.) */}
      {open && (visibleOptions.length > 0 || isLoading || hasMore || (noOptionsMessage !== false && searchable && (userSearch?.trim().length ?? 0) > 0)) && typeof document !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          className="art-combobox-portal"
          style={{ position: 'fixed', zIndex: 'var(--z-anchor)' as unknown as number }}
        >
          <ArtListbox
            ref={listRef}
            className="art-combobox-list"
            options={visibleOptions}
            selectedValues={multiple ? selectedMulti.map((o) => o.value) : selectedSingle ? [selectedSingle.value] : []}
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
      <ArtHelperText errorText={errorText} helperText={helperText} />
    </div>
  );
}

ArtComboBox.displayName = 'ArtComboBox';

export default ArtComboBox;
export { ArtComboBox };

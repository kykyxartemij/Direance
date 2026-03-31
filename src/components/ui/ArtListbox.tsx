'use client';

import { forwardRef, memo, useMemo } from 'react';
import ArtIcon, { type ArtIconName } from './ArtIcon';
import ArtSkeleton from './ArtSkeleton';
import ArtEmptyState from './ArtEmptyState';
import { type ArtColor, ART_COLOR_CLASS, type ArtOption } from './art.types';
import { cn } from './art.utils';

export type ArtListboxOption = ArtOption;

export interface ArtListboxAction {
  /** Static string or function that receives the current query and returns a label */
  label: string | ((query: string) => string);
  onAction: (query: string) => void;
  isLoading?: boolean;
  /**
   * When true, the action row is only shown when there is a non-empty query
   * AND no exact option match for it. Useful for "Create X" rows.
   * Default: false (always shown).
   */
  showOnNoExactMatch?: boolean;
}

export interface ArtListboxProps {
  options: ArtListboxOption[];
  /** Values currently selected — renders a neutral tint on the row */
  selectedValues?: string[];
  onSelect: (option: ArtListboxOption) => void;
  noOptionsMessage?: string;
  isLoading?: boolean;
  isError?: boolean;
  className?: string;
  /**
   * Extra action rows (e.g. "Create X", "Auto-select similar").
   * Shown with a prominent section divider between them and regular options.
   */
  extraActions?: ArtListboxAction[];
  /** Where to render extra action rows relative to the option list. Default: 'bottom' */
  actionsPosition?: 'top' | 'bottom';
  /** Current search/input text — passed to action labels and showOnNoExactMatch logic */
  query?: string;
}

const ArtListbox = memo(forwardRef<HTMLUListElement, ArtListboxProps>((props, ref) => {
  const {
    options,
    selectedValues = [],
    onSelect,
    noOptionsMessage,
    isLoading,
    isError,
    className,
    extraActions = [],
    actionsPosition = 'bottom',
    query = '',
  } = props;

  const trimmedQuery = query.trim();

  const visibleActions = useMemo(() =>
    extraActions.filter((action) => {
      if (!action.showOnNoExactMatch) return true;
      // Hide when query is empty (nothing to create) or when there's an exact match.
      if (!trimmedQuery) return false;
      return !options.some((o) => o.label.toLowerCase() === trimmedQuery.toLowerCase());
    }),
    [extraActions, options, trimmedQuery],
  );

  const actionRows = useMemo(() =>
    visibleActions.map((action, i) => {
      const labelText =
        typeof action.label === 'function' ? action.label(trimmedQuery) : action.label;
      return (
        <li
          key={`action-${i}`}
          role="option"
          aria-selected={false}
          className="art-combobox-option"
          style={{ color: 'var(--art-accent)' }}
          onMouseDown={(e) => {
            e.preventDefault();
            const el = e.currentTarget;
            el.setAttribute('data-pressing', '');
            window.addEventListener('mouseup', () => el.removeAttribute('data-pressing'), { once: true });
            action.onAction(trimmedQuery);
          }}
        >
          <span className="art-combobox-option-inner">
            <span className="font-medium text-base leading-none">+</span>
            {labelText}
          </span>
          {action.isLoading && <span className="ml-auto text-xs opacity-60">Loading…</span>}
        </li>
      );
    }),
    [visibleActions, trimmedQuery],
  );

  const optionRows = useMemo(() =>
    options.map((opt) => {
      const isSelected = selectedValues.includes(opt.value);
      return (
        <li
          key={opt.value}
          role="option"
          aria-selected={isSelected}
          className={cn(
            'art-combobox-option',
            opt.color && ART_COLOR_CLASS[opt.color as ArtColor],
            isSelected && 'art-combobox-option--selected',
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            const el = e.currentTarget;
            el.setAttribute('data-pressing', '');
            window.addEventListener('mouseup', () => el.removeAttribute('data-pressing'), { once: true });
            onSelect(opt);
          }}
        >
          <span className="art-combobox-option-inner">
            {opt.icon && <ArtIcon name={opt.icon as ArtIconName} size="sm" />}
            {opt.label}
          </span>
        </li>
      );
    }),
    [options, selectedValues, onSelect],
  );

  const divider = visibleActions.length > 0
    ? <li key="divider" className="art-listbox-section-divider" role="presentation" />
    : null;

  // ==== State rows ====

  const showStateRow = isLoading || isError || (options.length === 0 && visibleActions.length === 0);

  const stateRow = showStateRow && (
    <li role="presentation">
      {isLoading ? (
        <div className="flex flex-col gap-1 p-1">
          <ArtSkeleton className="h-8 rounded-md" />
          <ArtSkeleton className="h-8 rounded-md" />
          <ArtSkeleton className="h-8 rounded-md" />
        </div>
      ) : isError ? (
        <ArtEmptyState variant="error" compact />
      ) : (
        <ArtEmptyState
          variant="no-results"
          compact
          title={noOptionsMessage}
        />
      )}
    </li>
  );

  return (
    <ul
      ref={ref}
      role="listbox"
      className={cn('art-scrollable', className)}
    >
      {actionsPosition === 'top' && visibleActions.length > 0 ? (
        <>
          {actionRows}
          {divider}
          {optionRows}
        </>
      ) : (
        <>
          {optionRows}
          {divider}
          {actionRows}
        </>
      )}
      {stateRow}
    </ul>
  );
}));

ArtListbox.displayName = 'ArtListbox';
export default ArtListbox;
export { ArtListbox };

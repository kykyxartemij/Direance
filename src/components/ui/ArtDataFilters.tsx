'use client';

import { useState, type ReactNode } from 'react';
import ArtButton from './ArtButton';
import ArtIconButton from './ArtIconButton';
import ArtCollapse from './ArtCollapse';
import ArtInput from './ArtInput';
import { cn } from './art.utils';

// ==== Types ====

interface ArtDataFiltersProps {
  // ==== Search ====
  /** Debounce delay in ms, or true for 300ms default. Default: 300 */
  searchDebounce?: boolean | number;
  searchPlaceholder?: string;
  /** Called with debounced search string whenever input changes */
  onSearch?: (value: string) => void;

  // ==== Advanced filters panel ====
  /** Content rendered inside the collapsible panel. State lives in the parent. */
  advancedFilters?: ReactNode;
  /** Badge count shown on the Filters button to indicate active filters */
  activeFilterCount?: number;
  /**
   * Wire to clear every advanced filter at once (e.g. useUrlFilters().clearFilters).
   * When provided, a square clear button appears next to the Filters toggle.
   * Disabled — but still tooltipped — when activeFilterCount is 0.
   */
  onClearFilters?: () => void;
  /** Controlled open state for the filters panel */
  filtersOpen?: boolean;
  defaultFiltersOpen?: boolean;
  onFiltersOpenChange?: (open: boolean) => void;

  className?: string;
}

// ==== Component ====

const ArtDataFilters = ({
  searchDebounce = 300,
  searchPlaceholder = 'Search…',
  onSearch,
  advancedFilters,
  activeFilterCount = 0,
  onClearFilters,
  filtersOpen,
  defaultFiltersOpen = false,
  onFiltersOpenChange,
  className,
}: ArtDataFiltersProps) => {
  // ==== Panel open state ====

  const isControlled = filtersOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultFiltersOpen);
  const open = isControlled ? filtersOpen : internalOpen;

  const toggleOpen = () => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onFiltersOpenChange?.(next);
  };

  // ==== Render ====

  return (
    <div className={cn('art-data-filters', className)}>
      <div className="art-data-filters-bar">
        <ArtInput
          icon={{ name: 'Search', size: 16 }}
          placeholder={searchPlaceholder}
          debounce={searchDebounce}
          onDebouncedChange={onSearch}
          clearable
        />

        {advancedFilters && (
          <ArtButton
            variant="outlined"
            icon="ChevronDown"
            onClick={toggleOpen}
            className={cn('art-data-filters-toggle', open && 'art-data-filters-toggle--open')}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="art-data-filters-count">{activeFilterCount}</span>
            )}
          </ArtButton>
        )}

        {advancedFilters && onClearFilters && (
          <ArtIconButton
            icon="Close"
            variant="outlined"
            tooltip="Clear all filters"
            aria-label="Clear all filters"
            onClick={onClearFilters}
            disabled={activeFilterCount === 0}
          />
        )}
      </div>

      {advancedFilters && (
        <ArtCollapse open={open}>
          <div className="art-data-filters-panel">{advancedFilters}</div>
        </ArtCollapse>
      )}
    </div>
  );
};

ArtDataFilters.displayName = 'ArtDataFilters';
export default ArtDataFilters;
export { ArtDataFilters };
export type { ArtDataFiltersProps };

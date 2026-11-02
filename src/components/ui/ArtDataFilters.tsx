'use client';

import { useState, type ReactNode } from 'react';
import ArtButton from './ArtButton';
import ArtIconButton from './ArtIconButton';
import ArtCollapse from './ArtCollapse';
import ArtInput from './ArtInput';
import { cn } from './art.utils';

const SEARCH_DEBOUNCE_MS = 300;

// ==== Types ====

interface ArtDataFiltersProps {
  // ==== Search ====
  /** Show the free-text search input. Default: true. Set false for filter-only bars (e.g. report pages with only advanced filters). */
  searchable?: boolean;
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
  defaultFiltersOpen?: boolean;
}

// ==== Component ====

const ArtDataFilters = ({
  searchable = true,
  searchPlaceholder = 'Search…',
  onSearch,
  advancedFilters,
  activeFilterCount = 0,
  onClearFilters,
  defaultFiltersOpen = false,
}: ArtDataFiltersProps) => {
  const [open, setOpen] = useState(defaultFiltersOpen);

  return (
    <div className="art-data-filters">
      <div className="art-data-filters-bar">
        {searchable && (
          <ArtInput
            icon={{ name: 'Search', size: 16 }}
            placeholder={searchPlaceholder}
            debounce={SEARCH_DEBOUNCE_MS}
            onDebouncedChange={onSearch}
            clearable
          />
        )}

        {advancedFilters && (
          <ArtButton
            variant="outlined"
            icon="ChevronDown"
            onClick={() => setOpen(!open)}
            className={cn('art-data-filters-toggle', open && 'art-data-filters-toggle--open')}
          >
            Filters
            <span
              className={cn(
                'art-data-filters-count',
                activeFilterCount === 0 && 'art-data-filters-count--neutral',
              )}
            >
              {activeFilterCount}
            </span>
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

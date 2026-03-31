'use client';

import { useEffect, useRef, useState } from 'react';
import ArtIcon from './ArtIcon';
import ArtIconButton from './ArtIconButton';
import ArtPopover from './ArtPopover';
import { cn } from './art.utils';

// ==== Types ====

interface ArtPaginationProps {
  /** 1-based current page */
  page: number;
  pageSize: number;
  /**
   * Total number of items.
   *   undefined → hide pagination entirely (server-side, total not yet known)
   *   0         → valid "0 results" — bar shows with disabled navigation
   */
  total?: number;
  onChange: (page: number) => void;
  /** Available page-size options. When provided, shows a rows-per-page selector. */
  pageSizeOptions?: number[];
  /** Called when the user picks a different page size */
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

// ==== Component ====

const ArtPagination = ({
  page,
  pageSize,
  total,
  onChange,
  pageSizeOptions,
  onPageSizeChange,
  className,
}: ArtPaginationProps) => {
  const totalPages  = total !== undefined && pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const clampedPage = Math.min(Math.max(1, page), totalPages);

  const [draft, setDraft]     = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);

  // Snap to valid range when total shrinks
  useEffect(() => {
    if (clampedPage !== page) onChange(clampedPage);
  }, [clampedPage, page, onChange]);

  if (total === undefined) return null;

  const from = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const to   = Math.min(clampedPage * pageSize, total);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) onChange(Math.min(Math.max(1, n), totalPages));
  };

  // ==== Render ====

  return (
    <div className={cn('art-pagination', className)}>
      <span className="art-pagination-info">
        {total === 0 ? '0 results' : `${from}–${to} of ${total}`}
      </span>

      <div className="art-pagination-pages">
        {/* Rows-per-page selector */}
        {pageSizeOptions && onPageSizeChange && (
          <ArtPopover
            placement="top"
            trigger={
              <button type="button" className="art-pagination-size-btn" aria-label="Rows per page">
                {pageSize}
                <ArtIcon name="ChevronDown" size={10} />
              </button>
            }
          >
            <div className="art-pagination-size-list">
              {pageSizeOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={cn('art-pagination-size-opt', opt === pageSize && 'art-pagination-size-opt--active')}
                  onClick={() => { onPageSizeChange(opt); onChange(1); }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </ArtPopover>
        )}

        <ArtIconButton
          icon={{ name: 'ChevronDown', size: 14, style: { transform: 'rotate(90deg)' } }}
          aria-label="Previous page"
          onClick={() => onChange(clampedPage - 1)}
          disabled={clampedPage <= 1}
        />

        <input
          ref={inputRef}
          className="art-pagination-field"
          type="text"
          inputMode="numeric"
          value={focused ? draft : String(clampedPage)}
          aria-label={`Page ${clampedPage} of ${totalPages}`}
          title={`Page ${clampedPage} of ${totalPages} — type to jump`}
          onFocus={() => { setDraft(String(clampedPage)); setFocused(true); inputRef.current?.select(); }}
          onBlur={() => { setFocused(false); commit(draft); }}
          onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setDraft(v); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter')     { e.currentTarget.blur(); }
            if (e.key === 'Escape')    { setFocused(false); setDraft(''); inputRef.current?.blur(); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(Math.min(clampedPage + 1, totalPages)); }
            if (e.key === 'ArrowRight')   { e.preventDefault(); onChange(Math.min(clampedPage + 1, totalPages)); }
            if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(clampedPage - 1, 1)); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(clampedPage - 1, 1)); }
          }}
        />

        <span className="art-pagination-of">/ {totalPages}</span>

        <ArtIconButton
          icon={{ name: 'ChevronDown', size: 14, style: { transform: 'rotate(-90deg)' } }}
          aria-label="Next page"
          onClick={() => onChange(clampedPage + 1)}
          disabled={clampedPage >= totalPages}
        />
      </div>
    </div>
  );
};

ArtPagination.displayName = 'ArtPagination';
export default ArtPagination;
export { ArtPagination };
export type { ArtPaginationProps };

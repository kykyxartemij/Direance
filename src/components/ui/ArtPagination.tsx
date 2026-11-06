'use client';

import { useRef, useState } from 'react';
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

  // null = not editing, the field shows the current page.
  const [draft, setDraft] = useState<string | null>(null);
  const cancelRef         = useRef(false);

  if (total === undefined) return null;

  const from = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const to   = Math.min(clampedPage * pageSize, total);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    const next = Math.min(Math.max(1, n), totalPages);
    if (!isNaN(n) && next !== clampedPage) onChange(next);
  };

  const step = (delta: number) => {
    const next = Math.min(Math.max(1, clampedPage + delta), totalPages);
    setDraft(String(next));
    if (next !== clampedPage) onChange(next);
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
                  onClick={() => onPageSizeChange(opt)}
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
          className="art-pagination-field"
          type="text"
          inputMode="numeric"
          value={draft ?? String(clampedPage)}
          aria-label={`Page ${clampedPage} of ${totalPages}`}
          title={`Page ${clampedPage} of ${totalPages}. Type a page, or use arrow up and down.`}
          onFocus={(e) => { setDraft(String(clampedPage)); e.currentTarget.select(); }}
          onBlur={() => {
            if (draft !== null && !cancelRef.current) commit(draft);
            cancelRef.current = false;
            setDraft(null);
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter')     { e.currentTarget.blur(); }
            if (e.key === 'Escape')    { cancelRef.current = true; e.currentTarget.blur(); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); step(1); }
            if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
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

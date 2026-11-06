'use client';

import type { ReactNode } from 'react';
import ArtIcon, { type ArtIconName } from './ArtIcon';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

// ==== Types ====

interface ArtEmptyStateProps {
  /**
   * no-data    — zero records total (e.g. user has no videos yet)
   * no-results — filtered/searched to zero (try adjusting filters)
   * error      — failed to load data
   */
  variant?: 'no-data' | 'no-results' | 'error';
  /** Override the default icon for this variant */
  icon?: ArtIconName;
  /** Override the default title */
  title?: string;
  /** Override the default description. In compact mode, description is hidden unless explicitly passed. */
  description?: string;
  /** Optional CTA button or link */
  action?: ReactNode;
  /** Compact layout for use inside listboxes or small containers */
  compact?: boolean;
}

// ==== Defaults per variant ====

const DEFAULTS: Record<NonNullable<ArtEmptyStateProps['variant']>, {
  icon: ArtIconName; title: string; description: string; color?: ArtColor;
}> = {
  'no-data': {
    icon: 'Upload',
    title: 'Nothing here yet',
    description: 'Get started by adding your first item.',
  },
  'no-results': {
    icon: 'Search',
    title: 'No results found',
    description: 'Try adjusting your search or clearing the filters.',
  },
  'error': {
    icon: 'Close',
    title: 'Something went wrong',
    description: 'Failed to load data. Please try again.',
    color: 'danger',
  },
};

// ==== Component ====

const ArtEmptyState = ({
  variant = 'no-data',
  icon,
  title,
  description,
  action,
  compact = false,
}: ArtEmptyStateProps) => {
  const d = DEFAULTS[variant];
  const descText = description ?? (compact ? undefined : d.description);

  return (
    <div className={cn(
      'art-empty-state',
      compact && 'art-empty-state--compact',
      d.color && ART_COLOR_CLASS[d.color],
    )}>
      <ArtIcon name={icon ?? d.icon} size={compact ? 20 : 36} className="art-empty-state-icon" />
      <p className="art-empty-state-title">{title ?? d.title}</p>
      {descText && <p className="art-empty-state-desc">{descText}</p>}
      {action && <div className="art-empty-state-action">{action}</div>}
    </div>
  );
};

ArtEmptyState.displayName = 'ArtEmptyState';
export default ArtEmptyState;
export { ArtEmptyState };
export type { ArtEmptyStateProps };

'use client';

import ArtIcon, { type ArtIconName } from './ArtIcon';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

// ==== Types ====

export interface ArtTitleProps {
  title: string;
  description?: string;
  icon?: ArtIconName;
  color?: ArtColor;
  /**
   * sm — snackbar (text-sm, icon 20)
   * md — dialog   (text-base, icon 36)
   * lg — standalone page/section (text-lg, icon 36)
   * Default: lg
   */
  size?: 'sm' | 'md' | 'lg';
  /** Applied to the title <p> — use for aria-labelledby on the parent dialog/region */
  id?: string;
  className?: string;
}

const ICON_SIZE: Record<NonNullable<ArtTitleProps['size']>, number> = {
  sm: 20,
  md: 36,
  lg: 36,
};

// ==== Component ====

export function ArtTitle({
  title,
  description,
  icon,
  color,
  size = 'lg',
  id,
  className,
}: ArtTitleProps) {
  return (
    <div className={cn('art-title', `art-title--${size}`, color && ART_COLOR_CLASS[color], className)}>
      {icon && <ArtIcon name={icon} size={ICON_SIZE[size]} className="art-title-icon" />}
      <div className="art-title-body">
        <p className="art-title-text" id={id}>{title}</p>
        {description && <p className="art-title-desc">{description}</p>}
      </div>
    </div>
  );
}

ArtTitle.displayName = 'ArtTitle';
export default ArtTitle;

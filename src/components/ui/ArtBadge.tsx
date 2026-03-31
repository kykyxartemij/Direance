'use client';

import { type HTMLAttributes, type ReactNode } from 'react';
import ArtIcon, { type ArtIconName } from './ArtIcon';
import ArtIconButton from './ArtIconButton';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** default = filled, outlined = border only, ghost = text only */
  variant?: 'default' | 'outlined' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  color?: ArtColor;
  icon?: ArtIconName;
  /** Chip mode — renders a × button that calls onRemove when clicked */
  onRemove?: () => void;
  children: ReactNode;
}

const VARIANT_CLASS: Record<NonNullable<ArtBadgeProps['variant']>, string> = {
  default:  'art-badge--default',
  outlined: 'art-badge--outlined',
  ghost:    'art-badge--ghost',
};

const SIZE_CLASS: Record<NonNullable<ArtBadgeProps['size']>, string> = {
  sm: 'art-badge--sm',
  md: '',
  lg: 'art-badge--lg',
};

const ICON_SIZE: Record<NonNullable<ArtBadgeProps['size']>, number> = {
  sm: 12, md: 18, lg: 22,
};

const ArtBadge = ({
  variant = 'outlined',
  size = 'md',
  color,
  icon,
  onRemove,
  className,
  children,
  ...rest
}: ArtBadgeProps) => (
  <span
    className={cn(
      'art-badge',
      VARIANT_CLASS[variant],
      SIZE_CLASS[size],
      color && ART_COLOR_CLASS[color],
      icon && 'art-badge--with-icon',
      onRemove && 'art-badge--removable',
      className,
    )}
    {...rest}
  >
    {icon && <ArtIcon name={icon} size={ICON_SIZE[size]} />}
    {children}
    {onRemove && (
      <ArtIconButton
        size="sm"
        variant="ghost"
        icon={{ name: 'Close' }}
        className="art-badge-remove"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label="Remove"
      />
    )}
  </span>
);

ArtBadge.displayName = 'ArtBadge';
export default ArtBadge;
export { ArtBadge };
export type { ArtBadgeProps };

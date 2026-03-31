'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import ArtIcon, { type ArtIconName } from './ArtIcon';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** default = filled, outlined = border, ghost = transparent */
  variant?: 'default' | 'outlined' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ArtIconName;
  loading?: boolean;
  color?: ArtColor;
  children: ReactNode;
}

const SIZE_CLASS: Record<NonNullable<ArtButtonProps['size']>, string> = {
  sm: 'art-btn--sm',
  md: 'art-btn--md',
  lg: 'art-btn--lg',
};

const ICON_SIZE: Record<NonNullable<ArtButtonProps['size']>, number> = {
  sm: 14,
  md: 16,
  lg: 20,
};

const ArtButton = forwardRef<HTMLButtonElement, ArtButtonProps>(
  ({ variant = 'outlined', size = 'md', icon, loading = false, color, className = '', children, disabled, ...rest }, ref) => {
    const baseClass = variant === 'default' ? 'btn-primary' : variant === 'ghost' ? 'btn-ghost' : 'btn';
    return (
      <button
        ref={ref}
        className={cn(baseClass, SIZE_CLASS[size], color && ART_COLOR_CLASS[color], className)}
        disabled={loading || disabled}
        {...rest}
      >
        {loading
          ? <ArtIcon name='Loading' size={ICON_SIZE[size]} />
          : icon && <ArtIcon name={icon} size={ICON_SIZE[size]} />}
        {children}
      </button>
    );
  },
);

ArtButton.displayName = 'ArtButton';
export default ArtButton;
export { ArtButton };
export type { ArtButtonProps };

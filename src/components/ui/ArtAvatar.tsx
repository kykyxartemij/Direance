'use client';

import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

// ==== Types ====

interface ArtAvatarProps {
  /** Image URL. Falls back to initials if omitted or fails to load. */
  src?: string;
  alt?: string;
  /** Full name — used to generate initials (up to 2 chars) when no image */
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Background color for the initials fallback */
  color?: ArtColor;
  className?: string;
}

// ==== Helpers ====

const SIZE_CLASS: Record<NonNullable<ArtAvatarProps['size']>, string> = {
  sm: 'art-avatar--sm',
  md: '',
  lg: 'art-avatar--lg',
  xl: 'art-avatar--xl',
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ==== Component ====

const ArtAvatar = ({ src, alt, name, size = 'md', color, className }: ArtAvatarProps) => (
  <span
    className={cn('art-avatar', SIZE_CLASS[size], color && ART_COLOR_CLASS[color], className)}
    aria-label={alt ?? name}
  >
    {src
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={src} alt={alt ?? name ?? ''} />
      : name ? getInitials(name) : null}
  </span>
);

ArtAvatar.displayName = 'ArtAvatar';
export default ArtAvatar;
export { ArtAvatar };
export type { ArtAvatarProps };

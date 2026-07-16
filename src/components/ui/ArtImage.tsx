'use client';

import Image, { type ImageProps } from 'next/image';
import ArtSkeleton from './ArtSkeleton';
import ArtEmptyState from './ArtEmptyState';
import { cn } from './art.utils';

interface ArtImageProps extends Omit<ImageProps, 'src' | 'placeholder'> {
  /** null/undefined renders the empty state — lets callers pass query.data?.src directly */
  src: string | null | undefined;
  /** External fetch/decode state (e.g. bytesClient query) — shows shimmer instead of empty state */
  isLoading?: boolean;
  fit?: 'contain' | 'cover';
  rounded?: boolean;
  emptyLabel?: string;
  /** Bytes-on-demand fetch (see docs/ImagesGuide.md) — empty box becomes the click-to-load trigger, no separate button needed */
  onRequestLoad?: () => void;
}

// Wraps next/image with the project's bytes-as-base64 flow (see docs/ImagesGuide.md):
// data: URIs never benefit from next/image optimization, so unoptimized defaults true.
function ArtImage({
  src,
  alt,
  width,
  height,
  isLoading = false,
  fit = 'contain',
  rounded = true,
  emptyLabel,
  onRequestLoad,
  className,
  unoptimized = true,
  sizes,
  ...rest
}: ArtImageProps) {
  const boxStyle = { width, height };

  if (isLoading) {
    return <ArtSkeleton className={cn('art-image-box', rounded && 'art-image--rounded', className)} style={boxStyle} />;
  }

  if (!src) {
    if (onRequestLoad) {
      return (
        <button
          type="button"
          onClick={onRequestLoad}
          aria-label={emptyLabel ?? 'Load image'}
          className={cn('art-image-box art-image-empty art-image-empty--clickable', rounded && 'art-image--rounded', className)}
          style={boxStyle}
        >
          <ArtEmptyState variant="no-data" icon="Refresh" title={emptyLabel ?? 'Click to load'} compact />
        </button>
      );
    }

    return (
      <div className={cn('art-image-box art-image-empty', rounded && 'art-image--rounded', className)} style={boxStyle}>
        <ArtEmptyState variant="no-data" icon="Upload" title={emptyLabel ?? 'No image'} compact />
      </div>
    );
  }

  // fill (not width/height attrs) — CSS-sized box stays fixed regardless of the image's
  // intrinsic aspect ratio, so it never flashes larger than the skeleton/empty state.
  return (
    <div className={cn('art-image-frame', rounded && 'art-image--rounded', className)} style={boxStyle}>
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized={unoptimized}
        sizes={sizes ?? `${width}px`}
        className={fit === 'cover' ? 'art-image--cover' : 'art-image--contain'}
        {...rest}
      />
    </div>
  );
}

ArtImage.displayName = 'ArtImage';

export default ArtImage;
export { ArtImage };
export type { ArtImageProps };

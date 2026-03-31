import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './art.utils';

// ==== Bar mode (default) ====

interface ArtSkeletonBarProps extends HTMLAttributes<HTMLDivElement> {
  wrap?: false;
  children?: never;
}

// ==== Wrap mode ====
// Renders children invisibly to claim their natural size, then overlays shimmer over
// that exact space. No JS measuring — CSS visibility:hidden preserves layout geometry.

interface ArtSkeletonWrapProps {
  wrap: true;
  children: ReactNode;
  className?: string;
}

type ArtSkeletonProps = ArtSkeletonBarProps | ArtSkeletonWrapProps;

const ArtSkeleton = (props: ArtSkeletonProps) => {
  if (props.wrap) {
    const { children, className } = props;
    return (
      <div className={cn('art-skeleton-wrap', className)}>
        <div className="art-skeleton-ghost" aria-hidden="true">{children}</div>
        <div className="shimmer art-skeleton-overlay" />
      </div>
    );
  }

  const { className, ...rest } = props;
  return <div className={cn('shimmer', className)} {...rest} />;
};

ArtSkeleton.displayName = 'ArtSkeleton';
export default ArtSkeleton;

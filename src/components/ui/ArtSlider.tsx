'use client';

import { useRef, useEffect, useLayoutEffect, useCallback, type HTMLAttributes } from 'react';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtSliderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** 'md' = default track height, 'sm' = thinner. Default: 'md' */
  size?: 'sm' | 'md';
  color?: ArtColor;
  readOnly?: boolean;
}

const ArtSlider = ({
  value,
  min = 0,
  max = 1,
  onChange,
  size = 'md',
  color,
  readOnly = false,
  className,
  ...rest
}: ArtSliderProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Refs keep closures fresh without re-registering window listeners
  const onChangeRef = useRef(onChange);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    minRef.current = min;
    maxRef.current = max;
  });

  const resolve = useCallback((clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return minRef.current + ratio * (maxRef.current - minRef.current);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      onChangeRef.current(resolve(e.clientX));
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resolve]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    isDragging.current = true;
    onChangeRef.current(resolve(e.clientX));
  };

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div
      ref={trackRef}
      className={cn('art-slider', `art-slider--${size}`, color && ART_COLOR_CLASS[color], className)}
      onMouseDown={onMouseDown}
      {...rest}
    >
      <div className="art-slider-fill" style={{ width: `${pct}%` }} />
      <div className="art-slider-thumb" style={{ left: `${pct}%` }} />
    </div>
  );
};

ArtSlider.displayName = 'ArtSlider';
export default ArtSlider;
export { ArtSlider };
export type { ArtSliderProps };

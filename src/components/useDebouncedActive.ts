'use client';

import { useEffect, useRef, useState } from 'react';

const SHOW_DELAY_MS = 80;
const MIN_VISIBLE_MS = 150;

/**
 * Debounces a boolean for loading-overlay visibility: SHOW_DELAY_MS before showing (fetches
 * faster than this never flash anything) and MIN_VISIBLE_MS once shown (avoids a blink-off
 * mid-fade). Shared by GlobalLoaderBlur and PageLoaderBlur — same visual language, same timing.
 */
export function useDebouncedActive(active: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (active && !visible) {
      const timer = setTimeout(() => {
        setVisible(true);
        shownAtRef.current = Date.now();
      }, SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (!active && visible) {
      const elapsed = Date.now() - (shownAtRef.current ?? 0);
      const timer = setTimeout(() => setVisible(false), Math.max(0, MIN_VISIBLE_MS - elapsed));
      return () => clearTimeout(timer);
    }
  }, [active, visible]);

  return visible;
}

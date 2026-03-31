'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import debounce from 'lodash.debounce';

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Returns a stable debounced caller for `callback`.
 * - `false` / `0` — disabled (calling the returned fn is a no-op)
 * - `true`        — uses DEFAULT_DEBOUNCE_MS (300ms)
 * - `number`      — custom delay in ms
 *
 * The returned function is always stable — no null check needed at call site.
 * Cleanup is handled internally.
 */
export function useArtDebounced(
  callback: ((value: string) => void) | undefined,
  delay: boolean | number,
) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  type DebouncedFn = ReturnType<typeof debounce<(value: string) => void>>;
  const debouncedRef = useRef<DebouncedFn | null>(null);

  useEffect(() => {
    if (!delay) {
      debouncedRef.current = null;
      return;
    }
    const ms = delay === true ? DEFAULT_DEBOUNCE_MS : delay;
    const fn = debounce((value: string) => callbackRef.current?.(value), ms);
    debouncedRef.current = fn;
    return () => {
      fn.cancel();
      debouncedRef.current = null;
    };
  }, [delay]);

  return useCallback((value: string) => debouncedRef.current?.(value), []);
}

// ==== useAnchoredPanel ====

export interface AnchoredPanelPos {
  top?: number;
  bottom?: number;
  left: number;
  width?: number;
}

interface UseAnchoredPanelOptions {
  placement?: 'top' | 'bottom';
  /** Include trigger width in pos — needed for dropdowns that should match input width */
  trackWidth?: boolean;
}

export function useAnchoredPanel<
  T extends HTMLElement = HTMLElement,
  P extends HTMLElement = HTMLElement,
>(options?: UseAnchoredPanelOptions) {
  const { placement = 'bottom', trackWidth = false } = options ?? {};

  const triggerRef = useRef<T>(null);
  const panelRef   = useRef<P>(null);
  const [pos, setPos] = useState<AnchoredPanelPos | null>(null);

  const open = pos !== null;

  const computePos = useCallback((): AnchoredPanelPos | null => {
    const el = triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const base = trackWidth ? { width: rect.width } : {};
    return placement === 'top'
      ? { ...base, bottom: window.innerHeight - rect.top + 4, left: rect.left }
      : { ...base, top: rect.bottom + 4, left: rect.left };
  }, [placement, trackWidth]);

  const show   = useCallback(() => setPos((p) => p ?? computePos()), [computePos]);
  const hide   = useCallback(() => setPos(null), []);
  const toggle = useCallback(() => setPos((p) => (p !== null ? null : computePos())), [computePos]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      hide();
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open, hide]);

  return { triggerRef, panelRef, pos, open, show, hide, toggle };
}

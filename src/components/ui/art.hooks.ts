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
  /** priority placement, in not enough space on preferred side, will fallback to the other side */
  placement?: 'bottom-top' | 'top' | 'bottom' | 'left' | 'right';
  /** Include trigger width in pos — needed for dropdowns that should match input width */
  trackWidth?: boolean;
}

export function useAnchoredPanel<
  T extends HTMLElement = HTMLElement,
  P extends HTMLElement = HTMLElement,
>(options?: UseAnchoredPanelOptions) {
  const { placement, trackWidth = false } = options ?? {};

  const triggerRef = useRef<T>(null);
  const panelRef   = useRef<P>(null);

  const [open, setOpen] = useState(false);

  const frameRef = useRef<number | null>(null);

  const computeAndApply = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();

    panel.style.position = 'fixed';

    const spaceBelow = window.innerHeight - rect.bottom - 4;

    if (placement === 'left') {
      panel.style.left = `${rect.left - panel.offsetWidth - 4}px`;
      panel.style.top = `${rect.top}px`;
    } else if (placement === 'right') {
      panel.style.left = `${rect.right + 4}px`;
      panel.style.top = `${rect.top}px`;
    } else if (placement === 'bottom') {
      panel.style.top = `${rect.bottom + 4}px`;
      panel.style.left = `${rect.left}px`;
    } else if (placement === 'top') {
      panel.style.top = `${rect.top - panel.offsetHeight - 4}px`;
      panel.style.left = `${rect.left}px`;
    } else {
      // default (bottom-top): prefer bottom, fallback to top
      const applied = spaceBelow >= panel.offsetHeight ? 'bottom' : 'top';
      panel.style.top = applied === 'top'
        ? `${rect.top - panel.offsetHeight - 4}px`
        : `${rect.bottom + 4}px`;
      panel.style.left = `${rect.left}px`;
    }

    if (trackWidth) panel.style.width = `${rect.width}px`;
  }, [placement, trackWidth]);

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current !== null) return;

    frameRef.current = requestAnimationFrame(() => {
      computeAndApply();
      frameRef.current = null;
    });
  }, [computeAndApply]);

  const show = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(computeAndApply);
  }, [computeAndApply]);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      if (next) requestAnimationFrame(computeAndApply);
      return next;
    });
  }, [computeAndApply]);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      hide();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') hide();
    };

    const onUpdate = () => scheduleUpdate();

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onUpdate);
    window.addEventListener('scroll', onUpdate, true);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onUpdate);
      window.removeEventListener('scroll', onUpdate, true);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [open, hide, scheduleUpdate]);

  return { triggerRef, panelRef, open, show, hide, toggle };
}
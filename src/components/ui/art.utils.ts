import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type Ref } from 'react';

/** Merge Tailwind classes without conflicts. Use instead of template literals in all Art components. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// ==== mergeRefs ====

/**
 * Combine several refs into one callback ref — use when a component keeps its own
 * internal ref but must also honour a forwarded `ref` prop. Writing to a ref's
 * `.current` here is the ref API (not prop mutation), so it lives outside any
 * component body. Wrap the result in `useMemo` at the call site to keep identity stable.
 */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as { current: T | null }).current = node;
    }
  };
}

// ==== computeAnchoredPos ====

export type AnchorPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface AnchoredPosition {
  top: number;
  left: number;
  /** CSS transform to center/offset the panel relative to the computed anchor point */
  transform: string;
}

/**
 * Pure function — computes fixed position for a floating element anchored to triggerEl.
 * Use for DOM-only components (e.g. ArtTooltip) where React state is not needed.
 * For stateful panels with open/close, use useAnchoredPanel instead.
 */
export function computeAnchoredPos(triggerEl: HTMLElement, placement: AnchorPlacement = 'top'): AnchoredPosition {
  const rect = triggerEl.getBoundingClientRect();
  const GAP = 6;
  switch (placement) {
    case 'bottom':
      return { top: rect.bottom + GAP, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' };
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - GAP, transform: 'translate(-100%, -50%)' };
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + GAP, transform: 'translateY(-50%)' };
    case 'top':
    default:
      return { top: rect.top - GAP, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' };
  }
}

'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import ArtIcon, { type ArtIconName } from './ArtIcon';
import { useAnchoredPanel } from './art.hooks';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

// ==== Types ====

export interface ArtMenuItemDef {
  value: string;
  label: string;
  icon?: ArtIconName;
  color?: ArtColor;
  disabled?: boolean;
  /** Renders a thin separator line above this item */
  separator?: boolean;
}

interface ArtMenuProps {
  /** Trigger element — onClick is injected via cloneElement; any forwardRef'd element works */
  children: ReactNode;
  items: ArtMenuItemDef[];
  onSelect: (item: ArtMenuItemDef) => void;
  placement?: 'top' | 'bottom';
  className?: string;
}

// ==== Component ====
// Uses useAnchoredPanel directly so hide() can be called on item select.
// Trigger: cloneElement injects onClick into the child; a span wrapper holds the ref
// for position calculations without interfering with the child's layout.

function ArtMenu({ children, items, onSelect, placement = 'bottom', className }: ArtMenuProps) {
  const { triggerRef, panelRef, open, hide, toggle } =
    useAnchoredPanel<HTMLElement, HTMLDivElement>({ placement });

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, hide]);

  const trigger = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{ onClick?: React.MouseEventHandler }>,
        { onClick: toggle },
      )
    : <button type="button" onClick={toggle}>{children}</button>;

  return (
    <>
      <span ref={triggerRef} style={{ display: 'inline-flex' }}>
        {trigger}
      </span>

      {open && createPortal(
        <div
          ref={panelRef}
          className={cn('art-popover', className)}
          style={{ zIndex: 'var(--z-anchor)' as unknown as number }}
        >
          <ul role="menu" className="art-menu-list art-scrollable">
            {items.map((item) => (
              <li key={item.value} role="presentation">
                {item.separator && (
                  <div className="art-listbox-section-divider" role="separator" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={cn('art-combobox-option', item.color && ART_COLOR_CLASS[item.color])}
                  onMouseDown={(e) => {
                    const el = e.currentTarget;
                    el.setAttribute('data-pressing', '');
                    window.addEventListener('mouseup', () => el.removeAttribute('data-pressing'), { once: true });
                  }}
                  onClick={() => { onSelect(item); hide(); }}
                >
                  <span className="art-combobox-option-inner">
                    {item.icon && <ArtIcon name={item.icon} size={14} />}
                    {item.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}

ArtMenu.displayName = 'ArtMenu';
export default ArtMenu;
export { ArtMenu };
export type { ArtMenuProps };

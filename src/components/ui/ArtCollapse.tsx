'use client';

import { forwardRef, useImperativeHandle, useState, type ReactNode } from 'react';
import ArtBaseCollapse from './ArtBaseCollapse';
import ArtIcon, { type ArtIconName } from './ArtIcon';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

// ==== Types ====

export interface ArtCollapseRef {
  expand: () => void;
  close: () => void;
  toggle: () => void;
}

interface ArtCollapseProps {
  children: ReactNode;

  // ==== Trigger (self-contained header button) ====
  /** Simple text label rendered in the trigger button */
  title?: string;
  /** Leading icon in the trigger button */
  icon?: ArtIconName;
  /** Fully custom trigger content — replaces title + icon */
  trigger?: ReactNode;
  /** Visual style of the trigger button and its content container */
  variant?: 'default' | 'outlined' | 'ghost';
  color?: ArtColor;

  // ==== Open state ====
  /** Controlled open value. Omit to let ArtCollapse manage its own state. */
  open?: boolean;
  defaultOpen?: boolean;
  onChange?: (open: boolean) => void;

  className?: string;
}

// ==== Component ====

const ArtCollapse = forwardRef<ArtCollapseRef, ArtCollapseProps>((
  {
    children,
    title,
    icon,
    trigger,
    variant = 'outlined',
    color,
    open,
    defaultOpen = false,
    onChange,
    className,
  },
  ref,
) => {
  // ==== Controlled / uncontrolled ====

  const isControlled = open !== undefined;
  const [internal, setInternal] = useState(defaultOpen);
  const isOpen = isControlled ? open : internal;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  // ==== Imperative handle ====

  useImperativeHandle(ref, () => ({
    expand: () => setOpen(true),
    close:  () => setOpen(false),
    toggle: () => setOpen(!isOpen),
  }));

  // ==== Trigger variant CSS ====

  const hasTrigger = title !== undefined || trigger !== undefined;
  const triggerBase =
    variant === 'default' ? 'btn-primary' :
    variant === 'ghost'   ? 'btn-ghost'   : 'btn';

  // ==== Render ====

  return (
    <div
      className={cn(
        'art-collapse-root',
        hasTrigger && 'art-collapse-root--has-trigger',
        hasTrigger && `art-collapse-root--${variant}`,
        className,
      )}
    >
      {hasTrigger && (
        <button
          type="button"
          className={cn(triggerBase, 'art-collapse-trigger', color && ART_COLOR_CLASS[color])}
          onClick={() => setOpen(!isOpen)}
          aria-expanded={isOpen}
        >
          {trigger ?? (
            <>
              {icon && <ArtIcon name={icon} size={16} />}
              <span className="art-collapse-trigger-label">{title}</span>
              <ArtIcon
                name="ChevronDown"
                size={14}
                className={cn('art-collapse-chevron', isOpen && 'art-collapse-chevron--open')}
              />
            </>
          )}
        </button>
      )}

      <ArtBaseCollapse
        open={isOpen}
        className={cn(hasTrigger && 'art-collapse-body')}
      >
        <div className={cn(hasTrigger && 'art-collapse-body-inner')}>
          {children}
        </div>
      </ArtBaseCollapse>
    </div>
  );
});

ArtCollapse.displayName = 'ArtCollapse';
export default ArtCollapse;
export { ArtCollapse };
export type { ArtCollapseProps };

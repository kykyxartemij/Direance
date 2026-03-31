'use client';

import { useState } from 'react';
import ArtIcon, { type ArtIconName } from './ArtIcon';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

// ==== Types ====

export interface ArtTab {
  value: string;
  label: string;
  icon?: ArtIconName;
  disabled?: boolean;
  color?: ArtColor;
}

interface ArtTabsProps {
  tabs: ArtTab[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}

// ==== Component ====

const ArtTabs = ({ tabs, value, defaultValue, onChange, className }: ArtTabsProps) => {
  // ==== Controlled / uncontrolled state ====
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.value ?? '');
  const active = isControlled ? value : internal;

  const handleSelect = (tab: ArtTab) => {
    if (tab.disabled || tab.value === active) return;
    if (!isControlled) setInternal(tab.value);
    onChange?.(tab.value);
  };

  // ==== Render ====
  return (
    <div role="tablist" aria-orientation="horizontal" className={cn('art-tabs', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          type="button"
          aria-selected={tab.value === active}
          disabled={tab.disabled}
          className={cn('art-tab', tab.value === active && 'art-tab--active', tab.value === active && tab.color && ART_COLOR_CLASS[tab.color])}
          onClick={() => handleSelect(tab)}
        >
          {tab.icon && <ArtIcon name={tab.icon as ArtIconName} size="sm" />}
          {tab.label}
        </button>
      ))}
    </div>
  );
};

ArtTabs.displayName = 'ArtTabs';
export default ArtTabs;
export { ArtTabs };
export type { ArtTabsProps };

'use client';

import React, { useId, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredPanel } from './art.hooks';
import ArtButton from './ArtButton';
import ArtHelperText from './ArtHelperText';
import ArtIconButton from './ArtIconButton';
import ArtInput from './ArtInput';
import ArtLabel from './ArtLabel';
import type { ArtIconProps } from './ArtIcon';
import { cn } from './art.utils';

interface ArtDatePickerProps {
  ref?: Ref<HTMLInputElement>;
  label?: string;
  helperText?: string;
  errorText?: string;
  /** ISO date (yyyy-mm-dd), or '' when empty */
  value: string;
  /** Fires only for a chosen date: day click, Today, Clear, or typed date on Enter/blur. */
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  /** false for fields that fall back to a default date, where clearing changes nothing. */
  clearable?: boolean;
}

// ==== Constants ====

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GRID_CELLS = 42;

const FIELD_ICON: ArtIconProps = { name: 'Calendar' };
const PREV_ICON = { name: 'ChevronDown', size: 14, style: { transform: 'rotate(90deg)' } } as const;
const NEXT_ICON = { name: 'ChevronDown', size: 14, style: { transform: 'rotate(-90deg)' } } as const;

// ==== Date helpers ====

type MonthView = { year: number; month: number };

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDisplay(iso: string): string {
  const [year, month, day] = iso.split('-');
  return iso ? `${day}.${month}.${year}` : '';
}

/** Accepts dd.mm.yyyy or yyyy-mm-dd. Returns null for anything that isn't a real date. */
function parseTyped(text: string): string | null {
  const dayFirst = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  const yearFirst = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/.exec(text);
  const parts = dayFirst ? [dayFirst[3], dayFirst[2], dayFirst[1]] : yearFirst?.slice(1, 4);
  if (!parts) return null;

  const [year, month, day] = parts.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? toIso(date) : null;
}

function monthViewOf(iso: string): MonthView {
  const date = iso ? new Date(`${iso}T00:00:00`) : new Date();
  return { year: date.getFullYear(), month: date.getMonth() };
}

function shiftMonths({ year, month }: MonthView, delta: number): MonthView {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: total % 12 };
}

function buildDays({ year, month }: MonthView) {
  const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: GRID_CELLS }, (_, i) => {
    const date = new Date(year, month, 1 - mondayOffset + i);
    return { iso: toIso(date), day: date.getDate(), inMonth: date.getMonth() === month };
  });
}

// Keeps the input focused, so a panel click never triggers its blur commit.
const keepInputFocus = (e: React.MouseEvent) => e.preventDefault();

// ==== Component ====

function ArtDatePicker({ ref, label, helperText, errorText, value, onChange, disabled, required, clearable = !required }: ArtDatePickerProps) {
  const id = useId();
  const { triggerRef, panelRef, open, portalTarget, show, hide } = useAnchoredPanel<HTMLDivElement, HTMLDivElement>();

  const [draft, setDraft] = useState<string | null>(null);
  const [view, setView] = useState<MonthView>(() => monthViewOf(value));

  function commit(iso: string) {
    setDraft(null);
    if (iso !== value) onChange(iso);
  }

  function commitDraft() {
    if (draft === null) return;
    const text = draft.trim();
    commit(text ? (parseTyped(text) ?? value) : '');
  }

  function choose(iso: string) {
    commit(iso);
    hide();
  }

  function openPanel() {
    if (disabled || open) return;
    setView(monthViewOf(value));
    show();
  }

  function handleBlur(e: React.FocusEvent) {
    commitDraft();
    if (!panelRef.current?.contains(e.relatedTarget)) hide();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    commitDraft();
    hide();
  }

  const today = toIso(new Date());

  return (
    <div className="flex flex-col w-full">
      {label && <ArtLabel htmlFor={id} required={required}>{label}</ArtLabel>}
      <div ref={triggerRef}>
        <ArtInput
          ref={ref}
          id={id}
          icon={FIELD_ICON}
          placeholder="dd.mm.yyyy"
          autoComplete="off"
          value={draft ?? formatDisplay(value)}
          disabled={disabled}
          required={required}
          error={!!errorText}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={openPanel}
          onClick={openPanel}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      </div>
      <ArtHelperText errorText={errorText} helperText={helperText} />

      {open && portalTarget && createPortal(
        <div
          ref={panelRef}
          role="presentation"
          className="art-popover art-datepicker"
          style={{ zIndex: 'var(--z-anchor)' as unknown as number }}
          onMouseDown={keepInputFocus}
        >
          <div className="art-datepicker-header">
            <div className="art-datepicker-step">
              <ArtIconButton icon={PREV_ICON} aria-label="Previous month" size="sm" type="button" onClick={() => setView(shiftMonths(view, -1))} />
              <span className="art-datepicker-title">{MONTHS[view.month]}</span>
              <ArtIconButton icon={NEXT_ICON} aria-label="Next month" size="sm" type="button" onClick={() => setView(shiftMonths(view, 1))} />
            </div>
            <div className="art-datepicker-step">
              <ArtIconButton icon={PREV_ICON} aria-label="Previous year" size="sm" type="button" onClick={() => setView(shiftMonths(view, -12))} />
              <span className="art-datepicker-title">{view.year}</span>
              <ArtIconButton icon={NEXT_ICON} aria-label="Next year" size="sm" type="button" onClick={() => setView(shiftMonths(view, 12))} />
            </div>
          </div>

          <div className="art-datepicker-grid">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="art-datepicker-weekday">{weekday}</span>
            ))}
            {buildDays(view).map(({ iso, day, inMonth }) => (
              <button
                key={iso}
                type="button"
                aria-pressed={iso === value}
                className={cn(
                  'art-datepicker-day',
                  !inMonth && 'art-datepicker-day--outside',
                  iso === today && 'art-datepicker-day--today',
                  iso === value && 'art-datepicker-day--selected',
                )}
                onClick={() => choose(iso)}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="art-datepicker-footer">
            <ArtButton type="button" variant="ghost" size="sm" onClick={() => choose(today)}>Today</ArtButton>
            {clearable && (
              <ArtButton type="button" variant="ghost" size="sm" onClick={() => choose('')}>Clear</ArtButton>
            )}
          </div>
        </div>,
        portalTarget,
      )}
    </div>
  );
}

ArtDatePicker.displayName = 'ArtDatePicker';

export default ArtDatePicker;
export { ArtDatePicker };
export type { ArtDatePickerProps };

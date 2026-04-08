'use client';

import ArtButton, { type ArtButtonProps } from './ArtButton';

// ==== Types ====

export type ArtButtonRowItem = Omit<ArtButtonProps, 'children' | 'type'> & {
  label: string;
  /** Default: 'button'. Use 'submit' for the primary action button. */
  type?: 'submit' | 'button' | 'reset';
  /**
   * Which side of the row this button belongs to.
   * 'left'  — left group (contextual: Save copy, Update, etc.)
   * 'right' — right group (default — Cancel, primary action)
   * When both groups are present the row becomes space-between.
   */
  side?: 'left' | 'right';
};

export interface ArtButtonRowProps {
  buttons: ArtButtonRowItem[];
  className?: string;
}

// ==== Helpers ====

function renderBtn({ label, type = 'button', side: _side, ...btnProps }: ArtButtonRowItem, i: number) {
  return (
    <ArtButton key={i} type={type} size="lg" {...btnProps}>
      {label}
    </ArtButton>
  );
}

// ==== Component ====

export function ArtButtonRow({ buttons, className }: ArtButtonRowProps) {
  const leftBtns = buttons.filter((b) => b.side === 'left');
  const rightBtns = buttons.filter((b) => b.side !== 'left');
  const hasTwoGroups = leftBtns.length > 0 && rightBtns.length > 0;

  if (buttons.length === 0) return null;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        justifyContent: hasTwoGroups ? 'space-between' : 'flex-end',
      }}
    >
      {hasTwoGroups && (
        <div className="flex gap-2">
          {leftBtns.map(renderBtn)}
        </div>
      )}
      <div className="flex gap-2">
        {rightBtns.map(renderBtn)}
      </div>
    </div>
  );
}

ArtButtonRow.displayName = 'ArtButtonRow';
export default ArtButtonRow;

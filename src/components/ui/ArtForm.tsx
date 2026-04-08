'use client';

import { type ReactNode } from 'react';
import { ArtButtonRow, type ArtButtonRowItem } from './ArtButtonRow';

// ==== Types ====

/** ArtFormButtonProps = ArtButtonRowItem. Re-exported so form consumers keep the same import path. */
export type ArtFormButtonProps = ArtButtonRowItem;

export interface ArtFormProps {
  onSubmit: React.ComponentProps<'form'>['onSubmit'];
  /**
   * All form buttons. Use side: 'left' for contextual actions (Save copy, Update…).
   * Right-group convention (rightmost = most primary): [..., Cancel, PrimaryAction]
   */
  buttons: ArtFormButtonProps[];
  children: ReactNode;
  className?: string;
}

// ==== Component ====

export function ArtForm({ onSubmit, buttons, children, className }: ArtFormProps) {
  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-4">{children}</div>
      {buttons.length > 0 && (
        <ArtButtonRow buttons={buttons} className="art-dialog-footer mt-6" />
      )}
    </form>
  );
}

ArtForm.displayName = 'ArtForm';
export default ArtForm;

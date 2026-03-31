'use client';

import React, { type ReactNode } from 'react';
import ArtButton, { type ArtButtonProps } from './ArtButton';

// ==== Types ====

export type ArtFormButtonProps = Omit<ArtButtonProps, 'children' | 'type'> & {
  label: string;
  /** Default: 'button'. Use 'submit' for the primary action button. */
  type?: 'submit' | 'button' | 'reset';
};

export interface ArtFormProps {
  onSubmit: React.ComponentProps<'form'>['onSubmit'];
  /** Action buttons rendered right-aligned in the footer, in the order passed. */
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
        <div className="art-dialog-footer mt-6">
          {buttons.map(({ label, type = 'button', ...btnProps }, i) => (
            <ArtButton key={i} type={type} size='lg' {...btnProps}>
              {label}
            </ArtButton>
          ))}
        </div>
      )}
    </form>
  );
}

ArtForm.displayName = 'ArtForm';
export default ArtForm;

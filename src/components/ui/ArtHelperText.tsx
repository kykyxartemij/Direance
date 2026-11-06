'use client';

import type { ReactNode } from 'react';
import ArtIcon, { type ArtIconName } from './ArtIcon';
import { cn } from './art.utils';

interface ArtHelperTextProps {
  errorText?: string;
  helperText?: string;
}

const ICON_SIZE = 13;

function ArtFieldNote({ icon, className, children }: { icon: ArtIconName; className: string; children: ReactNode }) {
  return (
    <p className={cn('art-field-note', className)}>
      <ArtIcon name={icon} size={ICON_SIZE} className="art-field-note-icon" />
      <span>{children}</span>
    </p>
  );
}

function ArtHelperText({ errorText, helperText }: ArtHelperTextProps) {
  if (!errorText && !helperText) return null;
  return (
    <>
      {errorText && <ArtFieldNote icon="AlertCircle" className="art-field-error">{errorText}</ArtFieldNote>}
      {helperText && <ArtFieldNote icon="Info" className="art-field-helper">{helperText}</ArtFieldNote>}
    </>
  );
}

ArtHelperText.displayName = 'ArtHelperText';

export default ArtHelperText;
export { ArtHelperText };
export type { ArtHelperTextProps };

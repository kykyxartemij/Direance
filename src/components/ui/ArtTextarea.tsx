'use client';

import React, { useId, type Ref } from 'react';
import ArtLabel from './ArtLabel';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
  helperText?: string;
  color?: ArtColor;
  error?: boolean;
  /** Cap auto-grow at this number of visible rows, then show a scrollbar */
  maxRows?: number;
  label?: string;
}

function ArtTextarea({
  className, helperText, color, error, maxRows, style, onChange, rows = 1, label, id: idProp, required, ref, ...rest
}: ArtTextareaProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  return (
    <div className={cn('art-field-wrapper', color && ART_COLOR_CLASS[color], error && 'art-field-wrapper--error')}>
      {label && <ArtLabel htmlFor={id} required={required}>{label}</ArtLabel>}
      <div className="art-field-inner">
        <textarea
          {...rest}
          rows={rows}
          id={id}
          required={required}
          ref={ref}
          style={{
            // field-sizing: content makes the textarea auto-grow without JS
            fieldSizing: 'content' as React.CSSProperties['fieldSizing'],
            maxHeight: maxRows !== undefined ? `${maxRows}lh` : undefined,
            overflowY: 'auto',
            ...style,
          }}
          onChange={onChange}
          className={cn('art-field art-textarea art-scrollable', className)}
        />
      </div>
      {helperText && <p className="art-field-helper">{helperText}</p>}
    </div>
  );
}

ArtTextarea.displayName = 'ArtTextarea';
export default ArtTextarea;
export { ArtTextarea };
export type { ArtTextareaProps };

'use client';

import React, { forwardRef, useEffect, useId, useRef } from 'react';
import ArtLabel from './ArtLabel';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  helperText?: string;
  color?: ArtColor;
  /** Cap auto-grow at this number of visible rows, then show a scrollbar */
  maxRows?: number;
  label?: string;
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

const ArtTextarea = forwardRef<HTMLTextAreaElement, ArtTextareaProps>((
  { className, helperText, color, maxRows, style, onChange, rows = 1, label, id: idProp, required, ...rest },
  ref,
) => {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    autoResize(el);
    if (maxRows !== undefined) {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight);
      const pt = parseFloat(cs.paddingTop);
      const pb = parseFloat(cs.paddingBottom);
      el.style.maxHeight = `${lh * maxRows + pt + pb + 2}px`;
    }
  }, [maxRows]);

  return (
    <div className={cn('art-field-wrapper', color && ART_COLOR_CLASS[color])}>
      {label && <ArtLabel htmlFor={id} required={required}>{label}</ArtLabel>}
      <div className="art-field-inner">
        <textarea
          {...rest}
          rows={rows}
          id={id}
          required={required}
          ref={(el) => {
            innerRef.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = el;
          }}
          style={{ overflowY: 'auto', ...style }}
          onChange={(e) => { autoResize(e.currentTarget); onChange?.(e); }}
          className={cn('art-field art-textarea art-scrollable', className)}
        />
      </div>
      {helperText && <p className="art-field-helper">{helperText}</p>}
    </div>
  );
});

ArtTextarea.displayName = 'ArtTextarea';
export default ArtTextarea;
export { ArtTextarea };
export type { ArtTextareaProps };

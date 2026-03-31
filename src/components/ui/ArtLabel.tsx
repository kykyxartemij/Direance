'use client';

import { type LabelHTMLAttributes } from 'react';
import { cn } from './art.utils';

interface ArtLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Adds a * indicator — does not enforce any validation, purely visual */
  required?: boolean;
}

const ArtLabel = ({ required, className, children, ...rest }: ArtLabelProps) => (
  <label className={cn('art-label', className)} {...rest}>
    {children}
    {required && <span className="art-label-required" aria-hidden>*</span>}
  </label>
);

ArtLabel.displayName = 'ArtLabel';
export default ArtLabel;
export { ArtLabel };
export type { ArtLabelProps };

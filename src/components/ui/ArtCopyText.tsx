'use client';


// TODO: Completly different design. It could be like a "id based text + CopyIcon", but might be better to create something more uniq, or remove it completly
import ArtCopyButton from './ArtCopyButton';
import { cn } from './art.utils';

interface ArtCopyTextProps {
  /** The text value to display and copy */
  text: string;
  /** Optional shorter display label — full `text` is always copied */
  label?: string;
  /** Monospace styling, tighter padding — good for IDs, tokens, hashes */
  mono?: boolean;
  className?: string;
}

const ArtCopyText = ({ text, label, mono = false, className }: ArtCopyTextProps) => (
  <span className={cn('art-copy-text', mono && 'art-copy-text--mono', className)}>
    <span className="art-copy-text-value">{label ?? text}</span>
    <ArtCopyButton text={text} size="sm" />
  </span>
);

ArtCopyText.displayName = 'ArtCopyText';
export default ArtCopyText;
export { ArtCopyText };
export type { ArtCopyTextProps };

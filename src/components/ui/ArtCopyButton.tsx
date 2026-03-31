'use client';

import { useState } from 'react';
import ArtIconButton from './ArtIconButton';
import { type ArtButtonProps } from './ArtButton';
import { cn } from './art.utils';

interface ArtCopyButtonProps {
  /** Text that will be written to clipboard on click */
  text: string;
  size?: ArtButtonProps['size'];
  className?: string;
}

const ArtCopyButton = ({ text, size = 'md', className }: ArtCopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <ArtIconButton
      icon={{ name: copied ? 'Check' : 'Copy' }}
      size={size}
      className={cn(copied, className)}
      onClick={handleCopy}
      aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
    />
  );
};

ArtCopyButton.displayName = 'ArtCopyButton';
export default ArtCopyButton;
export { ArtCopyButton };
export type { ArtCopyButtonProps };

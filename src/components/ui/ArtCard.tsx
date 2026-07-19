import type { ReactNode } from 'react';

interface ArtCardProps {
  children: ReactNode;
  maxWidth?: number;
  className?: string;
}

export default function ArtCard({ children, maxWidth = 400, className }: ArtCardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth,
      }}
    >
      {children}
    </div>
  );
}

ArtCard.displayName = 'ArtCard';

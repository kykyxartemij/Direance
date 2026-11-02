import type { ReactNode } from 'react';

export default function ArtCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth: 400,
      }}
    >
      {children}
    </div>
  );
}

ArtCard.displayName = 'ArtCard';

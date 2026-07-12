import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Direance' };

export default function Page() {
  return (
    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
      Welcome to Direance.
    </p>
  );
}

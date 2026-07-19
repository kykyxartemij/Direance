import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';

export const metadata: Metadata = { title: 'Direance' };

export default function Page() {
  return (
    <ArtPage title="Dashboard" maxWidth="7xl">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Welcome to Direance.
      </p>
    </ArtPage>
  );
}

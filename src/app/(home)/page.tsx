import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';

export const metadata: Metadata = { title: 'Direance' };

export default function Page() {
  return (
    <ArtPage title="Dashboard" description="Your financial reports in one place." maxWidth="7xl">
      <p className="text-sm art-text-muted">
        Welcome to Direance.
      </p>
    </ArtPage>
  );
}

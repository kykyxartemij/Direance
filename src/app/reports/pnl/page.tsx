import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import PnlPage from '@/page/reports/pnl/PnlPage';

export const metadata: Metadata = { title: 'Profit & Loss' };

export default function Page() {
  return (
    <ArtPage title="Profit & Loss" maxWidth="7xl">
      <PnlPage />
    </ArtPage>
  );
}

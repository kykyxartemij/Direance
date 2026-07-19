import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import Dashboard from '@/page/dashboard/Dashboard';

export const metadata: Metadata = { title: 'Profit & Loss' };

export default function Page() {
  return (
    <ArtPage title="Profit & Loss" maxWidth="7xl">
      <Dashboard reportType="pnl" />
    </ArtPage>
  );
}

import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import Dashboard from '@/page/dashboard/Dashboard';

export const metadata: Metadata = { title: 'Financial Position' };

export default function Page() {
  return (
    <ArtPage title="Financial Position" maxWidth="7xl">
      <Dashboard reportType="financial_position" />
    </ArtPage>
  );
}

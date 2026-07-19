import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import FinancialPositionPage from '@/page/reports/financial-position/FinancialPositionPage';

export const metadata: Metadata = { title: 'Financial Position' };

export default function Page() {
  return (
    <ArtPage title="Financial Position" maxWidth="7xl">
      <FinancialPositionPage />
    </ArtPage>
  );
}

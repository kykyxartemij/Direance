import type { Metadata } from 'next';
import Dashboard from '@/page/dashboard/Dashboard';

export const metadata: Metadata = { title: 'Profit & Loss' };

export default function Page() {
  return <Dashboard reportType="pnl" />;
}

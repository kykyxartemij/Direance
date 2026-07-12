import type { Metadata } from 'next';
import Dashboard from '@/page/dashboard/Dashboard';

export const metadata: Metadata = { title: 'Financial Position' };

export default function Page() {
  return <Dashboard reportType="financial_position" />;
}

import type { Metadata } from 'next';
import ConnectionFormPage from '@/page/connections/ConnectionFormPage';

export const metadata: Metadata = { title: 'New Connection' };

export default function Page() {
  return <ConnectionFormPage />;
}

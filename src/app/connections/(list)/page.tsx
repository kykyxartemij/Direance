import type { Metadata } from 'next';
import ConnectionsListPage from '@/page/connections/ConnectionsListPage';

export const metadata: Metadata = { title: 'Connections' };

export default function Page() {
  return <ConnectionsListPage />;
}

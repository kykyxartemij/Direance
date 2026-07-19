import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import ConnectionFormPage from '@/page/connections/ConnectionFormPage';

export const metadata: Metadata = { title: 'New Connection' };

export default function Page() {
  return (
    <ArtPage title="New Connection">
      <ConnectionFormPage />
    </ArtPage>
  );
}

import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import { ConnectionFormEdit } from '@/page/connections/ConnectionFormPage';

export const metadata: Metadata = { title: 'Edit Connection' };

export default function Page() {
  return (
    <ArtPage title="Edit Connection">
      <ConnectionFormEdit />
    </ArtPage>
  );
}

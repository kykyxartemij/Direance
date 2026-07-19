import type { Metadata } from 'next';
import Link from 'next/link';
import ArtPage from '@/components/ArtPage';
import ArtButton from '@/components/ui/ArtButton';
import ConnectionsListPage from '@/page/connections/ConnectionsListPage';
import { HREF } from '@/lib/hrefUrl';

export const metadata: Metadata = { title: 'Connections' };

export default function Page() {
  return (
    <ArtPage
      title="Connections"
      actions={
        <Link href={HREF.connectionNew} prefetch>
          <ArtButton color="primary">New Connection</ArtButton>
        </Link>
      }
    >
      <ConnectionsListPage />
    </ArtPage>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import ArtPage from '@/components/ArtPage';
import ArtButton from '@/components/ui/ArtButton';
import MappingsPage from '@/page/mappings/MappingsPage';
import { HREF } from '@/lib/hrefUrl';

export const metadata: Metadata = { title: 'Mappings' };

export default function Page() {
  return (
    <ArtPage
      title="Mappings"
      actions={
        <Link href={HREF.mappingNew} prefetch>
          <ArtButton color="primary">New Mapping</ArtButton>
        </Link>
      }
    >
      <MappingsPage />
    </ArtPage>
  );
}

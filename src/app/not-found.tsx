import type { Metadata } from 'next';
import Link from 'next/link';
import ArtPage from '@/components/ArtPage';
import ArtButton from '@/components/ui/ArtButton';
import { HREF } from '@/lib/hrefUrl';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <ArtPage title="Page not found" maxWidth="2xl">
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm art-text-muted">
          This page does not exist, or it was moved. Check the address, or head back to your
          reports.
        </p>
        <Link href={HREF.home} prefetch>
          <ArtButton color="primary">Back to Direance</ArtButton>
        </Link>
      </div>
    </ArtPage>
  );
}

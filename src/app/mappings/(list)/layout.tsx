import Link from 'next/link';
import ArtTitle from '@/components/ui/ArtTitle';
import ArtButton from '@/components/ui/ArtButton';
import { HREF } from '@/lib/hrefUrl';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="flex items-start justify-between mb-6">
        <ArtTitle title="Mappings" className="mb-0" />
        <Link href={HREF.mappingNew} prefetch>
          <ArtButton color="primary">New Mapping</ArtButton>
        </Link>
      </div>
      {children}
    </div>
  );
}

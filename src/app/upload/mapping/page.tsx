import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import MappingStep from '@/page/mapping/MappingStep';

export const metadata: Metadata = { title: 'Configure Mapping' };

export default function Page() {
  return (
    <ArtPage title="Configure Mapping">
      <MappingStep />
    </ArtPage>
  );
}

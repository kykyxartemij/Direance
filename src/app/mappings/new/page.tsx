import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import { MappingFormCreate } from '@/page/mappings/MappingFormPage';

export const metadata: Metadata = { title: 'New Mapping' };

export default function Page() {
  return (
    <ArtPage title="New Mapping">
      <MappingFormCreate />
    </ArtPage>
  );
}

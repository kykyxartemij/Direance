import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import { MappingFormEdit } from '@/page/mappings/MappingFormPage';

export const metadata: Metadata = { title: 'Edit Mapping' };

export default function Page() {
  return (
    <ArtPage title="Edit Mapping">
      <MappingFormEdit />
    </ArtPage>
  );
}

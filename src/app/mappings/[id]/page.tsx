import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import { MappingFormEdit } from '@/page/mappings/MappingFormPage';

export const metadata: Metadata = { title: 'Edit Mapping' };

export default function Page() {
  return (
    <ArtPage title="Edit Mapping" description="Change how this report is read and shown.">
      <MappingFormEdit />
    </ArtPage>
  );
}

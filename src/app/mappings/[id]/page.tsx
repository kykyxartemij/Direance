import type { Metadata } from 'next';
import { MappingFormEdit } from '@/page/mappings/MappingFormPage';

export const metadata: Metadata = { title: 'Edit Mapping' };

export default function Page() {
  return <MappingFormEdit />;
}

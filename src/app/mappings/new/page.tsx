import type { Metadata } from 'next';
import MappingFormPage from '@/page/mappings/MappingFormPage';

export const metadata: Metadata = { title: 'New Mapping' };

export default function Page() {
  return <MappingFormPage />;
}

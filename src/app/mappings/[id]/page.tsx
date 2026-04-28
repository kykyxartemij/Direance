import type { Metadata } from 'next';
import MappingFormPage from '@/page/mappings/MappingFormPage';

export const metadata: Metadata = { title: 'Edit Mapping' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MappingFormPage id={id} />;
}

import type { Metadata } from 'next';
import { MappingFormEdit } from '@/page/mappings/MappingFormPage';

export const metadata: Metadata = { title: 'Edit Mapping' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MappingFormEdit id={id} />;
}

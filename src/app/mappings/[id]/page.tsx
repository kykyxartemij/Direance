import type { Metadata } from 'next';
import MappingEditPage from '@/page/mappings/MappingEditPage';

export const metadata: Metadata = { title: 'Edit Mapping' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MappingEditPage id={id} />;
}

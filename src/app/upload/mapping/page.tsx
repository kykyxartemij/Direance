import type { Metadata } from 'next';
import MappingStep from '@/page/mapping/MappingStep';

export const metadata: Metadata = { title: 'Configure Mapping' };

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <MappingStep reportId={id} />;
}

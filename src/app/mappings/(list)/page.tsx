import type { Metadata } from 'next';
import MappingsPage from '@/page/mappings/MappingsPage';

export const metadata: Metadata = { title: 'Mappings' };

export default function Page() {
  return <MappingsPage />;
}

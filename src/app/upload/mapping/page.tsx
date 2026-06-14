import type { Metadata } from 'next';
import MappingStep from '@/page/mapping/MappingStep';

export const metadata: Metadata = { title: 'Configure Mapping' };

export default function Page() {
  return <MappingStep />;
}

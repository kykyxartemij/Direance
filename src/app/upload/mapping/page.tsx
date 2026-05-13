import type { Metadata } from 'next';
import MappingStepPage from '@/page/mapping/MappingStepPage';

export const metadata: Metadata = { title: 'Configure Mapping' };

export default function Page() {
  return <MappingStepPage />;
}

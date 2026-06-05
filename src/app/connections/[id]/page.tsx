import type { Metadata } from 'next';
import { ConnectionFormEdit } from '@/page/connections/ConnectionFormPage';

export const metadata: Metadata = { title: 'Edit Connection' };

export default function Page() {
  return <ConnectionFormEdit />;
}

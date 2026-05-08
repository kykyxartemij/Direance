import type { Metadata } from 'next';
import UploadPage from '@/page/upload/UploadPage';

export const metadata: Metadata = { title: 'Upload' };

export default function Page() {
  return <UploadPage />;
}

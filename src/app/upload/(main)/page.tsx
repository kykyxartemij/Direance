import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import UploadPage from '@/page/upload/UploadPage';

export const metadata: Metadata = { title: 'Upload' };

export default function Page() {
  return (
    <ArtPage
      title="Upload"
      description="Add an Excel report from any source. The file stays in your browser."
    >
      <UploadPage />
    </ArtPage>
  );
}

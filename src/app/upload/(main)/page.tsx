import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import UploadPage from '@/page/upload/UploadPage';

export const metadata: Metadata = { title: 'Upload' };

export default function Page() {
  return (
    <ArtPage
      title="Upload"
      description="Upload an Excel file exported from Merit.ee or any other source. The file is parsed locally — it never leaves your browser."
    >
      <UploadPage />
    </ArtPage>
  );
}

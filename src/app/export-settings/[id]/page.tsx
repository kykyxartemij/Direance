import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import { ExportSettingsFormEdit } from '@/page/export-settings/ExportSettingsFormPage';

export const metadata: Metadata = { title: 'Edit Export Settings' };

export default function Page() {
  return (
    <ArtPage title="Edit Export Setting">
      <ExportSettingsFormEdit />
    </ArtPage>
  );
}

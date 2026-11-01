import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import ExportSettingsFormPage from '@/page/export-settings/ExportSettingsFormPage';

export const metadata: Metadata = { title: 'New Export Settings' };

export default function Page() {
  return (
    <ArtPage title="New Export Setting" description="Create a layout for your Excel exports.">
      <ExportSettingsFormPage />
    </ArtPage>
  );
}

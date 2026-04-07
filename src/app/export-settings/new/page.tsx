import type { Metadata } from 'next';
import ExportSettingsFormPage from '@/page/export-settings/ExportSettingsFormPage';

export const metadata: Metadata = { title: 'New Export Settings' };

export default function Page() {
  return <ExportSettingsFormPage />;
}

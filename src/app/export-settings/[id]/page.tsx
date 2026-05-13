import type { Metadata } from 'next';
import { ExportSettingsFormEdit } from '@/page/export-settings/ExportSettingsFormPage';

export const metadata: Metadata = { title: 'Edit Export Settings' };

export default function Page() {
  return <ExportSettingsFormEdit />;
}

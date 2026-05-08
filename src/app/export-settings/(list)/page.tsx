import type { Metadata } from 'next';
import ExportSettingsListPage from '@/page/export-settings/ExportSettingsListPage';

export const metadata: Metadata = { title: 'Export Settings' };

export default function Page() {
  return <ExportSettingsListPage />;
}

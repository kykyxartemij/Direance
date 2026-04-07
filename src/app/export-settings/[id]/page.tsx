import type { Metadata } from 'next';
import ExportSettingsFormPage from '@/page/export-settings/ExportSettingsFormPage';

// We should display the ExportSettingsName in the title, instead of just "Edit"
export const metadata: Metadata = { title: 'Edit Export Settings' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExportSettingsFormPage id={id} />;
}

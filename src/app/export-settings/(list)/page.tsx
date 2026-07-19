import type { Metadata } from 'next';
import Link from 'next/link';
import ArtPage from '@/components/ArtPage';
import ArtButton from '@/components/ui/ArtButton';
import ExportSettingsListPage from '@/page/export-settings/ExportSettingsListPage';
import { HREF } from '@/lib/hrefUrl';

export const metadata: Metadata = { title: 'Export Settings' };

export default function Page() {
  return (
    <ArtPage
      title="Export Settings"
      actions={
        <Link href={HREF.exportSettingNew} prefetch>
          <ArtButton color="primary">New Config</ArtButton>
        </Link>
      }
    >
      <ExportSettingsListPage />
    </ArtPage>
  );
}

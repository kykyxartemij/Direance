import { getLightExportSettings } from '@/services/export-settings.service';

export async function GET() {
  return getLightExportSettings();
}

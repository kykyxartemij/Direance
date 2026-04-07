import { type NextRequest } from 'next/server';
import { getPagedExportSettings } from '@/services/export-settings.service';

export async function GET(req: NextRequest) {
  return getPagedExportSettings(req);
}

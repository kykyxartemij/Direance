import { getLightExportSettings } from '@/services/export-settings.service';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  return getLightExportSettings(req);
}

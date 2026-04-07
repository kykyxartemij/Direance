import { type NextRequest } from 'next/server';
import { createExportSetting } from '@/services/export-settings.service';

export async function POST(req: NextRequest) {
  return createExportSetting(req);
}

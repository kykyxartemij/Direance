import { type NextRequest } from 'next/server';
import { getLogoByExportSettingId } from '@/services/logo.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return getLogoByExportSettingId(req, ctx);
}

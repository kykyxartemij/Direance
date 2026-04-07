import { type NextRequest } from 'next/server';
import {
  getExportSettingLogoById,
  updateExportSettingLogo,
  deleteExportSettingLogo,
} from '@/services/export-settings.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return getExportSettingLogoById(req, ctx);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return updateExportSettingLogo(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return deleteExportSettingLogo(req, ctx);
}

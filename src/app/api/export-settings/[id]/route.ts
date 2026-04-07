import { type NextRequest } from 'next/server';
import {
  getExportSettingById,
  updateExportSetting,
  deleteExportSetting,
} from '@/services/export-settings.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return getExportSettingById(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return updateExportSetting(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return deleteExportSetting(req, ctx);
}

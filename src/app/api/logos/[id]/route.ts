import { type NextRequest } from 'next/server';
import { getLogoById, deleteLogo } from '@/services/logo.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return getLogoById(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return deleteLogo(req, ctx);
}

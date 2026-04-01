import { type NextRequest } from 'next/server';
import { getMappingById, updateMapping, deleteMapping } from '@/services/mapping.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return getMappingById(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return updateMapping(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return deleteMapping(req, ctx);
}

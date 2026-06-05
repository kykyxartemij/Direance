import { type NextRequest } from 'next/server';
import {
  getConnectionById,
  updateConnection,
  deleteConnection,
} from '@/services/connection.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return getConnectionById(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return updateConnection(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return deleteConnection(req, ctx);
}

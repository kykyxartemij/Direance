import { type NextRequest } from 'next/server';
import { fetchFinancialPositionConnectionById } from '@/services/connection.service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return fetchFinancialPositionConnectionById(req, ctx);
}

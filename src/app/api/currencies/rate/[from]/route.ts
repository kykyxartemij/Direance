import { type NextRequest } from 'next/server';
import { getCurrencyRate } from '@/services/currency.service';

type Ctx = { params: Promise<{ from: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return getCurrencyRate(req, ctx);
}

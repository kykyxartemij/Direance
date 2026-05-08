import { NextRequest } from 'next/server';
import { getCurrencyRate } from '@/services/currency.service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ from: string }> },
) {
  const { from } = await params;
  return getCurrencyRate(from);
}

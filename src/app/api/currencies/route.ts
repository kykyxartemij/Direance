import { type NextRequest } from 'next/server';
import { getCurrencyList } from '@/services/currency.service';

export async function GET(req: NextRequest) {
  return getCurrencyList(req);
}

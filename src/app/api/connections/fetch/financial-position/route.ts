import { type NextRequest } from 'next/server';
import { fetchFinancialPositionConnectionsByIds } from '@/services/connection.service';

export async function POST(req: NextRequest) {
  return fetchFinancialPositionConnectionsByIds(req);
}

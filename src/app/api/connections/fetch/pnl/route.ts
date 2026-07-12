import { type NextRequest } from 'next/server';
import { fetchProfitConnectionsByIds } from '@/services/connection.service';

export async function POST(req: NextRequest) {
  return fetchProfitConnectionsByIds(req);
}

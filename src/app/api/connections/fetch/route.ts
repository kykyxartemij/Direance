import { type NextRequest } from 'next/server';
import { fetchFromConnectionsByIds } from '@/services/connection.service';

export async function POST(req: NextRequest) {
  return fetchFromConnectionsByIds(req);
}

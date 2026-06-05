import { type NextRequest } from 'next/server';
import { createConnection } from '@/services/connection.service';

export async function POST(req: NextRequest) {
  return createConnection(req);
}

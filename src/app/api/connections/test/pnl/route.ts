import { type NextRequest } from 'next/server';
import { testPnlConnection } from '@/services/connection.service';

export async function POST(req: NextRequest) {
  return testPnlConnection(req);
}

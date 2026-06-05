import { type NextRequest } from 'next/server';
import { getPagedConnections } from '@/services/connection.service';

export async function GET(req: NextRequest) {
  return getPagedConnections(req);
}

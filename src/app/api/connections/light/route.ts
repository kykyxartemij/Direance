import { type NextRequest } from 'next/server';
import { getLightConnections } from '@/services/connection.service';

export async function GET(req: NextRequest) {
  return getLightConnections(req);
}

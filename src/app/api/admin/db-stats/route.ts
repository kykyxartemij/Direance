import { type NextRequest } from 'next/server';
import { getDbStats } from '@/services/admin.service';

export async function GET(req: NextRequest) {
  return getDbStats(req);
}

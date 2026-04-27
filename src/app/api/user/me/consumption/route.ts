import { NextRequest } from 'next/server';
import { getDbConsumption } from '@/services/user.service';

export async function GET(req: NextRequest) {
  return getDbConsumption(req);
}

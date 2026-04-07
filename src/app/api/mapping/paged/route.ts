import { type NextRequest } from 'next/server';
import { getPagedMappings } from '@/services/mapping.service';

export async function GET(req: NextRequest) {
  return getPagedMappings(req);
}

import { type NextRequest } from 'next/server';
import { getLightMappings } from '@/services/mapping.service';

export async function GET(req: NextRequest) {
  return getLightMappings(req);
}
